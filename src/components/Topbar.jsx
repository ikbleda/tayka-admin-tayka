import React, { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppState } from '../context/AppState'

function sectionTitleFromPath(pathname) {
  const p = String(pathname || '')
  if (p.startsWith('/operasyon')) return 'Operasyon'
  if (p.startsWith('/simulasyon')) return 'Simülasyon'
  if (p.startsWith('/gorev-ozeti')) return 'Görev Özeti'
  if (p.startsWith('/arsiv')) return 'Arşiv'
  if (p.startsWith('/yonetim')) return 'Yönetim'

  // Backward compatible routes
  if (p.startsWith('/simulation')) return 'Simülasyon'
  if (p.startsWith('/users') || p.startsWith('/events')) return 'Yönetim'
  if (p.startsWith('/logs') || p.startsWith('/dashboard') || p === '/') return 'Operasyon'
  return ''
}

function sublineFromPath(pathname) {
  const p = String(pathname || '')
  if (p.startsWith('/operasyon') || p.startsWith('/logs') || p.startsWith('/dashboard') || p === '/') {
    return 'Canlı akış • Operatör Log • Seçim merkezde'
  }
  if (p.startsWith('/simulasyon') || p.startsWith('/simulation')) {
    return 'Deterministik replay • Seed ile tekrar • Trace görüntüleme'
  }
  if (p.startsWith('/gorev-ozeti')) {
    return 'Brifing • Teknik/operasyonel kırılım'
  }
  if (p.startsWith('/arsiv')) {
    return 'Zaman damgalı görev kayıtları • Seed ile replay'
  }
  if (p.startsWith('/yonetim') || p.startsWith('/users') || p.startsWith('/events')) {
    return 'Kullanıcılar • Etkinlik yönetimi • Yetkilendirme'
  }
  return ''
}

function toneForChip(kind, value) {
  const v = String(value || '').toLowerCase()
  if (kind === 'ws') return v.includes('bağ') ? 'ok' : 'danger'
  if (kind === 'sim') return v.includes('çalış') ? 'ok' : 'warn'
  if (kind === 'approval') return v.includes('bek') ? 'warn' : 'ok'
  if (kind === 'seed') return 'info'
  return 'muted'
}

function StatusChip({ kind, text, valueForTone }) {
  const tone = toneForChip(kind, valueForTone)
  return (
    <span className={`status-chip tone-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {text}
    </span>
  )
}

export default function Topbar({ onLogout }) {
  const location = useLocation()
  const { system } = useAppState() || {}

  const title = useMemo(() => sectionTitleFromPath(location.pathname), [location.pathname])
  const subline = useMemo(() => sublineFromPath(location.pathname), [location.pathname])

  const wsText = `WS: ${system?.ws || 'kapalı'}`
  const simText = `SIM: ${system?.sim || 'boşta'}`
  const approvalText = `ONAY: ${system?.approval || 'kapalı'}`
  const seedValue = system?.seed
  const seedText = seedValue ? `Seed: ${seedValue}` : null

  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <img className="topbar-logo" src="/logo.png" alt="AŞİNA TAYKA" />
        <div className="topbar-brandblock">
          <div className="topbar-titleRow">
            <div className="topbar-brand">AŞİNA TAYKA C2</div>
            {title ? <span className="topbar-sep" aria-hidden="true">-</span> : null}
            {title ? <div className="topbar-section">{title}</div> : null}
          </div>
          {subline ? <div className="topbar-subline">{subline}</div> : null}
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-status" aria-label="Sistem durumu">
          <StatusChip kind="ws" text={wsText} valueForTone={system?.ws} />
          <StatusChip kind="sim" text={simText} valueForTone={system?.sim} />
          <StatusChip kind="approval" text={approvalText} valueForTone={system?.approval} />
          {seedText ? <StatusChip kind="seed" text={seedText} valueForTone={seedValue} /> : null}
        </div>

        <button onClick={onLogout} className="btn small" type="button">
          Çıkış
        </button>
      </div>
    </header>
  )
}