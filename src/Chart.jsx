import React, { useMemo, useState } from 'react'
import { fmtNum } from './lib.js'

// Candlestick chart from daily OHLC. Daily view = last 63 trading days (~3 months);
// weekly view = last 52 weeks aggregated from the daily bars. Strike and KO drawn as
// horizontal lines; the relevant moving average (50-day / 200-day) as a thin line.
function toWeekly(bars) {
  const out = []
  let cur = null
  for (const [d, o, h, l, c] of bars) {
    const dt = new Date(d + 'T00:00:00Z')
    const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    if (!cur || cur.key !== key) { cur = { key, d, o, h, l, c }; out.push(cur) }
    else { cur.h = Math.max(cur.h, h); cur.l = Math.min(cur.l, l); cur.c = c }
  }
  return out.map((w) => [w.d, w.o, w.h, w.l, w.c])
}

function sma(closes, n) {
  return closes.map((_, i) => i + 1 < n ? null : closes.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n)
}

export default function Chart({ quote, strikeLevel, koLevel }) {
  const [mode, setMode] = useState('daily')
  const all = quote?.ohlc || []
  const { bars, ma, maLabel } = useMemo(() => {
    if (!all.length) return { bars: [], ma: [], maLabel: '' }
    if (mode === 'daily') {
      const closes = all.map((b) => b[4])
      const s = sma(closes, 50)
      const n = 63
      return { bars: all.slice(-n), ma: s.slice(-n), maLabel: '50-day avg' }
    }
    const closes = all.map((b) => b[4])
    const s200 = sma(closes, 200)
    const wk = toWeekly(all).slice(-52)
    // align the 200-day average to weekly bars: value on the last daily bar of each week
    const byDate = new Map(all.map((b, i) => [b[0], s200[i]]))
    const maW = wk.map((w, i) => {
      const nextStart = wk[i + 1]?.[0]
      const inWeek = all.filter((b) => b[0] >= w[0] && (!nextStart || b[0] < nextStart))
      const last = inWeek.at(-1)
      return last ? byDate.get(last[0]) ?? null : null
    })
    return { bars: wk, ma: maW, maLabel: '200-day avg' }
  }, [all, mode])

  if (!bars.length) return <p className="hint">No price history yet.</p>

  const W = 320, H = 130, padL = 4, padR = 46, padT = 6, padB = 16
  const lows = bars.map((b) => b[3]), highs = bars.map((b) => b[2])
  let lo = Math.min(...lows, strikeLevel), hi = Math.max(...highs, koLevel)
  const span = hi - lo || 1; lo -= span * 0.04; hi += span * 0.04
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo))
  const n = bars.length
  const step = (W - padL - padR) / n
  const x = (i) => padL + step * (i + 0.5)
  const bw = Math.max(1.5, step * 0.6)
  const maPath = ma.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean)
  const firstDate = bars[0][0], lastDate = bars[n - 1][0]

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="hint">{firstDate.slice(0, 7)} → {lastDate}</span>
        <span className="seg">
          <button className={mode === 'daily' ? 'on' : ''} onClick={() => setMode('daily')}>3M daily</button>
          <button className={mode === 'weekly' ? 'on' : ''} onClick={() => setMode('weekly')}>1Y weekly</button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="candles" role="img" aria-label="Candlestick chart with strike and knock-out levels">
        <line x1={padL} x2={W - padR} y1={y(koLevel)} y2={y(koLevel)} className="lvl-ko" />
        <text x={W - padR + 3} y={y(koLevel) + 3} className="lvl-txt ko">KO {fmtNum(koLevel)}</text>
        <line x1={padL} x2={W - padR} y1={y(strikeLevel)} y2={y(strikeLevel)} className="lvl-strike" />
        <text x={W - padR + 3} y={y(strikeLevel) + 3} className="lvl-txt strike">Strike {fmtNum(strikeLevel)}</text>
        {maPath.length > 1 && <polyline points={maPath.join(' ')} className="ma" />}
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
        <text x={padL} y={H - 4} className="ax">{firstDate}</text>
        <text x={W - padR} y={H - 4} className="ax end">{lastDate}</text>
      </svg>
      <p className="hint chart-key">{maLabel} shown as the thin line.</p>
    </div>
  )
}
