import axios from 'axios'

function getBaseURL() {
  return "https://pops-mistakenly-donette.ngrok-free.dev"
}

function getToken() {
  try {
    const raw = localStorage.getItem('tayka_auth_v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.token ?? null
  } catch {
    return null
  }
}

const api = axios.create({
  baseURL: getBaseURL(),
  // Token-based auth is used by default; cookies/sessions are optional.
  // In production (e.g. Vercel), enabling credentials without proper CORS headers
  // can cause requests to fail. Make this opt-in via env.
  withCredentials: String(import.meta.env.VITE_API_WITH_CREDENTIALS || '').toLowerCase() === 'true',
  headers: {},
  timeout: 20_000,
})

api.interceptors.request.use((config) => {
  // Allow per-request control without adding extra headers (avoid preflight).
  const skipAuth = config?.skipAuth === true
  const skipNgrokWarning = config?.skipNgrokWarning === true

  // Make /health extra CORS-friendly in production: no auth header, no ngrok warning header.
  // Some axios merge paths may drop custom config flags; so detect by URL too.
  const url = typeof config?.url === 'string' ? config.url : ''
  const method = String(config?.method || 'get').toLowerCase()
  const isHealthRequest = method === 'get' && (url === '/health' || url.endsWith('/health') || url.includes('/health?'))
  const effectiveSkipAuth = skipAuth || isHealthRequest
  const effectiveSkipNgrokWarning = skipNgrokWarning || isHealthRequest

  // If using Vite proxy with baseURL="/api", avoid accidental double prefix
  // e.g. baseURL="/api" + url="/api/sim/start" => "/api/api/sim/start"
  const base = String(config.baseURL ?? '')
  if (typeof config.url === 'string' && base.endsWith('/api') && config.url.startsWith('/api/')) {
    config.url = config.url.slice('/api'.length)
  }

  // Set JSON content-type only when sending a body.
  // (method already computed above)
  const needsJson = method === 'post' || method === 'put' || method === 'patch'
  if (needsJson) {
    config.headers = config.headers ?? {}
    if (!('Content-Type' in config.headers)) {
      config.headers['Content-Type'] = 'application/json'
    }
  } else if (config.headers && 'Content-Type' in config.headers) {
    // Avoid forcing Content-Type on GET/HEAD which can trigger preflight on some backends.
    try {
      delete config.headers['Content-Type']
    } catch {
      // ignore
    }
  }

  // ngrok free sometimes shows an HTML "browser warning" page unless this header is present.
  const proxyTarget = String(import.meta.env.VITE_API_PROXY_TARGET ?? '')
  const directTarget = String(import.meta.env.VITE_API_URL ?? '')
  const looksLikeNgrok = proxyTarget.includes('ngrok') || directTarget.includes('ngrok')
  if (looksLikeNgrok && !effectiveSkipNgrokWarning) {
    config.headers = config.headers ?? {}
    config.headers['ngrok-skip-browser-warning'] = 'true'
  }

  const token = !effectiveSkipAuth ? getToken() : null
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  } else if (isHealthRequest && config.headers) {
    // Ensure health request stays header-clean even if caller set it.
    try {
      delete config.headers.Authorization
    } catch {
      // ignore
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize common axios error shape
    const status = err?.response?.status
    if (status === 401) {
      // If backend says unauthorized, drop local auth
      try {
        localStorage.removeItem('tayka_auth_v1')
      } catch {
        // ignore
      }
    }
    return Promise.reject(err)
  }
)

export default api
