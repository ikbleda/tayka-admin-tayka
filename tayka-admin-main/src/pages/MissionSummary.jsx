import React, { useMemo } from 'react'
import { useAppState } from '../context/AppState'

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function labelOutcome(outcome) {
  const o = String(outcome || '').toLowerCase()
  if (!o) return '—'
  if (o.includes('başar') || o.includes('success')) return 'Başarılı'
  if (o.includes('başarıs') || o.includes('fail')) return 'Başarısız'
  return String(outcome)
}

export default function MissionSummary() {
  const { runs = [] } = useAppState()

  const rows = useMemo(() => {
    const list = Array.isArray(runs) ? runs : []
    return list.slice(0, 50)
  }, [runs])

  return (
    <div>
      <h1>Görev Özeti</h1>

      <div className="card-b" style={{ padding: 12 }}>
        {rows.length === 0 ? (
          <p className="hint">Henüz geçmiş görev kaydı yok.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 0 }}>
            <table className="events-table">
              <thead>
                <tr>
                  <th>Seed</th>
                  <th>Tarih / Saat</th>
                  <th>Sonuç</th>
                  <th>Fail-silent</th>
                  <th>Mühimmat</th>
                  <th>Enerji</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.seed || '—'}</td>
                    <td>{formatTime(r.startedAt)}</td>
                    <td>{labelOutcome(r.outcome)}</td>
                    <td>{r.failSilentReason || '—'}</td>
                    <td>{r.ammo || '—'}</td>
                    <td>{r.energy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
