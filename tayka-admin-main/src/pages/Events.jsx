import React, { useMemo, useState } from 'react'
import { RiCalendar2Line, RiTimeLine, RiUser3Line, RiFolderLine, RiChat3Line, RiFilter3Line } from 'react-icons/ri'
import { useAppState } from '../context/AppState'

function toIsoLocal(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function timeInRange(t, from, to) {
  const tt = new Date(t).getTime()
  if (Number.isNaN(tt)) return false
  if (from) {
    const ff = new Date(from).getTime()
    if (!Number.isNaN(ff) && tt < ff) return false
  }
  if (to) {
    const zz = new Date(to).getTime()
    if (!Number.isNaN(zz) && tt > zz) return false
  }
  return true
}

export default function Events() {
  const { activity = [] } = useAppState() || {}

  const categories = useMemo(() => {
    const set = new Set()
    ;(Array.isArray(activity) ? activity : []).forEach((a) => {
      if (a?.category) set.add(String(a.category))
    })
    return Array.from(set).slice(0, 50)
  }, [activity])

  const users = useMemo(() => {
    const set = new Set()
    ;(Array.isArray(activity) ? activity : []).forEach((a) => {
      if (a?.user) set.add(String(a.user))
    })
    return Array.from(set).slice(0, 50)
  }, [activity])

  const [draft, setDraft] = useState({
    from: '',
    to: '',
    user: '',
    category: '',
    q: '',
  })
  const [filters, setFilters] = useState(draft)

  const rows = useMemo(() => {
    const list = Array.isArray(activity) ? activity : []
    const q = String(filters.q || '').trim().toLowerCase()
    const u = String(filters.user || '').trim().toLowerCase()
    const c = String(filters.category || '').trim().toLowerCase()
    return list
      .filter((a) => {
        if (!a?.time) return false
        if (!timeInRange(a.time, filters.from, filters.to)) return false
        if (u && !String(a.user || '').toLowerCase().includes(u)) return false
        if (c && String(a.category || '').toLowerCase() !== c) return false
        if (q) {
          const hay = `${a.user || ''} ${a.category || ''} ${a.comment || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .slice(0, 500)
  }, [activity, filters])

  return (
    <div>
      <h1>Sistem Kayıtları</h1>

      <div className="card-b" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RiCalendar2Line className="icon" />
            <span style={{ fontWeight: 700, opacity: 0.9 }}>Tarih Filtreleme</span>
            <input
              className="input"
              type="datetime-local"
              value={draft.from}
              onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))}
              style={{ width: 190 }}
            />
            <span style={{ opacity: 0.75 }}>—</span>
            <input
              className="input"
              type="datetime-local"
              value={draft.to}
              onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))}
              style={{ width: 190 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RiUser3Line className="icon" />
            <span style={{ fontWeight: 700, opacity: 0.9 }}>Kullanıcı</span>
            <select className="input" value={draft.user} onChange={(e) => setDraft((p) => ({ ...p, user: e.target.value }))}>
              <option value="">(Tümü)</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RiFolderLine className="icon" />
            <span style={{ fontWeight: 700, opacity: 0.9 }}>Kategori</span>
            <select className="input" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}>
              <option value="">(Tümü)</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 260px' }}>
            <RiChat3Line className="icon" />
            <span style={{ fontWeight: 700, opacity: 0.9, whiteSpace: 'nowrap' }}>Durum Yorum</span>
            <input
              className="input"
              value={draft.q}
              onChange={(e) => setDraft((p) => ({ ...p, q: e.target.value }))}
              placeholder="Ara…"
              style={{ width: '100%' }}
            />
          </div>

          <button
            className="btn"
            type="button"
            onClick={() => setFilters(draft)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RiFilter3Line /> Filtrele
          </button>
        </div>

        <div className="table-wrap" style={{ marginTop: 12, maxHeight: '62vh', overflow: 'auto' }}>
          <table className="events-table">
            <thead>
              <tr>
                <th>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <RiTimeLine /> Tarih & Saat
                  </span>
                </th>
                <th>Kullanıcı</th>
                <th>Kategori</th>
                <th>Durum Yorum</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((a, idx) => (
                  <tr key={`${a.time}-${idx}`}>
                    <td>{new Date(a.time).toLocaleString()}</td>
                    <td>{a.user || '—'}</td>
                    <td>{a.category || '—'}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{a.comment || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
