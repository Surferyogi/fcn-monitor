import React from 'react'
import Chart from './Chart.jsx'
import { fmtNum, fmtPct } from './lib.js'

const ICON = { up: '▲', down: '▼', flat: '▬', mixed: '◆' }

function TrendRow({ title, rule, value, detail }) {
  return (
    <div className={`trow trow-${value || 'none'}`}>
      <div>
        <div className="trow-title">{title}</div>
        <div className="trow-rule">{rule}</div>
      </div>
      <div className="trow-val">
        <div className="trow-label">{value ? `${ICON[value]} ${value.toUpperCase()}` : 'N/A'}</div>
        <div className="trow-detail">{detail}</div>
      </div>
    </div>
  )
}

// One underlying: price vs strike vs KO with room to each, then the technical card.
export default function Rail({ u, isLaggard, quote, trendRule }) {
  const q = quote || {}
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

      <Chart quote={quote} strikeLevel={u.strikeLevel} koLevel={u.koLevel} />

      <TrendRow title="Mid-term trend" rule={trendRule?.mid || ''} value={q.trendMid}
        detail={q.slope50 != null ? `EMA50 ${fmtPct(q.slope50, 2)} · EMA150 ${fmtPct(q.slope150, 2)}` : ''} />
      <TrendRow title="Long-term trend" rule={trendRule?.long || ''} value={q.trendLong}
        detail={q.hhPct != null ? `highs ${fmtPct(q.hhPct, 2)} · lows ${fmtPct(q.llPct, 2)}` : ''} />
    </div>
  )
}
