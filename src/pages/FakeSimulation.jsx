import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import scenariosData from '../data/fakeSimulation.json'
import { useAppState } from '../context/AppState'
import { abortSim, approveSim, health, startSim } from '../services/simApi'
import { connectSimSocket } from '../services/simSocket'
import OperatorConsole from '../components/OperatorConsole'
import { getAuth, getRole } from '../utils/auth'
import { ACTIONS, can, isAdmin, ROLES } from '../utils/rbac'

function tryCopy(text) {
  try {
    if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text)
  } catch {
    // ignore
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', 'true')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  } catch {
    // ignore
  }
  return Promise.resolve()
}

export default function FakeSimulation({ variant = 'simulasyon' }) {
  const [searchParams] = useSearchParams()
  const title = variant === 'operasyon' ? 'Operasyon' : 'Simülasyon'
  const subtitle = variant === 'operasyon' ? 'Canlı akış • Seçim merkezde • Onay: 15 sn' : 'Birebir tekrar • Seed ile replay • Trace görüntüleme'

  const scenarios = Array.isArray(scenariosData) ? scenariosData : []
  const selected = useMemo(() => scenarios[0] ?? null, [scenarios])

  const { addLog, setEvents, upsertEvent, setSystemStatus, startRun, endRun, addActivity } = useAppState()
  const timerRef = useRef(null)
  const stepRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [intervalMs, setIntervalMs] = useState(1500)

  const runActiveRef = useRef(false)
  const completedRef = useRef(false)
  const failSilentReasonRef = useRef(null)
  const ammoRef = useRef(null)
  const energyRef = useRef(null)

  function currentUser() {
    return getAuth?.()?.email || 'admin'
  }

  const [mode, setMode] = useState(import.meta.env.VITE_SIM_MODE === 'backend' ? 'backend' : 'fake')
  const [seed, setSeed] = useState('')
  const [selectedModule, setSelectedModule] = useState('KARMA')
  const [backendStatus, setBackendStatus] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [wsUrl, setWsUrl] = useState('')
  const wsRef = useRef(null)
  const [backendHint, setBackendHint] = useState('')
  const [approvalHint, setApprovalHint] = useState('')
  const [backendRunActive, setBackendRunActive] = useState(false)

  const role = getRole?.()
  const allowStart = isAdmin(role) || can(role, ACTIONS.START_SIMULATION)
  const allowAbort = isAdmin(role) || can(role, ACTIONS.ABORT_SIMULATION)
  const allowSelectModule = isAdmin(role) || can(role, ACTIONS.SELECT_MODULE_SIMULATION)
  const allowApproveBase = isAdmin(role) || can(role, ACTIONS.APPROVE_RECOMMENDATION)

  const [failSilentMode, setFailSilentMode] = useState(false)
  const [approveConsumed, setApproveConsumed] = useState(false)
  const fakeApprovalTimerRef = useRef(null)

  const [simOutputs, setSimOutputs] = useState([])
  // Latest recommendation metrics to drive module cards
  const [recommendation, setRecommendation] = useState({ metricsByModule: {} })

  const [statusData, setStatusData] = useState(null)
  const simEventIdRef = useRef(null)
  const simEventStartTimeRef = useRef(null)
  const approvedModuleRef = useRef(null)

  function toPct(v) {
    if (v == null || v === '') return null
    const n = Number(v)
    if (Number.isFinite(n)) {
      const p = n <= 1 ? n * 100 : n
      return `${Math.round(p)}%`
    }
    const s = String(v)
    return s.includes('%') ? s : s
  }

  function toDur(v) {
    if (v == null || v === '') return null
    const n = Number(v)
    if (Number.isFinite(n)) return `${Math.round(n)} sn`
    return String(v)
  }

  function toCost(v) {
    if (v == null || v === '') return null
    const n = Number(v)
    if (Number.isFinite(n)) return `${Math.round(n)} ₺`
    return String(v)
  }

  function normalizeModuleMetrics(raw) {
    if (!raw || typeof raw !== 'object') return null
    return {
      success: toPct(raw.success ?? raw.successRate ?? raw.pSuccess ?? raw.p_success),
      duration: toDur(raw.duration ?? raw.time ?? raw.eta ?? raw.durationSec ?? raw.durationSeconds),
      cost: toCost(raw.cost ?? raw.maliyet ?? raw.costTry ?? raw.costTL),
      status: raw.status ?? raw.state ?? raw.fit ?? raw.fitness,
    }
  }

  function consumeRecommendationEnvelope(envelope) {
    if (!envelope || typeof envelope !== 'object') return
    const type = String(envelope.type || envelope.kind || envelope.eventType || '').toUpperCase()
    if (!type) return
    if (!(type.includes('RECOMMENDATION') || type === 'SIM_RECOMMENDATION')) return

    const p = envelope.payload ?? envelope.data ?? envelope

    // Try common shapes: modules as array or object map
    const modules = p.modules ?? p.metricsByModule ?? p.moduleMetrics ?? p.recommendation?.modules
    let metricsByModule = {}

    if (Array.isArray(modules)) {
      for (const m of modules) {
        const name = String(m?.name ?? m?.module ?? '').toUpperCase()
        if (!name) continue
        const nm = normalizeModuleMetrics(m)
        if (nm) metricsByModule[name] = nm
      }
    } else if (modules && typeof modules === 'object') {
      metricsByModule = Object.fromEntries(
        Object.entries(modules).map(([k, v]) => [String(k).toUpperCase(), normalizeModuleMetrics(v) || {}])
      )
    }

    // As a fallback, if payload has per-module fields directly
    for (const key of ['BORAN', 'ALBATUR', 'KARMA', 'YURA']) {
      if (!metricsByModule[key] && p?.[key]) {
        const nm = normalizeModuleMetrics(p[key])
        if (nm) metricsByModule[key] = nm
      }
    }

    if (Object.keys(metricsByModule).length) {
      setRecommendation({ metricsByModule })
    }
  }

  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef(null)

  function normalizeStatus(s) {
    const ok = ['Detected', 'In Progress', 'Resolved']
    if (!s) return 'Detected'
    if (ok.includes(s)) return s
    const lower = String(s).toLowerCase()
    if (lower.includes('tespit') || lower.includes('gözle')) return 'Detected'
    if (
      lower.includes('izle') ||
      lower.includes('sınıfl') ||
      lower.includes('sinif') ||
      lower.includes('doğrula') ||
      lower.includes('dogrula') ||
      lower.includes('mitig') ||
      lower.includes('karşı') ||
      lower.includes('karsi') ||
      lower.includes('caydır') ||
      lower.includes('caydir') ||
      lower.includes('in progress') ||
      lower.includes('angaj')
    ) {
      return 'In Progress'
    }
    if (lower.includes('sonuç') || lower.includes('etkisiz') || lower.includes('resolved') || lower.includes('alarm')) return 'Resolved'
    return 'Detected'
  }

  function clearSimOutputs() {
    setSimOutputs([])
  }

  function isSystemOutputLine(text) {
    const t = String(text || '').trim().toLowerCase()
    if (!t) return true
    return (
      t.startsWith('connecting to backend websocket') ||
      t === 'websocket connected' ||
      t === 'ws connected' ||
      t.includes('websocket connected') ||
      t.includes('ws connected') ||
      t.includes('socket connected') ||
      t.startsWith('websocket disconnected') ||
      t.startsWith('ws disconnected') ||
      t === 'websocket error' ||
      t.startsWith('reconnecting in ') ||
      t.includes('reconnecting in')
    )
  }

  function pushSimOutput(message) {
    const text = String(message ?? '').trim()
    if (!text) return
    if (isSystemOutputLine(text)) return
    const entry = { time: new Date().toISOString(), message: text }
    setSimOutputs((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const next = [...list, entry]
      return next.slice(-800)
    })
  }

  function levelForStep(step) {
    const txt = (step.status || step.description || '').toLowerCase()
    if (txt.includes('roket') || txt.includes('rocket') || txt.includes('sürü') || txt.includes('yüksek')) return 'High'
    return 'Medium'
  }

  function tick() {
    if (!selected) return stop()
    const idx = stepRef.current
    if (idx >= (selected.steps || []).length) return stop()

    const step = selected.steps[idx]
    const isLast = idx === (selected.steps || []).length - 1

    const status = isLast ? 'Resolved' : 'In Progress'
    const simId = simEventIdRef.current
    if (simId) {
      upsertEvent({
        id: simId,
        type: 'Simülasyon',
        level: levelForStep(step),
        status,
        source: `FakeSimulation:${selected.scenarioId}`,
      })
    }

    const line = `Scenario ${selected.scenarioName} step ${step.step}: ${step.description}`
    addLog(line)
    pushSimOutput(line)
    stepRef.current = idx + 1
    if (stepRef.current >= (selected.steps || []).length) {
      // finished
      completedRef.current = true
      stop()
    }
  }

  function beginRun(contextLabel) {
    if (runActiveRef.current) return
    failSilentReasonRef.current = null
    setFailSilentMode(false)
    setApproveConsumed(false)
    ammoRef.current = null
    energyRef.current = null
    completedRef.current = false
    startRun?.({
      context: contextLabel,
      seed: seed === '' ? null : seed,
    })
    runActiveRef.current = true

    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: `Run başlatıldı: ${contextLabel}${seed ? ` (seed=${seed})` : ''}`,
    })
  }

  function finishRun(patch) {
    if (!runActiveRef.current) return
    const outcome = patch?.outcome || null
    const failSilentReason = failSilentReasonRef.current || null

    endRun?.({
      failSilentReason: failSilentReasonRef.current || null,
      ammo: ammoRef.current || null,
      energy: energyRef.current || null,
      ...patch,
    })
    runActiveRef.current = false

    const commentParts = [`Run bitti${outcome ? `: ${outcome}` : ''}`]
    if (seed) commentParts.push(`seed=${seed}`)
    if (approvedModuleRef.current) commentParts.push(`module=${approvedModuleRef.current}`)
    if (failSilentReason) commentParts.push(`neden=${failSilentReason}`)

    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: commentParts.join(' • '),
    })
  }

  function clearFakeApprovalTimer() {
    if (!fakeApprovalTimerRef.current) return
    try {
      clearTimeout(fakeApprovalTimerRef.current)
    } catch {
      // ignore
    }
    fakeApprovalTimerRef.current = null
  }

  function requestApprovalFake() {
    // Turn on Approve button by showing an approval hint.
    setApprovalHint('Onay bekleniyor: 15 sn içinde Onayla butonuna basıp modül seçin (BORAN/ALBATUR/KARMA/YURA).')
    setSystemStatus?.({ approval: 'bekleniyor' })

    // If user doesn't approve in time, mark fail-silent.
    clearFakeApprovalTimer()
    fakeApprovalTimerRef.current = setTimeout(() => {
      setApprovalHint('Onay zaman aşımına uğradı. Tekrar Başlat ile başlatıp 15 sn içinde Onayla gönderin.')
      setSystemStatus?.({ approval: 'kapalı' })
      if (!failSilentReasonRef.current) failSilentReasonRef.current = 'Onay zaman aşımı (fail-silent)'
      setFailSilentMode(true)
    }, 15_000)
  }

  function approveFake() {
    if (approveConsumed) return
    clearFakeApprovalTimer()
    setApproveConsumed(true)
    approvedModuleRef.current = selectedModule

    const line = `Approve gönderildi (fake) • module=${selectedModule}`
    addLog(line)
    pushSimOutput(line)

    setApprovalHint('')
    setSystemStatus?.({ approval: 'kapalı' })
  }

  function start() {
    if (running) return
    beginRun(variant === 'operasyon' ? 'Operasyon (fake)' : 'Simülasyon (fake)')
    clearSimOutputs()
    simEventIdRef.current = Date.now()
    simEventStartTimeRef.current = new Date().toISOString()
    approvedModuleRef.current = null
    addLog(`Simulation started (fake): ${selected?.scenarioName ?? 'unknown'}`)
    pushSimOutput(`Simulation started (fake): ${selected?.scenarioName ?? 'unknown'}`)

    if (simEventIdRef.current) {
      upsertEvent({
        id: simEventIdRef.current,
        time: simEventStartTimeRef.current,
        type: 'Simülasyon',
        level: 'Medium',
        status: 'Detected',
        source: `FakeSimulation:${selected?.scenarioId ?? 'unknown'}`,
      })
    }

    setApprovalHint('')
    clearFakeApprovalTimer()

    setRunning(true)

    // Simulate an approval request shortly after start.
    fakeApprovalTimerRef.current = setTimeout(() => {
      requestApprovalFake()
    }, 1200)

    stepRef.current = 0
    timerRef.current = setInterval(tick, intervalMs)
    // run first immediately
    tick()
  }

  function stop() {
    clearFakeApprovalTimer()
    setApprovalHint('')

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (running) {
      const line = `Simulation stopped (fake): ${selected?.scenarioName ?? 'unknown'}`
      addLog(line)
      pushSimOutput(line)

      finishRun({
        outcome: completedRef.current ? 'Başarılı' : 'Başarısız',
      })
    }
    setRunning(false)
    setSystemStatus?.({ sim: 'boşta', approval: 'kapalı', seed: null })
  }

  function reset() {
    stop()
    setFailSilentMode(false)
    setEvents([])
    clearSimOutputs()
    addLog(`Simulation reset (fake): ${selected?.scenarioName ?? 'unknown'}`)
    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: `Sıfırla (fake)${selected?.scenarioName ? ` • ${selected.scenarioName}` : ''}`,
    })
    stepRef.current = 0
    simEventIdRef.current = null
    simEventStartTimeRef.current = null
    setSystemStatus?.({ sim: 'boşta', approval: 'kapalı', seed: null })
  }

  // Apply seed passed from Archive: /simulasyon?seed=####
  useEffect(() => {
    const fromQuery = searchParams.get('seed')
    if (fromQuery && String(fromQuery).trim() !== '') setSeed(String(fromQuery))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep global topbar status chips in sync with Simulation screen.
  useEffect(() => {
    const ws = mode === 'backend' && backendStatus === 'connected' ? 'bağlı' : 'kapalı'
    const sim = mode === 'backend' ? (backendRunActive ? 'çalışıyor' : 'boşta') : (running ? 'çalışıyor' : 'boşta')
    const approval = approvalHint ? 'bekleniyor' : 'kapalı'
    const isRunActive = mode === 'backend' ? backendRunActive : running
    const seedValue = isRunActive && seed ? seed : null
    setSystemStatus?.({ ws, sim, approval, seed: seedValue, module: selectedModule })
  }, [mode, backendStatus, backendRunActive, running, approvalHint, seed, selectedModule, setSystemStatus])

  // Ensure fake simulation timer is stopped on unmount.
  useEffect(() => {
    return () => {
      try {
        if (timerRef.current) clearInterval(timerRef.current)
      } catch {
        // ignore
      }
      timerRef.current = null
      setSystemStatus?.({ sim: 'boşta', approval: 'kapalı', seed: null })

      if (fakeApprovalTimerRef.current) {
        try {
          clearTimeout(fakeApprovalTimerRef.current)
        } catch {
          // ignore
        }
        fakeApprovalTimerRef.current = null
      }
    }
  }, [setSystemStatus])

  function toEventShape(e) {
    if (!e || typeof e !== 'object') return null

    const rawType = e.type ?? e.kind ?? 'Sim'
    const typeStr = String(rawType || '')
    const providedStatus = e.status ?? e.state
    let inferredStatus = providedStatus

    // Backend sim events often don't include a status; infer from type.
    if (!inferredStatus && (typeStr.startsWith('SIM_') || typeStr === 'WAIT_FOR_APPROVAL' || typeStr === 'SIM_RECOMMENDATION')) {
      const resolvedTypes = new Set(['SIM_END', 'SIM_TARGET_NEUTRALIZED', 'SIM_ABORT', 'SIM_ABORTED', 'SIM_FAILED', 'SIM_ERROR'])
      if (resolvedTypes.has(typeStr)) inferredStatus = 'Resolved'
      else if (typeStr === 'SIM_STARTED') inferredStatus = 'Detected'
      else inferredStatus = 'In Progress'
    }

    return {
      id: e.id ?? Date.now(),
      time: e.time ?? e.timestamp ?? new Date().toISOString(),
      type: rawType,
      level: e.level ?? e.severity ?? 'Medium',
      status: inferredStatus ?? 'Detected',
      source: e.source ?? e.origin ?? 'Backend',
      ...e,
    }
  }
function setDeep(obj, path, value) {
  const next = { ...(obj || {}) }
  let cur = next
  for (let i = 0; i < path.length - 1; i += 1) {
    const k = path[i]
    cur[k] = typeof cur[k] === 'object' && cur[k] ? { ...cur[k] } : {}
    cur = cur[k]
  }
  cur[path[path.length - 1]] = value
  return next
}

function parseTelemetryFromLogLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return null
  const msg = raw.replace(/^\[[0-9:.]+\]\s*/, '')

  if (msg.toUpperCase().startsWith('TESPİT:')) {
    const body = msg.replace(/^TESPİT:\s*/i, '')
    const parts = body.split('|').map((p) => p.trim()).filter(Boolean)

    let title = parts[0] || ''
    let tag = parts[1] || ''
    let level = ''
    let ayaz = ''

    for (const p of parts.slice(2)) {
      const kv = p.split('=').map((x) => x.trim())
      if (kv.length >= 2) {
        const k = kv[0].toLowerCase()
        const v = kv.slice(1).join('=').trim()
        if (k.includes('seviye')) level = v
        if (k.includes('ayaz')) ayaz = v
      }
    }

    return (prev) => {
      let next = prev
      if (title) next = setDeep(next, ['threat', 'title'], title)
      if (tag) next = setDeep(next, ['threat', 'tag'], tag)
      if (level) next = setDeep(next, ['classification', 'level'], level.toLocaleUpperCase('tr-TR'))
      if (ayaz) next = setDeep(next, ['trace', 'ayaz'], String(ayaz).includes('%') ? ayaz : `${ayaz}%`)
      return next
    }
  }

  if (/^KOŞULLAR:/i.test(msg) || /^KOSULLAR:/i.test(msg)) {
    const body = msg.replace(/^KOŞULLAR:\s*/i, '').replace(/^KOSULLAR:\s*/i, '')
    const parts = body.split('|').map((p) => p.trim()).filter(Boolean)
    const status = parts[0] || ''
    let wind = ''
    let visibility = ''
    for (const p of parts.slice(1)) {
      const [k, ...rest] = p.split('=')
      const key = String(k || '').trim().toLowerCase()
      const val = rest.join('=').trim()
      if (key.includes('rüzgar') || key.includes('ruzgar') || key.includes('wind')) wind = val
      if (key.includes('görüş') || key.includes('gorus') || key.includes('visibility')) visibility = val
    }
    return (prev) => {
      let next = prev
      if (status) next = setDeep(next, ['environment', 'status'], status)
      if (wind) next = setDeep(next, ['environment', 'wind'], wind)
      if (visibility) next = setDeep(next, ['environment', 'visibility'], visibility)
      return next
    }
  }

  if (/^KAYNAK:/i.test(msg)) {
    const body = msg.replace(/^KAYNAK:\s*/i, '')
    const parts = body.split('|').map((p) => p.trim()).filter(Boolean)
    return (prev) => {
      let next = prev
      for (const p of parts) {
        const m = p.match(/^(BORAN|ALBATUR|KARMA|YURA)\s+(.+)$/i)
        if (!m) continue
        const mod = m[1].toUpperCase()
        const rest = p.slice(m[1].length).trim()
        next = setDeep(next, ['resource', mod], rest)
      }
      return next
    }
  }

  if (/^TEHDİT:/i.test(msg) || /^TEHDIT:/i.test(msg)) {
    const body = msg.replace(/^TEHDİT:\s*/i, '').replace(/^TEHDIT:\s*/i, '').trim()
    if (body) return (prev) => setDeep(prev, ['classification', 'level'], body.toLocaleUpperCase('tr-TR'))
  }

  if (/^ÖNERİ\s+DURUMU:/i.test(msg) || /^ONERI\s+DURUMU:/i.test(msg)) {
    const body = msg
      .replace(/^ÖNERİ\s+DURUMU:\s*/i, '')
      .replace(/^ONERI\s+DURUMU:\s*/i, '')
    const primary = (body.match(/PRIMARY\s*=\s*([A-ZÇĞİÖŞÜ0-9_]+)/i) || [])[1]
    const alt =
      (body.match(/ALTERNATİF\s*=\s*([A-ZÇĞİÖŞÜ0-9_]+)/i) || body.match(/ALTERNATIF\s*=\s*([A-ZÇĞİÖŞÜ0-9_]+)/i) || [])[1]
    return (prev) => {
      let next = prev
      if (primary) next = setDeep(next, ['recommendation', 'primary'], primary.toUpperCase())
      if (alt) next = setDeep(next, ['recommendation', 'alt'], alt.toUpperCase())
      return next
    }
  }

  return null
}



  useEffect(() => {
    if (mode !== 'backend') return

    let closed = false

    // React 18 StrictMode (dev) runs effects twice (mount->unmount->mount).
    // Defer the actual WS connect so the first pass gets cleaned up before connecting.
    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    function scheduleReconnect(reasonText) {
      if (closed) return
      clearReconnectTimer()

      reconnectAttemptRef.current += 1
      const attempt = reconnectAttemptRef.current
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 15_000)

      setBackendStatus('reconnecting')
      addLog(`WS disconnected${reasonText ? ` (${reasonText})` : ''}. Reconnecting in ${Math.round(delayMs / 1000)}s...`)

      reconnectTimerRef.current = setTimeout(() => {
        if (closed) return
        connectNow()
      }, delayMs)
    }

    function connectNow() {
      if (closed) return
      // Close any existing socket first
      try {
        wsRef.current?.close?.()
      } catch {
        // ignore
      }
      wsRef.current = null

      addLog('Connecting to backend WebSocket...')
      pushSimOutput('Connecting to backend WebSocket...')
      try {
        const conn = connectSimSocket({
          onOpen: () => {
            if (closed) return
            clearReconnectTimer()
            reconnectAttemptRef.current = 0
            setBackendStatus('connected')
            setSystemStatus?.({ ws: 'bağlı' })
            setBackendHint('')
            addLog('WebSocket connected')
            pushSimOutput('WebSocket connected')
          },
          onClose: (ev) => {
            if (closed) return
            setBackendStatus('disconnected')
            setSystemStatus?.({ ws: 'kapalı' })
            const code = ev?.code
            const reason = ev?.reason
            const clean = ev?.wasClean
            addLog(`WebSocket disconnected (code=${code}${reason ? ` reason=${reason}` : ''}${clean !== undefined ? ` clean=${clean}` : ''})`)
            pushSimOutput(`WebSocket disconnected (code=${code}${reason ? ` reason=${reason}` : ''})`)

            if (code === 1006) {
              setBackendHint('WS bağlantısı beklenmedik şekilde kapandı. Backend/ngrok tarafında tünel veya upstream servis düşmüş olabilir. Health ile kontrol edin.')
            }

            scheduleReconnect(code ? `code=${code}` : '')
          },
          onError: () => {
            if (closed) return
            setBackendStatus('error')
            setSystemStatus?.({ ws: 'kapalı' })
            addLog('WebSocket error')
            pushSimOutput('WebSocket error')
            setBackendHint('WebSocket error. Backend/ngrok erişimini kontrol edin.')
            scheduleReconnect('error')
          },
          // IMPORTANT: some backend messages (e.g. SIM_RECOMMENDATION) may arrive as an envelope
          // that doesn't qualify as an "event" for simSocket's heuristics. Always inspect raw messages.
          onMessage: (payload) => {
            consumeRecommendationEnvelope(payload)
          },
          onLog: (m) => {
            const text = String(m)
            addLog(text)
            pushSimOutput(text)

            // Derive Status panel fields from backend log lines (video parity)
            const updater = parseTelemetryFromLogLine(text)
            if (updater) setStatusData((prev) => updater(prev || {}))

            // If backend indicates an approval is required, show UI hint on Simulation page.
            const lower = text.toLowerCase()
            if (lower.includes('waiting for approval') || lower.includes('onay') || lower.includes('approve')) {
              setApprovalHint('Backend onay bekliyor: 15 sn içinde Approve butonuna basıp modül seçin (BORAN/ALBATUR/MIXED).')
              setSystemStatus?.({ approval: 'bekleniyor' })
            }
            if (lower.includes('timeout') || lower.includes('zaman aşımı') || lower.includes('fail-silent')) {
              setApprovalHint('Onay zaman aşımına uğradı. Tekrar Start ile başlatıp 15 sn içinde Approve gönderin.')
              setSystemStatus?.({ approval: 'kapalı' })
              failSilentReasonRef.current = 'Onay zaman aşımı (fail-silent)'
              setFailSilentMode(true)
            }
          },
          onEvent: (ev) => {
            const shaped = toEventShape(ev)
            if (!shaped) return

            const t = String(shaped.type || '')
            const resolvedTypes = new Set(['SIM_END', 'SIM_TARGET_NEUTRALIZED', 'SIM_ABORT', 'SIM_ABORTED', 'SIM_FAILED', 'SIM_ERROR'])
            if (t === 'SIM_STARTED') {
              setBackendRunActive(true)
              beginRun('Simülasyon (backend)')
            }

            if (resolvedTypes.has(t)) setBackendRunActive(false)

            // Capture potential run fields from event payloads if present.
            if (shaped?.ammo !== undefined && shaped?.ammo !== null && shaped?.ammo !== '') ammoRef.current = shaped.ammo
            if (shaped?.energy !== undefined && shaped?.energy !== null && shaped?.energy !== '') energyRef.current = shaped.energy

            // Ensure a single row for the current simulation run.
            if (!simEventIdRef.current) simEventIdRef.current = Date.now()

            if (!simEventStartTimeRef.current) simEventStartTimeRef.current = shaped.time || new Date().toISOString()

            upsertEvent({
              id: simEventIdRef.current,
              // Keep event time as simulation start time (do not change on updates)
              time: simEventStartTimeRef.current,
              type: 'Simülasyon',
              level: shaped.level ?? 'Medium',
              status: shaped.status ?? 'Detected',
              source: approvedModuleRef.current || shaped.source || 'Backend',
            })

            const extra = shaped.message || shaped.description || shaped.detail || shaped.text || ''
            const line = extra ? `${shaped.type}: ${extra}` : String(shaped.type || 'Sim event')
            pushSimOutput(line)

            if (resolvedTypes.has(t)) {
              const isSuccess = t === 'SIM_END' || t === 'SIM_TARGET_NEUTRALIZED'
              const isAbort = t === 'SIM_ABORT' || t === 'SIM_ABORTED'
              const isFail = t === 'SIM_FAILED' || t === 'SIM_ERROR'

              if (isAbort && !failSilentReasonRef.current) failSilentReasonRef.current = 'Abort'
              if (isFail && !failSilentReasonRef.current && extra) failSilentReasonRef.current = String(extra)

              finishRun({
                outcome: isSuccess ? 'Başarılı' : 'Başarısız',
              })
            }
          },
        })
        wsRef.current = conn
        setWsUrl(conn.wsUrl || '')
      } catch (e) {
        setBackendStatus('error')
        addLog(e?.message || 'WebSocket connection failed')
        scheduleReconnect('connect failed')
      }
    }

    setBackendStatus('connecting')
    clearReconnectTimer()
    reconnectAttemptRef.current = 0
    const connectTimer = setTimeout(() => {
      if (closed) return
      connectNow()
    }, 50)

    return () => {
      closed = true
      clearTimeout(connectTimer)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      try {
        wsRef.current?.close?.()
      } catch {
        // ignore
      }
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function backendHealth() {
    setBusy(true)
    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: 'Health kontrolü',
    })
    try {
      const data = await health()
      addLog(`Health OK: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      setBackendHint('')
    } catch (e) {
      const status = e?.response?.status
      const ngrokCode = e?.response?.headers?.['ngrok-error-code']
      const msg = `Health FAILED: ${status || ''} ${e?.message || ''}`.trim()
      addLog(msg)

      const apiUrl = String(import.meta.env.VITE_API_URL || '')
      const host = typeof window !== 'undefined' ? window.location.hostname : ''
      const isLocal = host === 'localhost' || host === '127.0.0.1'
      if (!apiUrl && !isLocal) {
        setBackendHint('Vercel/production ortamında Vite proxy çalışmaz. Vercel Environment Variables içinde VITE_API_URL ve VITE_WS_URL değerlerini backend adresine ayarlayın; aksi halde /health isteği Vercel domain’ine gider.')
        return
      }

      // CORS / preflight failures often show up as "Network Error" with no response.
      const hasResponse = !!e?.response
      const message = String(e?.message || '')
      if (!hasResponse && message.toLowerCase().includes('network')) {
        setBackendHint('Health isteği tarayıcı tarafından engellenmiş olabilir (CORS / OPTIONS preflight). Backend CORS’ta Vercel origin’inizi allow edin ve `Authorization` header’ını kabul edin. Cookie kullanmıyorsanız `VITE_API_WITH_CREDENTIALS=false` bırakın.')
        return
      }

      if (ngrokCode === 'ERR_NGROK_8012') {
        setBackendHint('ngrok ERR_NGROK_8012: ngrok tüneli trafiği alıyor ama backend upstream servise bağlanamıyor. Backend servisi/portu yeniden başlatılmalı (ngrok doğru porta yönlenmeli).')
      }
    } finally {
      setBusy(false)
    }
  }

  async function backendStart() {
    setBusy(true)
    setApprovalHint('')
    clearSimOutputs()
    setBackendRunActive(true)
    beginRun(variant === 'operasyon' ? 'Operasyon (backend)' : 'Simülasyon (backend)')
    simEventIdRef.current = Date.now()
    simEventStartTimeRef.current = new Date().toISOString()
    approvedModuleRef.current = null
    upsertEvent({
      id: simEventIdRef.current,
      time: simEventStartTimeRef.current,
      type: 'Simülasyon',
      level: 'Medium',
      status: 'Detected',
      source: 'Backend',
    })
    try {
const data = await startSim({
  seed: variant === 'operasyon' ? undefined : (seed === '' ? undefined : seed),
})
      addLog(`Sim start: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      pushSimOutput('Sim start requested')
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Start failed'
      addLog(`Sim start FAILED: ${msg}`)
      pushSimOutput(`Sim start FAILED: ${msg}`)
      failSilentReasonRef.current = msg
      setBackendRunActive(false)
      finishRun({ outcome: 'Başarısız' })
    } finally {
      setBusy(false)
    }
  }

  async function backendApprove() {
    setBusy(true)
    setApprovalHint('')

    const payloadModule = selectedModule === 'KARMA' ? 'MIXED' : selectedModule

    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: `Onay gönderildi (module=${selectedModule}${payloadModule !== selectedModule ? `→${payloadModule}` : ''})${seed ? ` • seed=${seed}` : ''}`,
    })
    try {
      const data = await approveSim({ selectedModule: payloadModule })
      addLog(`Sim approve (${payloadModule}): ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      pushSimOutput(`Approve sent (${payloadModule})`)

      setSystemStatus?.({ approval: 'kapalı' })

      approvedModuleRef.current = selectedModule
      if (simEventIdRef.current) {
        upsertEvent({
          id: simEventIdRef.current,
          source: selectedModule,
        })
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Approve failed'
      addLog(`Sim approve FAILED: ${msg}`)
      pushSimOutput(`Sim approve FAILED: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  async function backendAbort() {
    setBusy(true)
    setApprovalHint('')
    addActivity?.({
      user: currentUser(),
      category: 'Simülasyon',
      comment: `Bitir/Abort istendi${seed ? ` (seed=${seed})` : ''}`,
    })
    try {
      const data = await abortSim()
      addLog(`Sim abort: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      pushSimOutput('Abort sent')
      setBackendRunActive(false)
      setSystemStatus?.({ sim: 'boşta', approval: 'kapalı', seed: null })

      if (!failSilentReasonRef.current) failSilentReasonRef.current = 'Abort'
      finishRun({ outcome: 'Başarısız' })
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Abort failed'
      addLog(`Sim abort FAILED: ${msg}`)
      pushSimOutput(`Sim abort FAILED: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  const approvalDisabled = mode === 'backend' ? !approvalHint : (!approvalHint || approveConsumed)

  const startDisabledUi = (mode === 'backend' ? backendRunActive : running)
  const endDisabledUi = !(mode === 'backend' ? backendRunActive : running)
  const approveDisabledUi = (mode !== 'backend' && !(running && approvalHint && !approveConsumed))

  const allowApprove = (() => {
    if (!allowApproveBase) return false
    // Fail-silent mode: operatör asla angajman yapamaz; komutan/admin yapabilir.
    if (!failSilentMode) return true
    return isAdmin(role) || role === ROLES.COMMANDER
  })()
  const visibleLogs = useMemo(() => {
    const list = Array.isArray(simOutputs) ? simOutputs : []
    return list.slice(-600)
  }, [simOutputs])

  async function handleCopyLogs(text) {
    if (!text) return
    await tryCopy(text)
    addLog('Log kopyalandı')
  }

  return (
    <OperatorConsole
      title={title}
      subtitle={subtitle}
      threatLevel="YÜKSEK"
      recommendation={recommendation}
seed={seed}
onSeedChange={(v) => {
  if (variant === 'operasyon') return
  setSeed(String(v ?? ''))
}}
seedEditable={variant !== 'operasyon'}
      fazText="-"
      secondsText="15 sn"
      onStart={() => {
        if (!allowStart) return
        return mode === 'backend' ? backendStart() : start()
      }}
      onApprove={() => {
        if (!allowApprove) return
        return mode === 'backend' ? backendApprove() : approveFake()
      }}
      onEnd={() => {
        if (!allowAbort) return
        return mode === 'backend' ? backendAbort() : stop()
      }}
      busy={busy}
      approvalDisabled={approvalDisabled}
      startDisabled={!allowStart || startDisabledUi}
      approveDisabled={!allowApprove || approveDisabledUi}
      endDisabled={!allowAbort || endDisabledUi}
      moduleSelectDisabled={!allowSelectModule}
      selectedModule={selectedModule}
      onSelectModule={(m) => {
        if (!allowSelectModule) return
        setSelectedModule(m)
      }}
      system={{ ws: backendStatus === 'connected' ? 'bağlı' : 'kapalı', sim: backendRunActive || running ? 'çalışıyor' : 'boşta', approval: approvalHint ? 'bekleniyor' : 'kapalı' }}
      logLines={visibleLogs}
      onCopyLogs={handleCopyLogs}
    />
  )
}
