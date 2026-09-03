# Price & Index History

## What this adds

Two new **shared** database tables (not per-user — market prices are the
same for everyone):

- `price_history` — daily OHLC bars per company symbol
- `index_history` — daily ASPI / S&P SL20 values

Because these are shared, writes can't go through the browser's anon key the
way the rest of the app does. Writes only happen server-side via a **secret
key** client (`lib/supabase-admin.ts`) that bypasses Row Level Security —
used by the migration script and the daily cron below, never imported into
any client component.

## Primary data source: your `cse_stock_prediction` Postgres DB

You already have a working system (Postgres, hosted on an OCI VM) that's
been collecting CSE data — `historical_prices` (11,743 rows, 2010–2025,
KAGGLE-seeded, sparse), `daily_prices` (32,944 rows, ~6 months, CSE_API,
much more complete), and `index_prices` (ASPI / S&P SL20 history). This is
a far better source than scraping `cse.lk`'s undocumented endpoints myself,
so it's now the primary path.

**Known gap**: `historical_prices` ends 2025-09-30, `daily_prices` starts
2026-03-13 — nothing exists for that ~5.5 month window in either table.
Per your call, we're not blocking on this now — if you find a source for
that window later, just load it into `historical_prices` or `daily_prices`
in the source DB (or straight into `price_history` here) and the next
migration/sync run will pick it up.

### 1. Run the migration (`supabase-migration-v4.sql`)

Supabase Dashboard → SQL Editor → run it.

### 2. Add credentials to `.env.local` (never commit these)

```
# Your Supabase project's secret key (Project Settings -> API Keys ->
# the sb_secret_... counterpart to your sb_publishable_... anon key)
SUPABASE_SECRET_KEY=sb_secret_...

# Source DB (cse_stock_prediction) — read-only credentials
SOURCE_PG_HOST=80.225.205.160
SOURCE_PG_PORT=5432
SOURCE_PG_DATABASE=cse_stock_prediction
SOURCE_PG_USER=ubuntu
SOURCE_PG_PASSWORD=...
```

Add the same 6 vars to **Vercel** → Project Settings → Environment
Variables (the daily cron needs them in production), plus a random
`CRON_SECRET` (e.g. `openssl rand -hex 32`) — Vercel sends it automatically
as a Bearer token to the cron endpoint once configured.

### 3. Run the one-time migration

**Run this yourself, in your own terminal — not through an AI agent's
sandboxed shell.** Both this session's cloud container and its bridge to
your Mac go through a network proxy that blocks arbitrary outbound
connections (confirmed blocking even plain `cse.lk` earlier), so this can't
be run through Claude — it needs the same network access your `psql`
session just used.

```
npm install    # pulls in the new `pg` dependency
npm run migrate-source-db
```

It copies `historical_prices` then `daily_prices` (which wins on any
overlapping symbol+date) into `price_history`, and `index_prices` into
`index_history` (mapping `"S&P SL20"` → `SPSL20`, `"ASPI"` → `ASPI`). Safe
to re-run — it's all upserts.

**Check the symbol format**: the script logs a sample of `stocks.symbol` at
startup and warns if none look like CSE's `XXXX.N0000` format. If they
don't match, this app's search/chart symbol lookups won't line up with the
migrated data — let me know what the actual format looks like and I'll add
a conversion step.

### 4. Daily updates

`vercel.json` configures a cron hitting `/api/cron/update-prices` at
10:00 UTC (15:30 Colombo, after market close) on weekdays. It queries your
source DB for anything newer than what's already in Supabase and upserts
just that — assumes `cse_stock_prediction` keeps running and collecting on
its own. If you ever retire that system, this cron will just quietly stop
finding new rows; ask me to switch it back to scraping `cse.lk` directly
(the code for that — `scripts/backfill-price-history.mjs`,
`getChartHistory`/`getTodaySharePrices`/`getAspiData`/`getSnpData` in
`lib/cse-api.ts` — is still there, just unused for now).

Note: Vercel's Hobby (free) plan limits cron jobs to once a day with only
day-level timing guarantees. Pro plans get more precise scheduling.

## Fallback path (scraping cse.lk directly)

If the source DB ever becomes unavailable, `scripts/backfill-price-history.mjs`
still works as a from-scratch alternative — it imports the 31 companies from
`data/cse_prices_raw.json` directly and live-fetches the rest from `cse.lk`'s
undocumented API. Its field-name assumptions were never verified live (same
network restriction), so treat it as untested until someone runs it.

## Not yet built

The actual Chart tab UI — holding off until the chart type is specified,
since the data layer here works the same regardless of what it looks like.
