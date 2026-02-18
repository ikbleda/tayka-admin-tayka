import React, { useEffect, useMemo, useRef } from 'react'

function fmtTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return String(t)
  return d.toLocaleTimeString()
}

function stripSimPrefix(msg) {
  // Example: "SIM_ENGAGEMENT: ── FAZ 1 ..." -> "── FAZ 1 ..."
  return String(msg ?? '').replace(/^SIM_[A-Z0-9_]+:\s*/i, '')
}

function toneForLogLine(msg) {
  const t = String(msg || '').toLowerCase()
  if (!t) return 'muted'
  if (t.includes('failed') || t.includes('error') || t.includes('hata') || t.includes('başarısız')) return 'danger'
  if (t.includes('warn') || t.includes('uyarı') || t.includes('bekleniyor') || t.includes('timeout') || t.includes('zaman aşımı')) return 'warn'
  if (t.includes('ok') || t.includes('connected') || t.includes('başarılı') || t.includes('kopyalandı')) return 'ok'
  return 'info'
}

function ModuleRow({ k, v }) {
  return (
    <div className="module-row">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  )
}

function ModuleCard({ name, active, onSelect, fitText = 'UYGUN DEĞİL', metrics, yura }) {
  const m = metrics || {}
  const isYura = name === 'YURA'

  return (
    <div className={active ? 'module-card active' : 'module-card'}>
      <div className="module-card-top">
        <div className="module-name">{name}</div>
        {fitText ? <div className="module-fit">{fitText}</div> : null}
      </div>

      {!isYura ? (
        <div className="module-rows">
          <ModuleRow k="Başarı" v={m.success ?? '0%'} />
          <ModuleRow k="Süre" v={m.duration ?? '0 sn'} />
          <ModuleRow k="Maliyet" v={m.cost ?? '0 ₺'} />
          <ModuleRow k="Durum" v={m.status ?? 'Uygun değil'} />
        </div>
      ) : (
        <>
          <button type="button" className="module-yura-activate" onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSelect?.()
          }} disabled={!onSelect} aria-disabled={!onSelect}>
            YURA AKTİF ET
          </button>

          <div className="module-rows" style={{ marginTop: 8 }}>
            <ModuleRow k="Güncel Durum" v={yura?.currentStatus ?? 'PASİF'} />
            <ModuleRow k="Uygunluk" v={yura?.fitness ?? 'Uygun değil'} />
          </div>

          <div className="module-yura-actions">
            <button type="button" className="module-yura-btn">BAŞARILI</button>
            <button type="button" className="module-yura-btn">BAŞARISIZ</button>
          </div>
        </>
      )}

      <button type="button" className="module-hit" onClick={onSelect} aria-label={`${name} seç`} disabled={!onSelect} aria-disabled={!onSelect} />
    </div>
  )
}

function upperTr(value) {
  return String(value ?? '').toLocaleUpperCase('tr-TR')
}

const SAMPLE_STATUS = {
  threat: {
    title: 'Seyir Füzesi Tehdidi',
    tag: 'Seyir Füzesi',
    type: 'CRUISE_MISSILE',
  },
  classification: {
    level: 'YÜKSEK',
    alert: 'ACİL UYARI',
  },
  trace: {
    ayaz: '76%',
    note: 'İz stabil',
  },
  environment: {
    status: 'Parçalı bulutlu',
    wind: '7.1 m/s',
    visibility: '15.6 km',
  },
  resource: {
    BORAN: 'UYGUN (mühimmat=3)',
    ALBATUR: 'UYGUN (enerji=51%)',
    KARMA: 'UYGUN DEĞİL',
    YURA: 'UYGUN • PASİF',
  },
}

export default function OperatorConsole({
  title,
  subtitle,
  seed,
  onSeedChange,
  seedEditable = true,
  threatLevel = '-',
  statusData,
  fazText = '-',
  secondsText = '15 sn',
  onStart,
  onApprove,
  onEnd,
  busy,
  approvalDisabled,
  selectedModule,
  onSelectModule,
  system,
  recommendation,
  logLines,
  onCopyLogs,
  startDisabled = false,
  approveDisabled = false,
  endDisabled = false,
  moduleSelectDisabled = false,
}) {
  const bottomRef = useRef(null)

  const liveFromLogs = useMemo(() => {
    const list = Array.isArray(logLines) ? logLines : []
    const last = list.slice(-200)

    const out = {
      recommended: null,
      alternative: null,
      fitByModule: {},
    }

    const moduleRe = /\b(BORAN|ALBATUR|KARMA|YURA)\b/i
    for (let i = last.length - 1; i >= 0; i -= 1) {
      const raw = String(last[i]?.message ?? '')
      const msg = stripSimPrefix(raw)
      const lower = msg.toLowerCase()

      // Capture recommendation lines if present
      if (!out.recommended && (lower.includes('öner') || lower.includes('recommend'))) {
        const m = msg.match(moduleRe)
        if (m) out.recommended = m[1].toUpperCase()
      }
      if (!out.alternative && (lower.includes('altern') || lower.includes('alt'))) {
        const m = msg.match(moduleRe)
        if (m) out.alternative = m[1].toUpperCase()
      }

      // Capture per-module fitness if present: "BORAN: UYGUN" / "KARMA - UYGUN DEĞİL" etc.
      const fm = msg.match(/^\s*(BORAN|ALBATUR|KARMA|YURA)\s*[-:]\s*(.+?)\s*$/i)
      if (fm) {
        const key = fm[1].toUpperCase()
        const val = String(fm[2] || '').trim()
        if (!out.fitByModule[key]) out.fitByModule[key] = val
      }

      if (out.recommended && out.alternative) break
    }

    return out
  }, [logLines])
  const printableLogs = useMemo(() => {
    const list = Array.isArray(logLines) ? logLines : []
    return list
      .map((l) => {
        const time = fmtTime(l?.time)
        const msg = stripSimPrefix(String(l?.message ?? ''))
        const tone = toneForLogLine(msg)
        return { time, msg, tone }
      })
      .filter((x) => x && (x.msg || x.time))
  }, [logLines])

  const copyText = useMemo(() => {
    return printableLogs
      .map((l) => (l.time ? `[${l.time}] ${l.msg}` : l.msg))
      .filter(Boolean)
      .join('\n')
  }, [printableLogs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [printableLogs.length])

  const s = statusData || SAMPLE_STATUS
  const recoText = recommendation?.recommended ?? recommendation?.text ?? ''
  const recoShortText = recoText ? String(recoText).split('\n')[0].trim() : ''
  const altShortText = recommendation?.alternative ? String(recommendation.alternative).trim() : ''

  const recoModule = liveFromLogs.recommended || (recoShortText.match(/\b(BORAN|ALBATUR|KARMA|YURA)\b/i)?.[1] || null)
  const altModule = liveFromLogs.alternative || (altShortText.match(/\b(BORAN|ALBATUR|KARMA|YURA)\b/i)?.[1] || null)

  const recoShort = recoModule ? recoModule : (recoShortText || '-')
  const altShort = altModule ? altModule : (altShortText || '-')

  function fitFor(moduleName) {
    const key = String(moduleName || '').toUpperCase()
    if (liveFromLogs.fitByModule?.[key]) return liveFromLogs.fitByModule[key]
    if (recoModule && key === String(recoModule).toUpperCase()) return 'ÖNERİLEN'
    if (altModule && key === String(altModule).toUpperCase()) return 'ALTERNATİF'
    return 'UYGUN DEĞİL'
  }

  const moduleDisabled = !!busy || !!moduleSelectDisabled
  const onSelectIfAllowed = (m) => {
    if (moduleDisabled) return
    onSelectModule?.(m)
  }

  return (
    <div className="console-root">
      <div className="console-header">
        <div className="console-headleft" aria-label="Seed ve tehdit seviyesi">
          {seedEditable ? (
            <div className="console-seed">
              <div className="console-label">Seed</div>
              <input
                className="input console-seed-input"
                value={seed}
                onChange={(e) => onSeedChange?.(e.target.value)}
                placeholder="örn: 12345"
                inputMode="numeric"
                disabled={busy}
              />
            </div>
          ) : (
            <div className="console-chip seed">Seed: {seed ? seed : '—'}</div>
          )}

          <div className="console-threat" role="status" aria-label="Tehdit seviyesi">
            <span className="console-threat-icon" aria-hidden="true">!</span>
            TEHDİT: {threatLevel || '-'}
          </div>
        </div>

        <div className="console-controls">
          <div className="console-chip">FAZ: {fazText}</div>
          <div className="console-chip seconds">{secondsText}</div>

          <button type="button" className="btn" onClick={onStart} disabled={busy || startDisabled}>
            Başlat
          </button>
          <button type="button" className="btn" onClick={onApprove} disabled={busy || approvalDisabled || approveDisabled}>
            Onayla
          </button>
          <button type="button" className="btn" onClick={onEnd} disabled={busy || endDisabled}>
            Bitir
          </button>
        </div>
      </div>

      <div className="console-grid">
        <aside className="card-a console-status">
          <div className="console-status-head">
            <div className="panel-title">DURUM PANOSU</div>
            <div className="console-status-tabs">Tehdit / Ortam / Kaynak / Sistem</div>
          </div>

          <div className="status-section status-threat">
            <div className="status-section-top">
              <div className="h">TEHDİT</div>
              <div className="r">Sınıflandırma net</div>
            </div>
            <div className="status-row"><div className="k">Başlık</div><div className="v">{s?.threat?.title ?? '-'}</div></div>
            <div className="status-row"><div className="k">Etiket</div><div className="v">{s?.threat?.tag ?? '-'}</div></div>
            <div className="status-row"><div className="k">Tip</div><div className="v">{s?.threat?.type ?? '-'}</div></div>
          </div>

          <div className="status-section">
            <div className="status-section-top">
              <div className="h">SINIFLANDIRMA</div>
              <div className="r">Düşük / Orta / Yüksek / Çok Yüksek</div>
            </div>
            <div className="status-row"><div className="k">Seviye</div><div className="v">{s?.classification?.level ?? '-'}</div></div>
            <div className="status-row"><div className="k">Uyarı</div><div className="v">{s?.classification?.alert ?? '-'}</div></div>
          </div>

          <div className="status-section">
            <div className="status-section-top">
              <div className="h">İZ KALİTESİ</div>
              <div className="r">AYAZ güven</div>
            </div>
            <div className="status-row"><div className="k">AYAZ</div><div className="v">{s?.trace?.ayaz ?? '-'}</div></div>
            <div className="status-row"><div className="k">Not</div><div className="v">{s?.trace?.note ?? '-'}</div></div>
          </div>

          <div className="status-section">
            <div className="status-section-top">
              <div className="h">ORTAM</div>
              <div className="r">Koşullar</div>
            </div>
            <div className="status-row"><div className="k">Durum</div><div className="v">{s?.environment?.status ?? '-'}</div></div>
            <div className="status-row"><div className="k">Rüzgâr</div><div className="v">{s?.environment?.wind ?? '-'}</div></div>
            <div className="status-row"><div className="k">Görüş</div><div className="v">{s?.environment?.visibility ?? '-'}</div></div>
          </div>

          <div className="status-section">
            <div className="status-section-top">
              <div className="h">KAYNAK</div>
              <div className="r">Kilit panel</div>
            </div>
            <div className="status-row"><div className="k">BORAN</div><div className="v">{s?.resource?.BORAN ?? '-'}</div></div>
            <div className="status-row"><div className="k">ALBATUR</div><div className="v">{s?.resource?.ALBATUR ?? '-'}</div></div>
            <div className="status-row"><div className="k">KARMA</div><div className="v">{s?.resource?.KARMA ?? '-'}</div></div>
            <div className="status-row"><div className="k">YURA</div><div className="v">{s?.resource?.YURA ?? '-'}</div></div>
          </div>

          <div className="status-section">
            <div className="status-section-top">
              <div className="h">SİSTEM</div>
              <div className="r">Operasyon durumu</div>
            </div>
            <div className="status-row"><div className="k">Oturum</div><div className="v">{upperTr(system?.sim || 'boşta')}</div></div>
            <div className="status-row"><div className="k">Onay</div><div className="v">{upperTr(system?.approval || 'kapalı')}</div></div>
          </div>
        </aside>

        <section className="card-a console-main">
          <div className="console-main-head">
            <div className="panel-title">SEÇİM &amp; OPERATÖR LOG</div>
            <div className="console-logfont">Log font: 16px</div>
          </div>

          <div className="panel-title" style={{ marginTop: 10, fontSize: 12, opacity: 0.92 }}>MODÜL SEÇİMİ</div>
          <div className="console-recoLines">
            <div className="console-recoLine">ÖNERİ: {recoShort || '-'}</div>
            <div className="console-recoLine">ALTERNATİF: {altShort || '-'}</div>
          </div>

          <div className="console-modules">
            <ModuleCard
              name="BORAN"
              active={selectedModule === 'BORAN'}
              fitText={fitFor('BORAN')}
              metrics={recommendation?.metricsByModule?.BORAN}
              onSelect={moduleDisabled ? null : () => onSelectIfAllowed('BORAN')}
            />
            <ModuleCard
              name="ALBATUR"
              active={selectedModule === 'ALBATUR'}
              fitText={fitFor('ALBATUR')}
              metrics={recommendation?.metricsByModule?.ALBATUR}
              onSelect={moduleDisabled ? null : () => onSelectIfAllowed('ALBATUR')}
            />
            <ModuleCard
              name="KARMA"
              active={selectedModule === 'KARMA'}
              fitText={fitFor('KARMA')}
              metrics={recommendation?.metricsByModule?.KARMA}
              onSelect={moduleDisabled ? null : () => onSelectIfAllowed('KARMA')}
            />
            <ModuleCard
              name="YURA"
              active={selectedModule === 'YURA'}
              fitText={fitFor('YURA')}
              yura={{ currentStatus: 'PASİF', fitness: 'Uygun değil' }}
              onSelect={moduleDisabled ? null : () => onSelectIfAllowed('YURA')}
            />
          </div>

          <div className="console-logtools">
            <button type="button" className="btn small" onClick={() => onCopyLogs?.(copyText)}>
              Log Kopyala
            </button>
          </div>

          <div className="console-logbox">
            {printableLogs.length === 0 ? (
              <div className="hint" style={{ marginTop: 0 }}>Henüz log yok.</div>
            ) : (
              printableLogs.slice(-300).map((l, idx) => (
                <div key={idx} className={`console-logline tone-${l.tone || 'info'}`}>
                  {l.time ? <span className="console-logtime">[{l.time}]</span> : null} {l.msg}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </section>
      </div>
    </div>
  )
}
