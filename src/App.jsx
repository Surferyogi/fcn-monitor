import React, { useEffect, useMemo, useState } from 'react'
import NoteCard from './NoteCard.jsx'
import { Ledger, Log, Settings } from './Panels.jsx'
import { analyseNote, mergeNote, fmtDate } from './lib.js'

export const APP_VERSION = 'v2026:Sep:30-22:14'

const BASE = import.meta.env.BASE_URL
const LS_OV = 'fcn.overrides'
const LS_LOG = 'fcn.log'

const loadLS = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback } catch { return fallback }
}

export default function App() {
  const [rawNotes, setRawNotes] = useState(null)
  const [prices, setPrices] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('notes')
  const [overrides, setOverrides] = useState(() => loadLS(LS_OV, {}))
  const [log, setLog] = useState(() => loadLS(LS_LOG, []))

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const bust = `?t=${Date.now()}`
      const [n, p] = await Promise.all([
        fetch(`${BASE}data/notes.json${bust}`).then((r) => { if (!r.ok) throw new Error('notes.json ' + r.status); return r.json() }),
        fetch(`${BASE}data/prices.json${bust}`).then((r) => { if (!r.ok) throw new Error('prices.json ' + r.status); return r.json() }),
      ])
      setRawNotes(n); setPrices(p)
    } catch (e) {
      setError(`Could not load data (${e.message}). Showing the last copy if one is cached.`)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { localStorage.setItem(LS_OV, JSON.stringify(overrides)) }, [overrides])
  useEffect(() => { localStorage.setItem(LS_LOG, JSON.stringify(log)) }, [log])

  const notes = useMemo(() => {
    if (!rawNotes) return []
    return rawNotes.map((n) => analyseNote(mergeNote(n, overrides[n.id]), prices?.quotes || {}))
  }, [rawNotes, prices, overrides])

  const asOf = notes.map((n) => n.asOf).filter(Boolean).sort().at(-1)
  const fetched = prices?.fetchedAt ? new Date(prices.fetchedAt) : null

  return (
    <div className="app">
      <header className="top">
        <h1>FCN Monitor</h1>
        <div className="top-meta">
          <span>
            {asOf ? `Closes as of ${fmtDate(asOf)}` : 'No prices yet'}
            {fetched && ` · fetched ${fetched.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <button className="linkish" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {notes.some((n) => n.anyStale) && <p className="error">Some prices are stale or missing — the last scheduled fetch did not get fresh data for every name.</p>}

      <nav className="tabs">
        {[['notes', 'Notes'], ['ledger', 'Coupons'], ['log', 'Log'], ['settings', 'Terms']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <main>
        {tab === 'notes' && (notes.length ? notes.map((n) => <NoteCard key={n.id} note={n} quotes={prices?.quotes} trendRule={prices?.trendRule} />) : <p className="hint">Loading…</p>)}
        {tab === 'ledger' && <Ledger notes={notes} />}
        {tab === 'log' && <Log entries={log} notes={notes} onAdd={(e) => setLog([...log, e])} onRemove={(id) => setLog(log.filter((e) => e.id !== id))} />}
        {tab === 'settings' && rawNotes && (
          <Settings rawNotes={rawNotes} overrides={overrides} onChange={setOverrides}
            onReset={() => { if (confirm('Clear reference prices, dates and outcomes you entered on this device?')) setOverrides({}) }} />
        )}
      </main>

      <footer className="bottom">
        <span>{prices?.source || ''}</span>
        <span>{APP_VERSION}</span>
      </footer>
    </div>
  )
}
