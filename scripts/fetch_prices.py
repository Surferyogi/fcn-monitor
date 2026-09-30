"""Fetch latest closes for every underlying listed in public/data/notes.json
and write public/data/prices.json. Run by GitHub Actions on a schedule.
Never invents data: if a ticker fails, the previous value is kept and flagged stale."""
import json, sys, datetime as dt, pathlib
import yfinance as yf, numpy as np, pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTES = ROOT / "public/data/notes.json"
OUT = ROOT / "public/data/prices.json"

notes = json.loads(NOTES.read_text())
tickers = sorted({u["ticker"] for n in notes for u in n["underlyings"]})
try:
    old = json.loads(OUT.read_text())
except Exception:
    old = {"quotes": {}}

quotes = {}
for t in tickers:
    try:
        h = yf.download(t, period="14mo", progress=False, auto_adjust=True)
        c = h["Close"].squeeze().dropna()
        if len(c) < 2:
            raise ValueError("no data")
        r = np.log(c).diff().dropna()
        r = r[r.abs() <= 0.35]  # drop unadjusted split artefacts
        tail = c.tail(252)
        quotes[t] = {
            "close": round(float(c.iloc[-1]), 2),
            "prevClose": round(float(c.iloc[-2]), 2),
            "date": str(c.index[-1].date()),
            "high52": round(float(tail.max()), 2),
            "low52": round(float(tail.min()), 2),
            "rv1m": round(float(r.tail(21).std() * np.sqrt(252) * 100), 1),
            "rv3m": round(float(r.tail(63).std() * np.sqrt(252) * 100), 1),
            "history": [[str(d.date()), round(float(v), 2)] for d, v in c.tail(60).items()],
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
    "source": "Yahoo Finance via yfinance, daily closes (auto-adjusted)",
    "quotes": quotes,
}
OUT.write_text(json.dumps(out, indent=1))
print("wrote", OUT, "tickers:", ", ".join(tickers))
