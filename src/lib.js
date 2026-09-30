// Pure helpers. No I/O, no assumptions beyond the term sheet fields in notes.json.

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const fmtJPY = (n) =>
  n == null ? '—' : '¥' + Math.round(n).toLocaleString('en-US')

export const fmtNum = (n, d = 0) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtPct = (n, d = 1, sign = true) => {
  if (n == null || Number.isNaN(n)) return '—'
  const s = n.toFixed(d)
  return (sign && n > 0 ? '+' : '') + s + '%'
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export const daysBetween = (a, b) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

// Apply per-device overrides (edited refs, confirmed dates, manual status) on top of notes.json.
export function mergeNote(note, ov = {}) {
  const refs = ov.refs || {}
  return {
    ...note,
    observationDates: ov.observationDates?.length ? ov.observationDates : note.observationDates,
    datesProvisional: ov.observationDates?.length ? false : note.datesProvisional,
    refProvisional: Object.keys(refs).length ? false : note.refProvisional,
    manualStatus: ov.status || null,
    underlyings: note.underlyings.map((u) => ({ ...u, ref: refs[u.ticker] ?? u.ref })),
  }
}

export function monthlyCoupon(note) {
  return (note.notional * note.couponPA) / 100 / 12
}

export function underlyingStats(u, quote) {
  const close = quote?.close ?? null
  const strikeLevel = u.ref * (u.strikePct / 100)
  const koLevel = u.ref * (u.koPct / 100)
  const pctOfRef = close != null ? (close / u.ref) * 100 : null
  return {
    ...u,
    close,
    prevClose: quote?.prevClose ?? null,
    date: quote?.date ?? null,
    stale: quote?.stale ?? true,
    strikeLevel,
    koLevel,
    pctOfRef,
    dayChg: close != null && quote?.prevClose ? (close / quote.prevClose - 1) * 100 : null,
    aboveStrike: close != null ? (close / strikeLevel - 1) * 100 : null, // % cushion above strike
    toKO: close != null ? (koLevel / close - 1) * 100 : null,             // % rise needed to reach KO
    zone: close == null ? 'nodata'
      : close < strikeLevel ? 'breach'
      : close / strikeLevel - 1 < 0.05 ? 'watch'
      : close >= koLevel ? 'ko'
      : 'ok',
  }
}

export function noteStatus(note, today = todayISO()) {
  if (note.manualStatus?.state === 'called') {
    return { state: 'called', label: 'Called', date: note.manualStatus.date }
  }
  if (note.manualStatus?.state === 'put') {
    return { state: 'put', label: 'Shares delivered', date: note.manualStatus.date }
  }
  if (today < note.settlementDate) return { state: 'pending', label: 'Settles ' + fmtDate(note.settlementDate) }
  if (today >= note.maturityDate) return { state: 'matured', label: 'Matured' }
  return { state: 'active', label: 'Active' }
}

export function schedule(note, today = todayISO()) {
  const coupon = monthlyCoupon(note)
  const endDate = note.manualStatus?.date || null
  return note.observationDates.map((d, i) => {
    const month = i + 1
    const callable = month > note.nonCallMonths
    const isFinal = i === note.observationDates.length - 1
    let state = 'upcoming'
    if (endDate && d > endDate) state = 'cancelled'
    else if (d <= today) state = 'paid'
    return { date: d, month, callable, isFinal, coupon, state }
  })
}

export function nextObservation(note, today = todayISO()) {
  return schedule(note, today).find((s) => s.state === 'upcoming') || null
}

export function analyseNote(note, quotes, today = todayISO()) {
  const us = note.underlyings.map((u) =>
    underlyingStats({ ...u, strikePct: note.strikePct, koPct: note.koPct }, quotes[u.ticker]))
  const withData = us.filter((u) => u.pctOfRef != null)
  const laggard = withData.length
    ? withData.reduce((a, b) => (b.pctOfRef < a.pctOfRef ? b : a))
    : null
  const allAboveKO = withData.length === us.length && us.every((u) => u.close >= u.koLevel)
  const sched = schedule(note, today)
  const paid = sched.filter((s) => s.state === 'paid')
  return {
    ...note,
    underlyings: us,
    laggard,
    allAboveKO,
    status: noteStatus(note, today),
    schedule: sched,
    next: sched.find((s) => s.state === 'upcoming') || null,
    couponsPaid: paid.length,
    couponsPaidJPY: paid.reduce((t, s) => t + s.coupon, 0),
    monthlyCoupon: monthlyCoupon(note),
    asOf: withData.length ? withData.map((u) => u.date).sort().at(-1) : null,
    anyStale: us.some((u) => u.stale),
  }
}
