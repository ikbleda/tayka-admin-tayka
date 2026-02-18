import api from './api'
import { createApiNotConfiguredError } from './apiErrors'

// GET {VITE_RUNS_PATH} -> [{ id, context, seed, startedAt, endedAt, outcome, failSilentReason, ammo, energy, durationSec, logs? }]
export async function fetchRuns() {
  // Only call backend if explicitly configured.
  const raw = import.meta.env.VITE_RUNS_PATH
  const path = String(raw || '').trim()
  if (!path) throw createApiNotConfiguredError('runs')
  const res = await api.get(path)
  return res.data
}
