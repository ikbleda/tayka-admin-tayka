import { loginRequest, logoutRequest } from '../services/authApi'
import { normalizeTrAscii, ROLES } from './rbac'

const AUTH_KEY = 'tayka_auth_v1'
const USERS_KEY = 'tayka_users_v1'

function setAuth(payload) {
	localStorage.setItem(AUTH_KEY, JSON.stringify(payload))
}

function getEnvBool(name, defaultValue = false) {
	const raw = import.meta.env[name]
	if (raw === undefined) return defaultValue
	const v = String(raw).toLowerCase().trim()
	return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function getFakeCreds() {
	return {
		email: import.meta.env.VITE_FAKE_EMAIL || 'admin@tayka.com',
		password: import.meta.env.VITE_FAKE_PASSWORD || 'tayka123',
	}
}

function safeJsonParse(raw, fallback) {
	try {
		return JSON.parse(raw)
	} catch {
		return fallback
	}
}

function defaultLocalUsers() {
	// Kullanıcı adı / şifreler: yonetici/komutan/operator/analist/gozlemci + 1881
	return [
		{ id: 1, username: 'yonetici', role: ROLES.ADMIN, password: 'yonetici1881', status: 'Aktif', lastLogin: null },
		{ id: 2, username: 'komutan', role: ROLES.COMMANDER, password: 'komutan1881', status: 'Aktif', lastLogin: null },
		{ id: 3, username: 'operator', role: ROLES.OPERATOR, password: 'operator1881', status: 'Aktif', lastLogin: null },
		{ id: 4, username: 'analist', role: ROLES.ANALYST, password: 'analist1881', status: 'Aktif', lastLogin: null },
		{ id: 5, username: 'gozlemci', role: ROLES.OBSERVER, password: 'gozlemci1881', status: 'Aktif', lastLogin: null },
	]
}

function loadLocalUsers() {
	if (typeof window === 'undefined') return defaultLocalUsers()
	const raw = window.localStorage.getItem(USERS_KEY)
	if (!raw) return defaultLocalUsers()
	const parsed = safeJsonParse(raw, null)
	return Array.isArray(parsed) ? parsed : defaultLocalUsers()
}

function saveLocalUsers(users) {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(USERS_KEY, JSON.stringify(Array.isArray(users) ? users : []))
	} catch {
		// ignore
	}
}

export function ensureDefaultUsers() {
	if (typeof window === 'undefined') return
	const raw = window.localStorage.getItem(USERS_KEY)
	if (raw) return
	saveLocalUsers(defaultLocalUsers())
}

export function listLocalUsers() {
	ensureDefaultUsers()
	return loadLocalUsers()
}

export function createLocalUser({ username, password, role } = {}) {
	ensureDefaultUsers()
	const u = String(username || '').trim()
	const p = String(password || '')
	if (!u) return { ok: false, message: 'Kullanıcı adı boş olamaz' }
	if (!p) return { ok: false, message: 'Şifre boş olamaz' }
	const normalized = normalizeTrAscii(u)
	const users = loadLocalUsers()
	if (users.some((x) => normalizeTrAscii(x?.username) === normalized)) {
		return { ok: false, message: 'Bu kullanıcı adı zaten var' }
	}
	const nextId = users.reduce((m, x) => Math.max(m, Number(x?.id) || 0), 0) + 1
	const next = [
		...users,
		{ id: nextId, username: normalized, role: role || ROLES.OBSERVER, password: p, status: 'Aktif', lastLogin: null },
	]
	saveLocalUsers(next)
	return { ok: true }
}

export function deleteLocalUser(id) {
	ensureDefaultUsers()
	const users = loadLocalUsers()
	const next = users.filter((u) => u?.id !== id)
	saveLocalUsers(next)
	return { ok: true }
}

export function setLocalUserRole(id, role) {
	ensureDefaultUsers()
	const users = loadLocalUsers()
	const next = users.map((u) => (u?.id === id ? { ...u, role: role || ROLES.OBSERVER } : u))
	saveLocalUsers(next)
	return { ok: true }
}

export function updateLocalUserLastLogin(username) {
	ensureDefaultUsers()
	const users = loadLocalUsers()
	const normalized = normalizeTrAscii(username)
	const now = new Date().toISOString()
	const next = users.map((u) => (normalizeTrAscii(u?.username) === normalized ? { ...u, lastLogin: now } : u))
	saveLocalUsers(next)
}

function fakeLogin({ email, password }) {
	ensureDefaultUsers()
	const identifier = String(email || '').trim()
	const pass = String(password || '')
	const normalized = normalizeTrAscii(identifier)
	const users = loadLocalUsers()
	const found = users.find((u) => normalizeTrAscii(u?.username) === normalized)
	if (found && String(found.password || '') === pass) {
		updateLocalUserLastLogin(found.username)
		const payload = {
			email: found.username,
			username: found.username,
			role: found.role,
			token: 'local-fake-token',
			loggedAt: Date.now(),
			mode: 'local',
		}
		setAuth(payload)
		return { ok: true }
	}

	// Legacy fallback: env-defined single fake account.
	const creds = getFakeCreds()
	if (identifier === creds.email && pass === creds.password) {
		const payload = { email: identifier, username: identifier, role: ROLES.ADMIN, token: 'fake-jwt-token', loggedAt: Date.now(), mode: 'fake' }
		setAuth(payload)
		return { ok: true }
	}
	return { ok: false, message: 'Geçersiz kullanıcı adı veya şifre' }
}

export async function login({ email, password }) {
	const useFake = getEnvBool('VITE_USE_FAKE_AUTH', false)
	if (useFake) return fakeLogin({ email, password })

	try {
		const data = await loginRequest({ email, password })
		// Accept either token-based or cookie-based response
		const token = data?.token ?? data?.accessToken ?? null
		const userEmail = data?.user?.email ?? data?.email ?? email
		setAuth({ email: userEmail, token, loggedAt: Date.now(), mode: 'backend' })
		return { ok: true }
	} catch (err) {
		// Fallback to fake if explicitly enabled via env, otherwise show backend error
		const allowFallback = getEnvBool('VITE_ALLOW_FAKE_FALLBACK', false)
		if (allowFallback) return fakeLogin({ email, password })

		const backendMsg = err?.response?.data?.message
		const msg = backendMsg || 'Giriş başarısız (backend). API URL / CORS / endpoint kontrol edin.'
		return { ok: false, message: msg }
	}
}

export async function logout() {
	try {
		await logoutRequest()
	} catch {
		// ignore
	}
	localStorage.removeItem(AUTH_KEY)
}

export function isAuthenticated() {
	try {
		const raw = localStorage.getItem(AUTH_KEY)
		if (!raw) return false
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') {
			localStorage.removeItem(AUTH_KEY)
			return false
		}

		// Basic shape validation: must have an identifier and a login timestamp.
		const ident = String(parsed.username || parsed.email || '').trim()
		const loggedAt = Number(parsed.loggedAt)
		if (!ident || !Number.isFinite(loggedAt) || loggedAt <= 0) {
			localStorage.removeItem(AUTH_KEY)
			return false
		}

		// Optional expiry support.
		const expiresAt = parsed.expiresAt != null ? Number(parsed.expiresAt) : null
		if (expiresAt && Number.isFinite(expiresAt) && Date.now() > expiresAt) {
			localStorage.removeItem(AUTH_KEY)
			return false
		}

		return true
	} catch {
		try {
			localStorage.removeItem(AUTH_KEY)
		} catch {
			// ignore
		}
		return false
	}
}

export function getAuth() {
	try {
		const parsed = JSON.parse(localStorage.getItem(AUTH_KEY))
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}

export function getRole() {
	const a = getAuth()
	if (a?.role) return a.role
	const ident = normalizeTrAscii(a?.username || a?.email || '')
	if (ident === 'admin' || ident === 'admin@tayka.com') return ROLES.ADMIN
	return ROLES.OBSERVER
}

// Seed defaults ASAP in fake mode so Management screens have data.
try {
	const useFake = getEnvBool('VITE_USE_FAKE_AUTH', false)
	if (useFake) ensureDefaultUsers()
} catch {
	// ignore
}