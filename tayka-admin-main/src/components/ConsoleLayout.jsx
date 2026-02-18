import React from 'react'

export default function ConsoleLayout({
  title,
  actions,
  hints,
  topPanel,
  leftTitle,
  left,
  mainTitle,
  main,
  rootClassName = 'simulation-root',
  leftClassName = 'card-b simulation-panel simulation-left',
  mainClassName = 'card-b simulation-panel simulation-middle',
}) {
  const hintList = Array.isArray(hints) ? hints.filter(Boolean) : []

  return (
    <div className={rootClassName}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>{title}</h1>
        <div>{actions || null}</div>
      </div>

      {hintList.map((h, idx) => (
        <p key={idx} className="hint" style={{ marginTop: 8 }}>
          {h}
        </p>
      ))}

      {topPanel ? topPanel : null}

      <div className="simulation-grid">
        <aside className={leftClassName}>
          {leftTitle ? <div className="panel-title">{leftTitle}</div> : null}
          {left}
        </aside>

        <section className={mainClassName}>
          {mainTitle ? <div className="panel-title">{mainTitle}</div> : null}
          {main}
        </section>
      </div>
    </div>
  )
}
