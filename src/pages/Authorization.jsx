import React from 'react'
import { deleteLocalUser, listLocalUsers, setLocalUserRole } from '../utils/auth'
import { ROLES, roleLabel } from '../utils/rbac'

function getEnvBool(name, defaultValue = false) {
  const raw = import.meta.env[name]
  if (raw === undefined) return defaultValue
  const v = String(raw).toLowerCase().trim()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export default function Authorization() {
  const useLocal = getEnvBool('VITE_USE_FAKE_AUTH', false)
  const [users, setUsers] = React.useState(() => (useLocal ? listLocalUsers?.() || [] : []))
  const [err, setErr] = React.useState('')

  React.useEffect(() => {
    if (!useLocal) return
    try {
      setUsers(listLocalUsers?.() || [])
    } catch {
      setUsers([])
    }
  }, [useLocal])

  function refresh() {
    setUsers(listLocalUsers?.() || [])
  }

  function onRoleChange(id, role) {
    setErr('')
    try {
      setLocalUserRole?.(id, role)
      refresh()
    } catch {
      setErr('Rol güncellenemedi')
    }
  }

  function onDelete(id) {
    setErr('')
    try {
      deleteLocalUser?.(id)
      refresh()
    } catch {
      setErr('Kullanıcı silinemedi')
    }
  }

  return (
    <div>
      <h1>Yetkilendirme</h1>
      <div className="card-b" style={{ padding: 16 }}>
        {!useLocal ? (
          <p className="hint">Backend yetkilendirme henüz bağlı değil.</p>
        ) : (
          <>
            {err ? <div className="error" style={{ marginTop: 0 }}>{err}</div> : null}
            <div className="table-wrap" style={{ marginTop: 0 }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Kullanıcı</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(users) && users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username || '-'}</td>
                        <td>
                          <select className="input" value={u.role || ROLES.OBSERVER} onChange={(e) => onRoleChange(u.id, e.target.value)}>
                            <option value={ROLES.ADMIN}>{roleLabel(ROLES.ADMIN)}</option>
                            <option value={ROLES.COMMANDER}>{roleLabel(ROLES.COMMANDER)}</option>
                            <option value={ROLES.OPERATOR}>{roleLabel(ROLES.OPERATOR)}</option>
                            <option value={ROLES.ANALYST}>{roleLabel(ROLES.ANALYST)}</option>
                            <option value={ROLES.OBSERVER}>{roleLabel(ROLES.OBSERVER)}</option>
                          </select>
                        </td>
                        <td>{u.status || 'Aktif'}</td>
                        <td>
                          <button className="btn small" type="button" onClick={() => onDelete(u.id)}>Sil</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="table-empty">Kullanıcı yok</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
