import api from './api'

function p(name, fallback) {
  return import.meta.env[name] || fallback
}

export async function health() {
  const envPath = import.meta.env.VITE_HEALTH_PATH
  const usingServerlessProxy = import.meta.env.PROD && !import.meta.env.VITE_API_URL
  const path = usingServerlessProxy && (!envPath || envPath === '/health') ? '/api/health' : p('VITE_HEALTH_PATH', '/health')
  const res = await api.get(path, { skipAuth: true, skipNgrokWarning: true })
  return res.data
}

export async function startSim({ seed } = {}) {
  const body = {}
  if (seed !== undefined && seed !== null && seed !== '') body.seed = Number(seed)
  const res = await api.post(p('VITE_SIM_START_PATH', '/api/sim/start'), Object.keys(body).length ? body : {})
  return res.data
}

export async function approveSim({ selectedModule }) {
  const res = await api.post(p('VITE_SIM_APPROVE_PATH', '/api/sim/approve'), { selectedModule })
  return res.data
}

export async function abortSim() {
  const res = await api.post(p('VITE_SIM_ABORT_PATH', '/api/sim/abort'))
  return res.data
}
