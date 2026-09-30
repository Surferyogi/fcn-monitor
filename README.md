# FCN Monitor

Monitors two JPY fixed coupon notes (worst-of, monthly period-end knock-out) — distance of each underlying to strike and knock-out, coupon ledger, observation dates, and a status log. Installable as a PWA on iPhone.

Live at `https://surferyogi.github.io/fcn-monitor/` once deployed.

## How data flows

- `public/data/notes.json` — the term-sheet fields (strike %, KO %, dates, notional). Edit this file to change a note.
- `public/data/prices.json` — daily closes written by `scripts/fetch_prices.py` (Yahoo Finance via yfinance). GitHub Actions runs it at 11:30 and 16:00 JST on weekdays, commits the file, rebuilds and redeploys. There is no backend and no API key.
- `prices.json` also carries the last 26 weekly and 12 monthly candles plus EMAs. Trend labels follow the rule at the top of `scripts/fetch_prices.py` (shown under each note's Terms): mid-term = 50-week EMA above/below 150-week EMA; long-term = 200-month EMA rising/falling vs the prior month. EMAs use the full Yahoo history for each stock.
- Reference prices and observation dates in `notes.json` are **provisional** (30 Sep 2026 closes; 14th of each month). Enter the confirmed initial fixings and dates under the Terms tab — those are saved in the browser on that device only.
- Status log entries are also device-local (localStorage).

## One-time setup

1. Create the repo `fcn-monitor` under your GitHub account and push these files to `main`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Repo → Settings → Actions → General → Workflow permissions: **Read and write** (needed so the bot can commit `prices.json`).
4. Push (or Actions → "Update prices and deploy" → Run workflow). First run fetches prices, builds and deploys.
5. On iPhone: open the URL in Safari → Share → Add to Home Screen.

If you rename the repo, change `REPO` in `vite.config.js` and the icon path in `index.html`.

## Local

```
npm install
npm run dev
```

Run `python scripts/fetch_prices.py` to refresh `prices.json` locally (needs `pip install yfinance`).

## Caveats

- Prices are the last scheduled fetch, not live ticks. "Closes as of" in the header shows the data date.
- The rail compares today's close to strike/KO in price terms; the note's own valuation uses the official closing prices on the observation dates only.
- "Indicative FQ" from the term sheets is stored but its meaning is not confirmed.
