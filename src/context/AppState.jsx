import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import eventsSeed from '../data/events.json'
import { fetchEvents, patchEventStatus } from '../services/eventsApi'
import { fetchRuns } from '../services/runsApi'
import { isApiNotConfiguredError } from '../services/apiErrors'

const AppStateContext = createContext(null)

export function useAppState() {
  return useContext(AppStateContext)
}

function normalizeStatus(s) {
  const ok = ['Detected', 'In Progress', 'Resolved']
  if (!s) return 'Detected'
  if (ok.includes(s)) return s
  // map some turkish variants to Detected/In Progress/Resolved
  const lower = String(s).toLowerCase()
  if (lower.includes('tespit') || lower.includes('gözle') || lower.includes('tespit')) return 'Detected'
  if (lower.includes('izle') || lower.includes('sınıfl') || lower.includes('in progress') || lower.includes('angaj')) return 'In Progress'
  if (lower.includes('sonuç') || lower.includes('etkisiz') || lower.includes('resolved') || lower.includes('alarm')) return 'Resolved'
  return 'Detected'
}

export function AppStateProvider({ children }) {
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [activity, setActivity] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tayka_activity') : null
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [system, setSystem] = useState({
    ws: 'kapalı',
    sim: 'boşta',
    approval: 'kapalı',
    seed: null,
    module: null,
  })

  const [runs, setRuns] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tayka_runs') : null
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const [currentRunId, setCurrentRunId] = useState(null)
  const currentRunIdRef = useRef(null)

  useEffect(() => {
    currentRunIdRef.current = currentRunId
  }, [currentRunId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // seed events from json and normalize statuses
      const seed = Array.isArray(eventsSeed) ? eventsSeed : []
      const fallback = seed.map((e) => ({
        ...e,
        status: normalizeStatus(e.status),
      }))

      try {
        const data = await fetchEvents()
        const list = Array.isArray(data) ? data : []
        const normalized = list.map((e) => ({
          ...e,
          status: normalizeStatus(e.status),
        }))
        if (!cancelled) {
          setEvents(normalized)
          addLog('Events loaded from backend')
        }
      } catch {
        // NOTE: we intentionally don't surface network stack traces to UI.
        // Also, events API is optional (backend may not provide it).
        if (!cancelled) {
          setEvents(fallback)
          addLog('Using bundled events.json')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadRuns() {
      try {
        const data = await fetchRuns()
        const list = Array.isArray(data) ? data : []
        if (!cancelled && list.length > 0) {
          setRuns(list)
          addLog('Runs loaded from backend')
        }
      } catch (e) {
        if (cancelled) return
        if (isApiNotConfiguredError(e)) {
          // Runs API is optional; keep local runs.
          addLog('Runs API not configured; using local archive')
        } else {
          const status = e?.response?.status
          if (status === 404) {
            addLog('Runs endpoint not found on backend; using local archive')
          } else {
            // Network/backend failure: keep local runs.
            addLog('Runs backend unavailable; using local archive')
          }
        }
      }
    }
    loadRuns()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addLog(message) {
    const entry = { time: new Date().toISOString(), message }
    setLogs((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const next = [...list, entry]
      // keep memory bounded
      return next.slice(-2000)
    })

    // If a run is active, also archive the log line into that run.
    setRuns((prev) => {
      const runId = currentRunIdRef.current
      if (!runId) return prev
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex((r) => r?.id === runId)
      if (idx === -1) return prev
      const next = list.slice()
      const run = next[idx]
      const runLogs = Array.isArray(run?.logs) ? run.logs : []
      next[idx] = {
        ...run,
        logs: [...runLogs, entry].slice(-5000),
        updatedAt: entry.time,
      }
      return next
    })
  }

  function addActivity({ user, category, comment, time } = {}) {
    const entry = {
      time: time || new Date().toISOString(),
      user: user || 'admin',
      category: category || 'Sistem',
      comment: comment || '',
    }
    setActivity((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const next = [entry, ...list]
      return next.slice(0, 5000)
    })
  }

  function startRun({ seed, context } = {}) {
    const id = Date.now()
    const startedAt = new Date().toISOString()
    setCurrentRunId(id)
    currentRunIdRef.current = id
    setRuns((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const next = [
        {
          id,
          context: context || 'Operasyon',
          seed: seed || null,
          startedAt,
          updatedAt: startedAt,
          outcome: null,
          failSilentReason: null,
          ammo: null,
          energy: null,
          durationSec: null,
          logs: [],
        },
        ...list,
      ]
      return next.slice(0, 200)
    })
    return id
  }

  function endRun(patch = {}) {
    const endedAt = new Date().toISOString()
    setRuns((prev) => {
      if (!currentRunId) return prev
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex((r) => r?.id === currentRunId)
      if (idx === -1) return prev
      const next = list.slice()
      const startedAt = next[idx]?.startedAt
      let durationSec = patch?.durationSec ?? next[idx]?.durationSec ?? null
      if (startedAt) {
        const a = new Date(startedAt).getTime()
        const b = new Date(endedAt).getTime()
        if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) durationSec = Math.round((b - a) / 1000)
      }

      next[idx] = {
        ...next[idx],
        ...patch,
        durationSec,
        endedAt,
        updatedAt: endedAt,
      }
      return next
    })
    setCurrentRunId(null)
    currentRunIdRef.current = null
  }

  useEffect(() => {
    try {
      window.localStorage.setItem('tayka_runs', JSON.stringify(runs))
    } catch {
      // ignore
    }
  }, [runs])

  useEffect(() => {
    try {
      window.localStorage.setItem('tayka_activity', JSON.stringify(activity))
    } catch {
      // ignore
    }
  }, [activity])

  function setSystemStatus(patch) {
    if (!patch || typeof patch !== 'object') return
    setSystem((prev) => ({
      ...(prev || {}),
      ...patch,
    }))
  }

  function addEvent(event) {
    setEvents((prev) => {
      const next = [{ ...event }, ...prev]
      return next
    })
    addLog(`New event created: ${event.id}`)
  }

  function upsertEvent(event) {
    if (!event || typeof event !== 'object') return
    const id = event.id
    if (id === undefined || id === null) return

    setEvents((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex((ev) => ev?.id === id)
      if (idx === -1) {
        // create
        return [{ ...event }, ...list]
      }
      // update in place (keeps ordering stable)
      const next = list.slice()
      next[idx] = { ...next[idx], ...event }
      return next
    })
  }

  async function updateEventStatus(id, nextStatus) {
    // optimistic UI update
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, status: nextStatus } : ev)))
    addLog(`Event ${id} status changed to ${nextStatus}`)

    try {
      await patchEventStatus(id, nextStatus)
    } catch (e) {
      if (isApiNotConfiguredError(e)) {
        addLog('Events API not configured; status not synced to backend')
      } else {
        addLog(`Backend update failed for event ${id} (status=${nextStatus})`)
      }
    }

    if (nextStatus === 'Resolved') addLog(`Event ${id} resolved`)
  }

  const value = {
    events,
    setEvents,
    logs,
    addLog,
    activity,
    addActivity,
    addEvent,
    upsertEvent,
    updateEventStatus,
    system,
    setSystemStatus,
    runs,
    currentRunId,
    startRun,
    endRun,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export default AppStateContext
