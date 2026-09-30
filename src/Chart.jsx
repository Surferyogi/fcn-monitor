import React, { useState } from 'react'
import { fmtNum } from './lib.js'

// Ignitus-style technical chart: daily closes with EMA50 (blue), EMA150 (green), EMA200 (turquoise).
// 1Y / 5Y toggle. Strike and KO levels drawn as dashed lines.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Chart({ quote, strikeLevel, koLevel, defaultRange = '1Y' }) {
  const [range, setRange] = useState(defaultRange)
  const s = quote?.series
  if (!s?.d?.length) return <p className="hint">No price history yet.</p>

  const n = range === '1Y' ? Math.min(252, s.d.length) : s.d.length
  const off = s.d.length - n
  const dates = s.d.slice(off)
  const lines = [
    { key: 'price', vals: s.c.slice(off), label: 'Price' },
    { key: 'e50', vals: s.e50.slice(off), label: 'EMA50' },
    { key: 'e150', vals: s.e150.slice(off), label: 'EMA150' },
    { key: 'e200', vals: s.e200.slice(off), label: 'EMA200' },
  ]

  const W = 320, H = 150, padL = 4, padR = 46, padT = 6, padB = 16
  const all = lines.flatMap((l) => l.vals).concat([strikeLevel, koLevel])
  let lo = Math.min(...all), hi = Math.max(...all)
  const span = hi - lo || 1; lo -= span * 0.04; hi += span * 0.04
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo))
  const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, n - 1)
  const path = (vals) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  // month ticks: first bar of each month (1Y) or each January (5Y)
  const ticks = []
  dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7)), yr = d.slice(0, 4)
    const prev = i > 0 ? dates[i - 1] : null
    const newMonth = !prev || prev.slice(0, 7) !== d.slice(0, 7)
    if (!newMonth) return
    if (range === '1Y' && m % 2 === 0) ticks.push({ i, label: MONTHS[m - 1] })
    if (range === '5Y' && m === 1) ticks.push({ i, label: yr })
  })

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="chart-title">Technical <span className="chip">{range} daily</span></span>
        <span className="seg">
          <button className={range === '1Y' ? 'on' : ''} onClick={() => setRange('1Y')}>1Y</button>
          <button className={range === '5Y' ? 'on' : ''} onClick={() => setRange('5Y')}>5Y</button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tchart" role="img" aria-label="Price with EMA50, EMA150, EMA200, strike and knock-out levels">
        <line x1={padL} x2={W - padR} y1={y(koLevel)} y2={y(koLevel)} className="lvl-ko" />
        <text x={W - padR + 3} y={y(koLevel) + 3} className="lvl-txt ko">KO {fmtNum(koLevel)}</text>
        <line x1={padL} x2={W - padR} y1={y(strikeLevel)} y2={y(strikeLevel)} className="lvl-strike" />
        <text x={W - padR + 3} y={y(strikeLevel) + 3} className="lvl-txt strike">Strike {fmtNum(strikeLevel)}</text>
        {ticks.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={padT} y2={H - padB} className="grid" />
            <text x={x(t.i) + 2} y={H - 4} className="ax">{t.label}</text>
          </g>
        ))}
        {lines.map((l) => <polyline key={l.key} points={path(l.vals)} className={`ln ln-${l.key}`} />)}
      </svg>
      <div className="legend">
        {lines.map((l) => <span key={l.key} className={`lg lg-${l.key}`}>— {l.label}</span>)}
        <span className="hint">{n} daily bars · {dates[0]} → {dates[n - 1]}</span>
      </div>
    </div>
  )
}
