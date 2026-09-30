import React from 'react'
import { fmtNum, fmtPct } from './lib.js'

// A horizontal rail from below-strike to above-KO, in % of the reference price.
// Strike and KO are the two fixed ticks; the dot is today's close.
export default function Rail({ u, isLaggard }) {
  const lo = u.strikePct - 8
  const hi = u.koPct + 8
  const x = (pct) => Math.min(100, Math.max(0, ((pct - lo) / (hi - lo)) * 100))
  const xStrike = x(u.strikePct)
  const xKO = x(u.koPct)
  const xNow = u.pctOfRef != null ? x(u.pctOfRef) : null

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
      <svg className="rail" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="6" width={xStrike} height="2" className="seg-breach" />
        <rect x={xStrike} y="6" width={xKO - xStrike} height="2" className="seg-mid" />
        <rect x={xKO} y="6" width={100 - xKO} height="2" className="seg-ko" />
        <rect x={xStrike - 0.5} y="2" width="1" height="10" className="tick" />
        <rect x={xKO - 0.5} y="2" width="1" height="10" className="tick" />
        {xNow != null && <circle cx={xNow} cy="7" r="3.2" className="dot" />}
      </svg>
      <div className="rail-labels">
        <span>strike {fmtNum(u.strikeLevel)}</span>
        <span>ref / KO {fmtNum(u.koLevel)}</span>
      </div>
      <div className="rail-dist">
        <span>{u.aboveStrike != null ? fmtPct(u.aboveStrike, 1) + ' above strike' : 'no price'}</span>
        <span>{u.toKO != null ? (u.toKO <= 0 ? 'at or above KO' : fmtPct(u.toKO, 1, false) + ' to KO') : ''}</span>
      </div>
    </div>
  )
}
