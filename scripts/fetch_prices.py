"""Fetch price history for every underlying in public/data/notes.json and write
public/data/prices.json. Run by GitHub Actions on a schedule.
Never invents data: if a ticker fails, the previous value is kept and flagged stale."""
import json, sys, datetime as dt, pathlib
import yfinance as yf, numpy as np, pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTES = ROOT / "public/data/notes.json"
OUT = ROOT / "public/data/prices.json"

# ---- Trend rule (single source of truth; shown verbatim in the app) ----
MID_FAST, MID_SLOW, MID_BARS = 50, 150, 26          # weekly EMAs, 26 weeks (~6 months) shown
LONG_EMA, LONG_LOOKBACK, LONG_BARS = 200, 1, 12     # monthly EMA, slope vs 1 bar earlier, 12 months shown
TREND_RULE = (
    f"Mid-term (weekly bars): up when the {MID_FAST}-week EMA is above the {MID_SLOW}-week EMA, down when below. "
    f"Long-term (monthly bars): up when the {LONG_EMA}-month EMA is higher than {LONG_LOOKBACK} month earlier, down when lower. "
    "EMAs are computed on the full available history; charts show the last "
    f"{MID_BARS} weeks / {LONG_BARS} months."
)

def bars(df, n):
    df = df.tail(n)
    return [[str(d.date()), round(float(o), 2), round(float(h), 2), round(float(l), 2), round(float(c), 2)]
            for d, o, h, l, c in zip(df.index, df["Open"], df["High"], df["Low"], df["Close"])]

def series(s, n):
    return [None if pd.isna(v) else round(float(v), 2) for v in s.tail(n)]

def flatten(h):
    if isinstance(h.columns, pd.MultiIndex):
        h.columns = h.columns.get_level_values(0)
    return h.dropna(subset=["Close"])

notes = json.loads(NOTES.read_text())
tickers = sorted({u["ticker"] for n in notes for u in n["underlyings"]})
try:
    old = json.loads(OUT.read_text())
except Exception:
    old = {"quotes": {}}

quotes = {}
for t in tickers:
    try:
        d = flatten(yf.download(t, period="2y", interval="1d", progress=False, auto_adjust=True))
        w = flatten(yf.download(t, period="max", interval="1wk", progress=False, auto_adjust=True))
        m = flatten(yf.download(t, period="max", interval="1mo", progress=False, auto_adjust=True))
        if len(d) < 2 or len(w) < MID_SLOW or len(m) < 2:
            raise ValueError(f"insufficient data d={len(d)} w={len(w)} m={len(m)}")
        c = d["Close"]
        r = np.log(c).diff().dropna()
        r = r[r.abs() <= 0.35]
        # weekly EMAs
        w_fast = w["Close"].ewm(span=MID_FAST, adjust=False).mean()
        w_slow = w["Close"].ewm(span=MID_SLOW, adjust=False).mean()
        mid = "up" if w_fast.iloc[-1] > w_slow.iloc[-1] else "down"
        # monthly EMA
        m_ema = m["Close"].ewm(span=LONG_EMA, adjust=False).mean()
        enough_m = len(m) >= LONG_EMA
        long_ = None if len(m_ema) <= LONG_LOOKBACK else ("up" if m_ema.iloc[-1] > m_ema.iloc[-1 - LONG_LOOKBACK] else "down")
        tail = c.tail(252)
        quotes[t] = {
            "close": round(float(c.iloc[-1]), 2),
            "prevClose": round(float(c.iloc[-2]), 2),
            "date": str(c.index[-1].date()),
            "high52": round(float(tail.max()), 2),
            "low52": round(float(tail.min()), 2),
            "rv1m": round(float(r.tail(21).std() * np.sqrt(252) * 100), 1),
            "rv3m": round(float(r.tail(63).std() * np.sqrt(252) * 100), 1),
            "trendMid": mid,
            "trendLong": long_,
            "emaFastW": round(float(w_fast.iloc[-1]), 2),
            "emaSlowW": round(float(w_slow.iloc[-1]), 2),
            "ema200M": round(float(m_ema.iloc[-1]), 2),
            "ema200MPrev": round(float(m_ema.iloc[-1 - LONG_LOOKBACK]), 2),
            "monthsOfHistory": int(len(m)),
            "weeksOfHistory": int(len(w)),
            "longEmaFullyFormed": bool(enough_m),
            "weekly": {"bars": bars(w, MID_BARS), "emaFast": series(w_fast, MID_BARS), "emaSlow": series(w_slow, MID_BARS)},
            "monthly": {"bars": bars(m, LONG_BARS), "ema": series(m_ema, LONG_BARS)},
            "stale": False,
        }
    except Exception as e:
        prev = old.get("quotes", {}).get(t)
        if prev:
            prev["stale"] = True
            prev["error"] = str(e)[:120]
            quotes[t] = prev
        else:
            quotes[t] = {"stale": True, "error": str(e)[:120]}
        print(f"WARN {t}: {e}", file=sys.stderr)

out = {
    "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    "source": "Yahoo Finance via yfinance (auto-adjusted); daily closes, weekly and monthly bars",
    "trendRule": TREND_RULE,
    "quotes": quotes,
}
OUT.write_text(json.dumps(out, separators=(",", ":")))
print("wrote", OUT, "tickers:", ", ".join(tickers))
