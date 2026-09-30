import React, { useState } from 'react'
import { fmtJPY, fmtDate, fmtNum } from './lib.js'

export function Ledger({ notes }) {
  const rows = notes.flatMap((n) => n.schedule.map((s) => ({ ...s, note: n.label, noteId: n.id })))
    .sort((a, b) => a.date.localeCompare(b.date))
  const paid = rows.filter((r) => r.state === 'paid').reduce((t, r) => t + r.coupon, 0)
  const remaining = rows.filter((r) => r.state === 'upcoming').reduce((t, r) => t + r.coupon, 0)
  return (
    <section className="panel">
      <h3>Coupon ledger</h3>
      <p className="panel-sum">Received {fmtJPY(paid)} · scheduled if never called {fmtJPY(remaining)}</p>
      <table className="ledger">
        <tbody>
          {rows.map((r) => (
            <tr key={r.noteId + r.date} className={`row-${r.state}`}>
              <td>{fmtDate(r.date)}</td>
              <td>{r.note}</td>
              <td>m{r.month}{r.isFinal ? ' final' : r.callable ? ' call' : ''}</td>
              <td className="num">{fmtJPY(r.coupon)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Coupon dates assume payment on each observation date. Cancelled rows are after a recorded call.</p>
    </section>
  )
}

export function Log({ entries, notes, onAdd, onRemove }) {
  const [text, setText] = useState('')
  const [noteId, setNoteId] = useState('all')
  const submit = () => {
    if (!text.trim()) return
    onAdd({ id: Date.now(), ts: new Date().toISOString(), noteId, text: text.trim() })
    setText('')
  }
  return (
    <section className="panel">
      <h3>Status log</h3>
      <div className="log-form">
        <select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
          <option value="all">Both notes</option>
          {notes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. RM confirmed fixing prices"
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button onClick={submit}>Add</button>
      </div>
      {entries.length === 0 && <p className="hint">Nothing logged yet. Record confirmations, RM calls and observation outcomes here; entries stay on this device.</p>}
      <ul className="log">
        {entries.slice().reverse().map((e) => (
          <li key={e.id}>
            <span className="log-ts">{e.ts.slice(0, 10)} · {e.noteId === 'all' ? 'Both' : notes.find((n) => n.id === e.noteId)?.label || e.noteId}</span>
            <span className="log-text">{e.text}</span>
            <button className="linkish" onClick={() => onRemove(e.id)} aria-label="Delete entry">×</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Settings({ rawNotes, overrides, onChange, onReset }) {
  return (
    <section className="panel">
      <h3>Confirm terms</h3>
      <p className="hint">Values from the term sheets are pre-filled. Reference prices and observation dates are provisional until you enter the figures from the trade confirmation. Everything here is stored on this device only.</p>
      {rawNotes.map((n) => {
        const ov = overrides[n.id] || {}
        const setOv = (patch) => onChange({ ...overrides, [n.id]: { ...ov, ...patch } })
        return (
          <div key={n.id} className="settings-note">
            <h4>{n.label}</h4>
            {n.underlyings.map((u) => (
              <label key={u.ticker} className="field">
                <span>{u.name} {u.code} initial fixing</span>
                <input type="number" inputMode="decimal" step="0.01"
                  value={ov.refs?.[u.ticker] ?? ''} placeholder={`provisional ${fmtNum(u.ref)}`}
                  onChange={(e) => {
                    const refs = { ...(ov.refs || {}) }
                    if (e.target.value === '') delete refs[u.ticker]; else refs[u.ticker] = Number(e.target.value)
                    setOv({ refs })
                  }} />
              </label>
            ))}
            <label className="field">
              <span>Observation dates, one per line (YYYY-MM-DD)</span>
              <textarea rows={6}
                value={(ov.observationDates || []).join('\n')}
                placeholder={n.observationDates.join('\n')}
                onChange={(e) => setOv({ observationDates: e.target.value.split('\n').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)) })} />
            </label>
            <label className="field">
              <span>Outcome</span>
              <div className="inline">
                <select value={ov.status?.state || ''} onChange={(e) => setOv({ status: e.target.value ? { state: e.target.value, date: ov.status?.date || '' } : null })}>
                  <option value="">Running</option>
                  <option value="called">Called (knocked out)</option>
                  <option value="put">Shares delivered at strike</option>
                </select>
                {ov.status && (
                  <input type="date" value={ov.status.date || ''} onChange={(e) => setOv({ status: { ...ov.status, date: e.target.value } })} />
                )}
              </div>
            </label>
          </div>
        )
      })}
      <button className="danger" onClick={onReset}>Clear all edits on this device</button>
    </section>
  )
}
