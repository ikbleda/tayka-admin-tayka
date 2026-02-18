import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppState } from '../context/AppState'

function formatTimeOnly(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleTimeString()
}

function getLogTime(line) {
  return line?.time || line?.ts || line?.timestamp || null
}


function getLogMessage(line) {
  return line?.message || line?.msg || line?.text || ''
}

export default function Archive() {
  const { runs = [] } = useAppState()
  const [searchParams, setSearchParams] = useSearchParams()

  const seedParam = searchParams.get('seed') || ''
  const [seed, setSeed] = useState(seedParam)

  const selectedRun = useMemo(() => {
    const list = Array.isArray(runs) ? runs : []
    if (!seed) return list[0] || null
    const s = String(seed)

    const matches = list.filter((r) => String(r?.seed ?? '') === s)
    if (matches.length === 0) return null

    // runs are stored newest-first; pick first match
    return matches[0]
  }, [runs, seed])

  const logRows = useMemo(() => {
    const lines = selectedRun?.logs
    return Array.isArray(lines) ? lines.slice(-2000) : []
  }, [selectedRun])

  function onSeedChange(e) {
    const v = e.target.value
    setSeed(v)
    const next = new URLSearchParams(searchParams)
    if (v) next.set('seed', v)
    else next.delete('seed')
    setSearchParams(next)
  }

  return (
    <div>
      <h1>Kayıt Seyri</h1>
      <div className="card-b" style={{ padding: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600 }}>Seed</div>
          <input className="input" value={seed} onChange={onSeedChange} placeholder="örn: 12345" style={{ maxWidth: 320 }} />
        </div>

        {!selectedRun ? (
          <p className="hint" style={{ marginTop: 10 }}>Bu seed için kayıt bulunamadı.</p>
        ) : (
          <>
            <div className="table-wrap" style={{ marginTop: 10, maxHeight: '60vh', overflow: 'auto' }}>
              <table className="events-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Zaman</th>
                    <th>Mesaj</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((line, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatTimeOnly(getLogTime(line))}</td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{getLogMessage(line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
