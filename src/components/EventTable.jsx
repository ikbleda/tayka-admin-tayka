import React from 'react'
import { useAppState } from '../context/AppState'

const STATUS_FLOW = ['Detected', 'In Progress', 'Resolved']

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function labelType(type) {
  const t = String(type || '')
  const map = {
    SIM_STARTED: 'Simülasyon Başladı',
    SIM_RECOMMENDATION: 'Simülasyon Önerisi',
    WAIT_FOR_APPROVAL: 'Onay Bekleniyor',
    SIM_ENGAGEMENT: 'Angajman',
    SIM_TARGET_NEUTRALIZED: 'Hedef Etkisiz',
    SIM_END: 'Simülasyon Bitti',
  }
  if (map[t]) return map[t]
  if (t.startsWith('SIM_')) return `Simülasyon: ${t.slice(4)}`
  return t
}

function labelStatus(status) {
  const s = String(status || '')
  const map = {
    Detected: 'Tespit',
    'In Progress': 'Devam Ediyor',
    Resolved: 'Çözüldü',
  }
  return map[s] || s
}

function labelLevel(level) {
  const l = String(level || '')
  const map = {
    Low: 'Düşük',
    Medium: 'Orta',
    High: 'Yüksek',
  }
  return map[l] || l
}

export default function EventTable({ onRowClick, showSeed = false } = {}) {
  const { events = [], updateEventStatus } = useAppState()

  function nextStatus(current) {
    const i = STATUS_FLOW.indexOf(current)
    if (i === -1) return STATUS_FLOW[0]
    return STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)]
  }

  if (!events) return <div>Yükleniyor...</div>

  return (
    <div className="table-wrap">
      <table className="events-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tarih</th>
            <th>Tip</th>
            <th>Seviye</th>
            <th>Durum</th>
            <th>Kaynak</th>
            {showSeed ? <th>Seed</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={showSeed ? 7 : 6} className="table-empty">Kayıt bulunamadı</td>
            </tr>
          ) : (
            events.map((e) => (
              <tr
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (typeof onRowClick === 'function') onRowClick(e)
                  else updateEventStatus(e.id, nextStatus(e.status))
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    if (typeof onRowClick === 'function') onRowClick(e)
                    else updateEventStatus(e.id, nextStatus(e.status))
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <td>{e.id}</td>
                <td>{formatTime(e.time)}</td>
                <td>{labelType(e.type)}</td>
                <td>{labelLevel(e.level)}</td>
                <td>{labelStatus(e.status)}</td>
                <td>{e.source}</td>
                {showSeed ? <td>{e.seed || ''}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}