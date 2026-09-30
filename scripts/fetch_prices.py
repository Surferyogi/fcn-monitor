"""Fetch daily OHLC for every underlying in public/data/notes.json and write
public/data/prices.json. Run by GitHub Actions on a schedule.
Never invents data: if a ticker fails, the previous value is kept and flagged stale."""
import json, sys, datetime as dt, pathlib
import yfinance as yf, numpy as np, pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTES = ROOT / "public/data/notes.json"
OUT = ROOT / "public/data/prices.json"

# ---- Trend rule (single source of truth; shown verbatim in the app) ----
MID_SMA, MID_SLOPE_DAYS, MID_SLOPE_PCT = 50, 20, 2.0
LONG_SMA, LONG_SLOPE_DAYS, LONG_SLOPE_PCT = 200, 60, 3.0
TREND_RULE = (
    f"Mid-term: close vs {MID_SMA}-day average and its change over {MID_SLOPE_DAYS} trading days "
    f"(up = above and rising ≥{MID_SLOPE_PCT}%, down = below and falling ≥{MID_SLOPE_PCT}%, else flat). "
    f"Long-term: same with {LONG_SMA}-day average over {LONG_SLOPE_DAYS} days, ±{LONG_SLOPE_PCT}%."
)

def classify(close, sma, slope_pct, thr):
    if close is None or sma is None or slope_pct is None:
        return None
    if close > sma and slope_pct >= thr:
        return "up"
    if close < sma and slope_pct <= -thr:
        return "down"
    return "flat"

notes = json.loads(NOTES.read_text())
tickers = sorted({u["ticker"] for n in notes for u in n["underlyings"]})
try:
    old = json.loads(OUT.read_text())
except Exception:
    old = {"quotes": {}}

quotes = {}
for t in tickers:
    try:
        h = yf.download(t, period="2y", progress=False, auto_adjust=True)
        h = h.dropna(subset=[("Close", t)] if isinstance(h.columns, pd.MultiIndex) else ["Close"])
        if isinstance(h.columns, pd.MultiIndex):
            h.columns = h.columns.get_level_values(0)
        c = h["Close"]
        if len(c) < 2:
            raise ValueError("no data")
        r = np.log(c).diff().dropna()
        r = r[r.abs() <= 0.35]  # drop unadjusted split artefacts from vol only
        sma_m = c.rolling(MID_SMA).mean()
        sma_l = c.rolling(LONG_SMA).mean()
        def slope(s, n):
            if len(s.dropna()) <= n:
                return None
            a, b = s.iloc[-1 - n], s.iloc[-1]
            return None if pd.isna(a) or pd.isna(b) else float((b / a - 1) * 100)
        close = float(c.iloc[-1])
        smm = None if pd.isna(sma_m.iloc[-1]) else float(sma_m.iloc[-1])
        sml = None if pd.isna(sma_l.iloc[-1]) else float(sma_l.iloc[-1])
        slm, sll = slope(sma_m, MID_SLOPE_DAYS), slope(sma_l, LONG_SLOPE_DAYS)
        tail = c.tail(252)
        ohlc = h[["Open", "High", "Low", "Close"]].tail(270)
        quotes[t] = {
            "close": round(close, 2),
            "prevClose": round(float(c.iloc[-2]), 2),
            "date": str(c.index[-1].date()),
            "high52": round(float(tail.max()), 2),
            "low52": round(float(tail.min()), 2),
            "rv1m": round(float(r.tail(21).std() * np.sqrt(252) * 100), 1),
            "rv3m": round(float(r.tail(63).std() * np.sqrt(252) * 100), 1),
            "sma50": None if smm is None else round(smm, 2),
            "sma200": None if sml is None else round(sml, 2),
            "sma50Slope": None if slm is None else round(slm, 2),
            "sma200Slope": None if sll is None else round(sll, 2),
            "trendMid": classify(close, smm, slm, MID_SLOPE_PCT),
            "trendLong": classify(close, sml, sll, LONG_SLOPE_PCT),
            "ohlc": [[str(d.date()), round(float(o), 2), round(float(hi), 2), round(float(lo), 2), round(float(cl), 2)]
                     for d, o, hi, lo, cl in zip(ohlc.index, ohlc["Open"], ohlc["High"], ohlc["Low"], ohlc["Close"])],
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
    "source": "Yahoo Finance via yfinance, daily OHLC (auto-adjusted)",
    "trendRule": TREND_RULE,
    "quotes": quotes,
}
OUT.write_text(json.dumps(out, separators=(",", ":")))
print("wrote", OUT, "tickers:", ", ".join(tickers))
