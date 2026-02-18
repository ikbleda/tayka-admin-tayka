import React, { useEffect, useMemo, useState } from 'react'
import usersData from '../data/users.json'
import { fetchUsers } from '../services/usersApi'
import { isApiNotConfiguredError } from '../services/apiErrors'
import { createLocalUser, listLocalUsers } from '../utils/auth'
import { ROLES, roleLabel } from '../utils/rbac'

function getEnvBool(name, defaultValue = false) {
  const raw = import.meta.env[name]
  if (raw === undefined) return defaultValue
  const v = String(raw).toLowerCase().trim()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export default function UserTable() {
  const seed = useMemo(() => (Array.isArray(usersData) ? usersData : []), [])
  const [users, setUsers] = useState(seed)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const useLocal = getEnvBool('VITE_USE_FAKE_AUTH', false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState(ROLES.OBSERVER)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)

        if (useLocal) {
          const local = listLocalUsers?.() || []
          if (!cancelled) setUsers(Array.isArray(local) ? local : [])
          return
        }

        const data = await fetchUsers()
        if (!cancelled) setUsers(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) {
          if (isApiNotConfiguredError(e)) {
            setError(null)
            setUsers(seed)
          } else {
            setError(e)
            // fallback to bundled data
            setUsers(seed)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [seed, useLocal])

  function refreshLocal() {
    const local = listLocalUsers?.() || []
    setUsers(Array.isArray(local) ? local : [])
  }

  function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    const res = createLocalUser?.({ username: newUsername, password: newPassword, role: newRole })
    if (!res?.ok) {
      setCreateError(res?.message || 'Kullanıcı oluşturulamadı')
      return
    }
    setNewUsername('')
    setNewPassword('')
    setNewRole(ROLES.OBSERVER)
    refreshLocal()
  }

  if (loading) return <div>Yükleniyor...</div>
  if (error) return <div className="error">Hata: {error.message || 'Backend erişilemedi'} (fallback: lokal veri)</div>

  return (
    <div>
      {useLocal ? (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 800, opacity: 0.9, marginRight: 6 }}>Yeni Kullanıcı</div>
          <input className="input" placeholder="kullanıcı adı" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ maxWidth: 180 }} />
          <input className="input" placeholder="şifre" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ maxWidth: 180 }} />
          <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ maxWidth: 180 }}>
            <option value={ROLES.COMMANDER}>{roleLabel(ROLES.COMMANDER)}</option>
            <option value={ROLES.OPERATOR}>{roleLabel(ROLES.OPERATOR)}</option>
            <option value={ROLES.ANALYST}>{roleLabel(ROLES.ANALYST)}</option>
            <option value={ROLES.OBSERVER}>{roleLabel(ROLES.OBSERVER)}</option>
            <option value={ROLES.ADMIN}>{roleLabel(ROLES.ADMIN)}</option>
          </select>
          <button className="btn" type="submit">Oluştur</button>
          {createError ? <div className="error" style={{ marginTop: 0 }}>{createError}</div> : null}
        </form>
      ) : null}

      <div className="table-wrap" style={{ marginTop: 0 }}>
        <table className="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Kullanıcı</th>
            <th>Rol</th>
            <th>Durum</th>
            <th>Son giriş tarihi</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={5} className="table-empty">Kullanıcı bulunamadı</td>
            </tr>
          ) : (
            users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username || u.name || '-'}</td>
                <td>{roleLabel(u.role) || u.role}</td>
                <td>{u.status}</td>
                <td>{u.lastLogin || u.last_login || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}