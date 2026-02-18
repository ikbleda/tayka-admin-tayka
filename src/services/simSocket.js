function deriveWsUrlFromApiUrl(apiUrl) {
  if (!apiUrl) return null
  if (apiUrl.startsWith('http://')) return `ws://${apiUrl.slice('http://'.length)}`
  if (apiUrl.startsWith('https://')) return `wss://${apiUrl.slice('https://'.length)}`
  // If apiUrl is relative (/api), we can't safely derive WS url
  return null
}

export function getWebSocketUrl() {
  const base = import.meta.env.VITE_WS_URL || deriveWsUrlFromApiUrl(import.meta.env.VITE_API_URL) || null
  if (!base) return null

  const wsPath = import.meta.env.VITE_WS_PATH
  if (!wsPath) return base

  try {
    const u = new URL(base)
    // If user provides a path override, replace pathname.
    u.pathname = wsPath.startsWith('/') ? wsPath : `/${wsPath}`
    return u.toString()
  } catch {
    return base
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function connectSimSocket({
  url,
  onEvent,
  onLog,
  onMessage,
  onOpen,
  onClose,
  onError,
} = {}) {
  const wsUrl = url || getWebSocketUrl()
  if (!wsUrl) throw new Error('WebSocket URL not configured. Set VITE_WS_URL.')

  const socket = new WebSocket(wsUrl)

  socket.addEventListener('open', (ev) => onOpen?.(ev))
  socket.addEventListener('close', (ev) => onClose?.(ev))
  socket.addEventListener('error', (ev) => onError?.(ev))
  socket.addEventListener('message', (ev) => {
    const raw = ev?.data
    const parsed = typeof raw === 'string' ? safeJsonParse(raw) : null
    const payload = parsed ?? raw

    onMessage?.(payload)

    // Best-effort normalization for unknown backend message shapes
    const handle = (data) => {
      if (data == null) return
      if (Array.isArray(data)) return data.forEach(handle)

      if (typeof data === 'string') {
        onLog?.(data)
        return
      }

      const msg = data?.log || data?.message || data?.msg
      if (msg) onLog?.(String(msg))

      if (data?.event) {
        onEvent?.(data.event)
        return
      }

      if (Array.isArray(data?.events)) {
        data.events.forEach((e) => onEvent?.(e))
        return
      }

      // If it looks like an event itself
      if (data?.type && (data?.time || data?.timestamp) && (data?.id || data?.source)) {
        onEvent?.(data)
      }
    }

    handle(payload)
  })

  return {
    wsUrl,
    socket,
    close: () => {
      try {
        socket.close()
      } catch {
        // ignore
      }
    },
  }
}
