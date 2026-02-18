import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../context/AppState'
import OperatorConsole from '../components/OperatorConsole'
import { getAuth, getRole } from '../utils/auth'
import { ACTIONS, can, isAdmin } from '../utils/rbac'

export default function Operation() {
  const { logs = [], system, setSystemStatus, currentRunId, startRun, endRun, addActivity, addLog } = useAppState()
  const opRunIdRef = useRef(null)
  const approvalTimerRef = useRef(null)
  const [approveConsumed, setApproveConsumed] = useState(false)
  const [selectedModule, setSelectedModule] = useState(() => String(system?.module || 'BORAN'))

  const role = getRole?.()
  const allowStart = isAdmin(role) || can(role, ACTIONS.START_OPERATION)
  const allowApprove = isAdmin(role) || can(role, ACTIONS.APPROVE_RECOMMENDATION)
  const allowEnd = isAdmin(role) || can(role, ACTIONS.END_OPERATION)
  const allowSelectModule = isAdmin(role) || can(role, ACTIONS.SELECT_MODULE_OPERATION)

  const viewLogs = useMemo(() => {
    const list = Array.isArray(logs) ? logs : []
    // show last N to keep render fast
    return list.slice(-300)
  }, [logs])

  useEffect(() => {
    return () => {
      try {
        if (approvalTimerRef.current) clearTimeout(approvalTimerRef.current)
      } catch {
        // ignore
      }
      approvalTimerRef.current = null
    }
  }, [])

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

  async function handleCopyLogs(text) {
    if (!text) return
    await tryCopy(text)
    addLog?.('Log kopyalandı')
    addActivity?.({
      user: getAuth?.()?.email || 'admin',
      category: 'Operasyon',
      comment: `Log kopyalandı (${viewLogs.length})`,
    })
  }

  function patchSystem(patch) {
    const next = { ...(system || {}), ...(patch || {}) }
    setSystemStatus?.(next)
  }

  const simRunning = system?.sim === 'çalışıyor'
  const approvalRequested = system?.approval === 'bekleniyor'

  const startDisabledUi = !allowStart || simRunning
  const endDisabledUi = !allowEnd || !simRunning
  const approveDisabledUi = !allowApprove || !simRunning || !approvalRequested || approveConsumed

  function handleStart() {
    if (!allowStart) return

    setApproveConsumed(false)
    if (approvalTimerRef.current) {
      try { clearTimeout(approvalTimerRef.current) } catch { /* ignore */ }
      approvalTimerRef.current = null
    }

    if (!currentRunId) {
      const id = startRun?.({ context: 'Operasyon', seed: system?.seed ?? null })
      opRunIdRef.current = id
      addActivity?.({
        user: getAuth?.()?.email || 'admin',
        category: 'Operasyon',
        comment: `Run başlatıldı${system?.seed ? ` • seed=${system.seed}` : ''}`,
      })
    }

    addLog?.('Başlat isteği alındı')
    addActivity?.({
      user: getAuth?.()?.email || 'admin',
      category: 'Operasyon',
      comment: 'Başlat tıklandı',
    })

    patchSystem({ sim: 'çalışıyor', approval: 'kapalı' })

    // Simulate approval request after 15s (as in UI chip)
    approvalTimerRef.current = setTimeout(() => {
      patchSystem({ approval: 'bekleniyor' })
      addLog?.('Onay bekleniyor (15 sn)')
    }, 15000)
  }

  function handleApprove() {
    if (!allowApprove) return
    if (!approvalRequested) return
    if (approveConsumed) return
    setApproveConsumed(true)
    addLog?.('Onay isteği alındı')
    addActivity?.({
      user: getAuth?.()?.email || 'admin',
      category: 'Operasyon',
      comment: 'Onayla tıklandı',
    })
    patchSystem({ approval: 'kapalı' })
  }

  function handleEnd() {
    if (!allowEnd) return

    if (approvalTimerRef.current) {
      try { clearTimeout(approvalTimerRef.current) } catch { /* ignore */ }
      approvalTimerRef.current = null
    }

    addLog?.('Bitir isteği alındı')
    addActivity?.({
      user: getAuth?.()?.email || 'admin',
      category: 'Operasyon',
      comment: 'Bitir tıklandı',
    })
    patchSystem({ sim: 'boşta', approval: 'kapalı' })

    if (opRunIdRef.current && currentRunId === opRunIdRef.current) {
      endRun?.({ outcome: 'Belirsiz' })
      addActivity?.({
        user: getAuth?.()?.email || 'admin',
        category: 'Operasyon',
        comment: 'Run bitti',
      })
    }
    opRunIdRef.current = null
  }

  return (
    <OperatorConsole
      title="Operasyon"
      subtitle="Canlı akış • Seçim merkezde • Onay: 15 sn"
      threatLevel="YÜKSEK"
      seed={String(system?.seed ?? '')}
      onSeedChange={(v) => patchSystem({ seed: String(v ?? '') })}
      seedEditable={false}
      fazText="-"
      secondsText="15 sn"
      onStart={handleStart}
      onApprove={handleApprove}
      onEnd={handleEnd}
      startDisabled={startDisabledUi}
      approveDisabled={approveDisabledUi}
      endDisabled={endDisabledUi}
      moduleSelectDisabled={!allowSelectModule}
      busy={false}
      approvalDisabled={false}
      selectedModule={selectedModule}
      onSelectModule={(m) => {
        if (!allowSelectModule) return
        const next = String(m || '').trim()
        if (!next || next === selectedModule) return
        setSelectedModule(next)
        patchSystem({ module: next })
        addLog?.(`Modül seçildi: ${next}`)
        addActivity?.({
          user: getAuth?.()?.email || 'admin',
          category: 'Operasyon',
          comment: `Modül seçildi: ${next}`,
        })
      }}
      system={{ ws: system?.ws || 'kapalı', sim: system?.sim || 'boşta', approval: system?.approval || 'kapalı' }}
      recommendation={{
        title: 'ÖNERİ',
        text: 'Seçili modüle göre öneri/alternatif listesi burada gösterilir.',
      }}
      logLines={viewLogs}
      onCopyLogs={handleCopyLogs}
    />
  )
}
