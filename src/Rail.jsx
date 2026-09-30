import React from 'react'
import Chart from './Chart.jsx'
import { fmtNum, fmtPct } from './lib.js'

const ARROW = { up: '▲', flat: '▶', down: '▼' }
const WORD = { up: 'up', flat: 'flat', down: 'down' }

function Trend({ label, value }) {
  return (
    <span className={`trend trend-${value || 'none'}`}>
      {label} {value ? `${ARROW[value]} ${WORD[value]}` : 'n/a'}
    </span>
  )
}

// One underlying: price vs strike vs KO with the room to each, trend labels, candlestick chart.
export default function Rail({ u, isLaggard, quote }) {
  return (
    <div className={`rail-row zone-${u.zone}${isLaggard ? ' laggard' : ''}`}>
      <div className="rail-head">
        <span className="rail-name">
          {u.name} <span className="rail-code">{u.code}</span>
          {isLaggard && <span className="tag-laggard">laggard</span>}
        </span>
        <span className="rail-price">
          {u.close != null ? fmtNum(u.close) : '—'}
          <span className="rail-chg">{u.dayChg != null ? ' ' + fmtPct(u.dayChg, 1) : ''}</span>
        </span>
      </div>

      <div className="levels">
        <div className="lvl">
          <span className="lvl-name">Strike</span>
          <span className="lvl-val">{fmtNum(u.strikeLevel)}</span>
          <span className="lvl-room">{u.aboveStrike != null ? fmtPct(u.aboveStrike, 1, false) + ' room' : '—'}</span>
        </div>
        <div className="lvl lvl-now">
          <span className="lvl-name">Now</span>
          <span className="lvl-val">{u.close != null ? fmtNum(u.close) : '—'}</span>
          <span className="lvl-room">{u.pctOfRef != null ? fmtNum(u.pctOfRef, 1) + '% of ref' : ''}</span>
        </div>
        <div className="lvl">
          <span className="lvl-name">KO</span>
          <span className="lvl-val">{fmtNum(u.koLevel)}</span>
          <span className="lvl-room">{u.toKO == null ? '—' : u.toKO <= 0 ? 'reached' : fmtPct(u.toKO, 1, false) + ' to go'}</span>
        </div>
      </div>

      <div className="trends">
        <Trend label="Mid-term" value={quote?.trendMid} />
        <Trend label="Long-term" value={quote?.trendLong} />
      </div>

      <Chart quote={quote} strikeLevel={u.strikeLevel} koLevel={u.koLevel} />
    </div>
  )
}
