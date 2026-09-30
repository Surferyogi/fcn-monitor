"""Fetch daily price history for every underlying in public/data/notes.json and write
public/data/prices.json. Run by GitHub Actions on a schedule.
Never invents data: if a ticker fails, the previous value is kept and flagged stale."""
import json, sys, datetime as dt, pathlib
import yfinance as yf, numpy as np, pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTES = ROOT / "public/data/notes.json"
OUT = ROOT / "public/data/prices.json"

# ---- Trend rule (single source of truth; shown verbatim in the app) ----
EMA_FAST, EMA_MID, EMA_LONG = 50, 150, 200   # daily EMAs
SLOPE_DAYS, FLAT_BAND = 21, 1.0              # slope window (trading days) and ±% flat band
HL_WINDOW = 63                               # trading days per window for higher-highs / lower-lows
BARS_KEPT = 1260                             # ~5 years of daily bars sent to the app
TREND_RULE = {
    "mid": f"EMA{EMA_FAST} & EMA{EMA_MID} slope, {SLOPE_DAYS}d · ±{FLAT_BAND}% flat band",
    "midLong": (f"Up: both EMAs rising ≥{FLAT_BAND}% over {SLOPE_DAYS} days. Flat: both within ±{FLAT_BAND}%. "
                f"Down: EMA{EMA_FAST} below EMA{EMA_MID} and both falling ≥{FLAT_BAND}%. Otherwise mixed."),
    "long": f"EMA{EMA_LONG} higher highs / lower lows · {HL_WINDOW}d windows",
    "longLong": (f"Up: EMA{EMA_LONG}'s high and low over the last {HL_WINDOW} trading days both above the prior "
                 f"{HL_WINDOW}-day window. Down: both below. Otherwise flat."),
}

def slope_pct(s, n):
    if len(s.dropna()) <= n:
        return None
    a, b = s.iloc[-1 - n], s.iloc[-1]
    return None if pd.isna(a) or pd.isna(b) or a == 0 else float((b / a - 1) * 100)

def mid_trend(s50, s150, e50, e150):
    if s50 is None or s150 is None:
        return None
    up = lambda v: v >= FLAT_BAND
    dn = lambda v: v <= -FLAT_BAND
    fl = lambda v: abs(v) < FLAT_BAND
    if up(s50) and up(s150): return "up"
    if fl(s50) and fl(s150): return "flat"
    if e50 < e150 and dn(s50) and dn(s150): return "down"
    return "mixed"

def long_trend(ema):
    e = ema.dropna()
    if len(e) < 2 * HL_WINDOW:
        return None, None, None
    cur, prev = e.tail(HL_WINDOW), e.iloc[-2 * HL_WINDOW:-HL_WINDOW]
    hh = float((cur.max() / prev.max() - 1) * 100)
    ll = float((cur.min() / prev.min() - 1) * 100)
    if hh > 0 and ll > 0: return "up", hh, ll
    if hh < 0 and ll < 0: return "down", hh, ll
    return "flat", hh, ll

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
        d = flatten(yf.download(t, period="7y", interval="1d", progress=False, auto_adjust=True))
        c = d["Close"]
        if len(c) < EMA_LONG + 2 * HL_WINDOW:
            raise ValueError(f"insufficient history ({len(c)} bars)")
        e50 = c.ewm(span=EMA_FAST, adjust=False).mean()
        e150 = c.ewm(span=EMA_MID, adjust=False).mean()
        e200 = c.ewm(span=EMA_LONG, adjust=False).mean()
        s50, s150, s200 = slope_pct(e50, SLOPE_DAYS), slope_pct(e150, SLOPE_DAYS), slope_pct(e200, SLOPE_DAYS)
        lt, hh, ll = long_trend(e200)
        r = np.log(c).diff().dropna(); r = r[r.abs() <= 0.35]
        tail = c.tail(252)
        keep = c.tail(BARS_KEPT)
        rnd = lambda s: [round(float(v), 1) for v in s.tail(BARS_KEPT)]
        quotes[t] = {
            "close": round(float(c.iloc[-1]), 2),
            "prevClose": round(float(c.iloc[-2]), 2),
            "date": str(c.index[-1].date()),
            "high52": round(float(tail.max()), 2),
            "low52": round(float(tail.min()), 2),
            "rv1m": round(float(r.tail(21).std() * np.sqrt(252) * 100), 1),
            "rv3m": round(float(r.tail(63).std() * np.sqrt(252) * 100), 1),
            "ema50": round(float(e50.iloc[-1]), 2), "ema150": round(float(e150.iloc[-1]), 2), "ema200": round(float(e200.iloc[-1]), 2),
            "slope50": None if s50 is None else round(s50, 2),
            "slope150": None if s150 is None else round(s150, 2),
            "slope200": None if s200 is None else round(s200, 2),
            "trendMid": mid_trend(s50, s150, float(e50.iloc[-1]), float(e150.iloc[-1])),
            "trendLong": lt,
            "hhPct": None if hh is None else round(hh, 2),
            "llPct": None if ll is None else round(ll, 2),
            "barsTotal": int(len(c)),
            "series": {"d": [str(x.date()) for x in keep.index], "c": rnd(c), "e50": rnd(e50), "e150": rnd(e150), "e200": rnd(e200)},
            "stale": False,
        }
    except Exception as e:
        prev = old.get("quotes", {}).get(t)
        if prev:
            prev["stale"] = True; prev["error"] = str(e)[:120]; quotes[t] = prev
        else:
            quotes[t] = {"stale": True, "error": str(e)[:120]}
        print(f"WARN {t}: {e}", file=sys.stderr)

out = {
    "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    "source": "Yahoo Finance via yfinance, daily closes (auto-adjusted), EMAs on ~7y history",
    "trendRule": TREND_RULE,
    "quotes": quotes,
}
OUT.write_text(json.dumps(out, separators=(",", ":")))
print("wrote", OUT, "tickers:", ", ".join(tickers))
