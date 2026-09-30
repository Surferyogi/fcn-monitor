import React, { useState } from 'react'
import { fmtNum } from './lib.js'

// Weekly view: last 26 weekly candles with the 50- and 150-week EMAs.
// Monthly view: last 12 monthly candles with the 200-month EMA (drawn only if it falls
// inside the price range; otherwise its value is reported in text so the candles stay readable).
export default function Chart({ quote, strikeLevel, koLevel, defaultMode = 'weekly' }) {
  const [mode, setMode] = useState(defaultMode)
  const src = mode === 'weekly' ? quote?.weekly : quote?.monthly
  const bars = src?.bars || []
  if (!bars.length) return <p className="hint">No price history yet.</p>

  const lines = mode === 'weekly'
    ? [{ key: 'fast', vals: src.emaFast, label: `50w EMA ${fmtNum(quote.emaFastW)}` },
       { key: 'slow', vals: src.emaSlow, label: `150w EMA ${fmtNum(quote.emaSlowW)}` }]
    : [{ key: 'long', vals: src.ema, label: `200m EMA ${fmtNum(quote.ema200M)}` }]

  const W = 320, H = 130, padL = 4, padR = 46, padT = 6, padB = 16
  let lo = Math.min(...bars.map((b) => b[3]), strikeLevel)
  let hi = Math.max(...bars.map((b) => b[2]), koLevel)
  // include EMA lines only when they are within 25% of the candle range, so a distant
  // long-history EMA does not squash the chart
  const range = hi - lo || 1
  const drawn = lines.map((l) => {
    const v = (l.vals || []).filter((x) => x != null)
    const inFrame = v.length && Math.min(...v) > lo - range * 0.25 && Math.max(...v) < hi + range * 0.25
    if (inFrame) { lo = Math.min(lo, ...v); hi = Math.max(hi, ...v) }
    return { ...l, inFrame }
  })
  const span = hi - lo || 1; lo -= span * 0.04; hi += span * 0.04
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo))
  const n = bars.length
  const step = (W - padL - padR) / n
  const x = (i) => padL + step * (i + 0.5)
  const bw = Math.max(2, step * 0.6)
  const path = (vals) => (vals || []).map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ')

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="hint">{bars[0][0]} → {bars[n - 1][0]}</span>
        <span className="seg">
          <button className={mode === 'weekly' ? 'on' : ''} onClick={() => setMode('weekly')}>6M weekly</button>
          <button className={mode === 'monthly' ? 'on' : ''} onClick={() => setMode('monthly')}>1Y monthly</button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="candles" role="img" aria-label="Candlestick chart with strike, knock-out and EMA lines">
        <line x1={padL} x2={W - padR} y1={y(koLevel)} y2={y(koLevel)} className="lvl-ko" />
        <text x={W - padR + 3} y={y(koLevel) + 3} className="lvl-txt ko">KO {fmtNum(koLevel)}</text>
        <line x1={padL} x2={W - padR} y1={y(strikeLevel)} y2={y(strikeLevel)} className="lvl-strike" />
        <text x={W - padR + 3} y={y(strikeLevel) + 3} className="lvl-txt strike">Strike {fmtNum(strikeLevel)}</text>
        {drawn.filter((l) => l.inFrame).map((l) => (
          <polyline key={l.key} points={path(l.vals)} className={`ema ema-${l.key}`} />
        ))}
        {bars.map((b, i) => {
          const [, o, h, l, c] = b
          const up = c >= o
          const top = y(Math.max(o, c)), bot = y(Math.min(o, c))
          return (
            <g key={b[0]} className={up ? 'up' : 'down'}>
              <line x1={x(i)} x2={x(i)} y1={y(h)} y2={y(l)} />
              <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} />
            </g>
          )
        })}
        <text x={padL} y={H - 4} className="ax">{bars[0][0]}</text>
        <text x={W - padR} y={H - 4} className="ax end">{bars[n - 1][0]}</text>
      </svg>
      <p className="hint chart-key">
        {drawn.map((l) => <span key={l.key} className={`key key-${l.key}`}>{l.label}{l.inFrame ? '' : ' (below chart range)'}</span>)}
      </p>
    </div>
  )
}
