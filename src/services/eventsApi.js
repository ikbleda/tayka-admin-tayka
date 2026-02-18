import api from './api'
import { createApiNotConfiguredError } from './apiErrors'

// GET /events -> [{ id, time, type, level, status, source }]
export async function fetchEvents() {
  // Only call backend if explicitly configured.
  if (import.meta.env.VITE_EVENTS_PATH === undefined) throw createApiNotConfiguredError('events')
  const path = import.meta.env.VITE_EVENTS_PATH
  const res = await api.get(path)
  return res.data
}

// PATCH /events/:id -> { status }
export async function patchEventStatus(id, status) {
  if (import.meta.env.VITE_EVENTS_PATH === undefined) throw createApiNotConfiguredError('events')
  const base = import.meta.env.VITE_EVENTS_PATH
  const res = await api.patch(`${base}/${encodeURIComponent(id)}`, { status })
  return res.data
}
