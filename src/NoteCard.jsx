import React, { useState } from 'react'
import Rail from './Rail.jsx'
import { fmtJPY, fmtDate, fmtNum, daysBetween, todayISO } from './lib.js'

export default function NoteCard({ note, quotes, trendRule }) {
  const [open, setOpen] = useState(false)
  const today = todayISO()
  const n = note
  const days = n.next ? daysBetween(today, n.next.date) : null

  let headline
  if (n.status.state === 'called') headline = `Called ${fmtDate(n.status.date)}`
  else if (n.status.state === 'put') headline = `Shares delivered ${fmtDate(n.status.date)}`
  else if (n.status.state === 'matured') headline = 'Reached maturity'
  else if (!n.next) headline = 'No observation dates'
  else if (n.next.isFinal) headline = `Final valuation ${fmtDate(n.next.date)} · ${days} days`
  else if (n.next.callable) headline = `Call observation ${fmtDate(n.next.date)} · ${days} days`
  else headline = `Coupon date ${fmtDate(n.next.date)} · ${days} days (not callable yet)`

  return (
    <section className={`note state-${n.status.state}`}>
      <header className="note-head">
        <div>
          <h2>{n.label}</h2>
          <p className="note-sub">{n.issuer} · {fmtJPY(n.notional)} · {n.couponPA}% p.a.</p>
        </div>
        <span className={`pill pill-${n.status.state}`}>{n.status.label}</span>
      </header>

      <p className="note-next">{headline}</p>
      {n.laggard && n.status.state === 'active' && (
        <p className="note-read">
          {n.allAboveKO
            ? 'All names at or above reference — would knock out if today were a call date.'
            : `${n.laggard.name} is the laggard at ${fmtNum(n.laggard.pctOfRef, 1)}% of reference; knock-out needs every name at or above 100%.`}
        </p>
      )}

      <div className="rails">
        {n.underlyings.map((u) => (
          <Rail key={u.ticker} u={u} quote={quotes?.[u.ticker]} trendRule={trendRule} isLaggard={n.laggard?.ticker === u.ticker && n.underlyings.length > 1} />
        ))}
      </div>

      <div className="note-foot">
        <span>{fmtJPY(n.monthlyCoupon)} per month · {n.couponsPaid} of {n.schedule.length} paid</span>
        <button className="linkish" onClick={() => setOpen(!open)}>{open ? 'Hide terms' : 'Terms'}</button>
      </div>

      {open && (
        <dl className="terms">
          <dt>Strike</dt><dd>{n.strikePct}% of reference, tested at final valuation only</dd>
          <dt>Knock-out</dt><dd>{n.koPct}%, {n.observation.toLowerCase()} at period end, callable from month {n.nonCallMonths + 1}</dd>
          <dt>Tenor</dt><dd>{n.tenorMonths} months · trade {fmtDate(n.tradeDate)} · settle {fmtDate(n.settlementDate)} · maturity {fmtDate(n.maturityDate)}</dd>
          <dt>Indicative FQ</dt><dd>{n.indicativeFQ}% — meaning not confirmed; check with RM</dd>
          <dt>Product ID</dt><dd>{n.productId}</dd>
          <dt>Risk rating</dt><dd>PRR {n.prr} of 5</dd>
          <dt>Mid-term rule</dt><dd>{trendRule?.midLong || 'not available'}</dd>
          <dt>Long-term rule</dt><dd>{trendRule?.longLong || 'not available'}</dd>
          <dt>Reference prices</dt>
          <dd>{n.refProvisional ? `Provisional — ${n.refSource}` : 'Confirmed on this device'}</dd>
          <dt>Observation dates</dt>
          <dd>{n.datesProvisional ? 'Provisional (monthly from settlement) — confirm against final terms' : 'Confirmed on this device'}</dd>
        </dl>
      )}
    </section>
  )
}
