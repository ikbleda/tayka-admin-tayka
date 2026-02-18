import api from './api'
import { createApiNotConfiguredError } from './apiErrors'

// GET /users -> [{ id, name, role, status, lastLogin }]
export async function fetchUsers() {
  // Only call backend if explicitly configured.
  if (import.meta.env.VITE_USERS_PATH === undefined) throw createApiNotConfiguredError('users')
  const path = import.meta.env.VITE_USERS_PATH
  const res = await api.get(path)
  return res.data
}
