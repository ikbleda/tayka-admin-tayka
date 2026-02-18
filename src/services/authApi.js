import api from './api'

// Backend contract (typical):
// POST /auth/login  { email, password } -> { token, user? }
// POST /auth/logout -> 200
// GET  /auth/me     -> { email, ... }

function p(name, fallback) {
  return import.meta.env[name] || fallback
}

export async function loginRequest({ email, password }) {
  const res = await api.post(p('VITE_AUTH_LOGIN_PATH', '/auth/login'), { email, password })
  return res.data
}

export async function logoutRequest() {
  const res = await api.post(p('VITE_AUTH_LOGOUT_PATH', '/auth/logout'))
  return res.data
}

export async function meRequest() {
  const res = await api.get(p('VITE_AUTH_ME_PATH', '/auth/me'))
  return res.data
}
