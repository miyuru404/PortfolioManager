# CSE Tracker — Setup Guide

A full-stack portfolio tracker for the Colombo Stock Exchange built with Next.js 14, Supabase, and Tailwind CSS.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set environment variables
Edit `.env.local` and replace the anon key:
```
NEXT_PUBLIC_SUPABASE_URL=https://qgpfabqbvjqgibowysdm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### 3. Run Supabase SQL migrations
In your Supabase dashboard → SQL Editor, run these files **in order**:

1. The initial schema from the previous setup (profiles, holdings, transactions, price_cache)
2. `supabase-migration-v2.sql` (watchlists, watchlist_items, theme column)

### 4. Run the dev server
```bash
npm run dev
```
Visit http://localhost:3000

---

## Project Structure

```
app/
  auth/         → Login, signup, forgot password
  home/         → Watchlists + stock search
  calculator/   → Average price calculator
  masterdata/   → Manage your holdings
  portfolio/    → P&L charts and analysis
  settings/     → Theme, password change
  api/cse/      → Serverless routes for CSE API

components/
  layout/       → Sidebar, AppLayout
  ui/           → StockCard, StockSearch

lib/
  supabase.ts        → Browser Supabase client
  supabase-server.ts → Server Supabase client
  cse-api.ts         → CSE API wrapper
  themes.ts          → 4 colour themes
  utils.ts           → Formatting helpers
```

## Features

- **Auth** — Email/password signup, login, forgot password (email reset link), change password in settings
- **Home** — Multiple named watchlists, live CSE prices, holdings and average per card, stock search by symbol
- **Average Calculator** — Select from master data holdings, enter buy price/qty/budget, see new average, save to database
- **Master Data** — Add/edit/delete holdings with share count and average price
- **Portfolio & P&L** — Unrealised + realised P&L, pie chart allocation, bar chart per stock, line chart invested over time
- **Settings** — 4 themes: Light, Dark, Midnight, Dark Green

## Themes

| Theme | Description |
|-------|-------------|
| Light | Clean white, green accent (default) |
| Dark | Dark grey surfaces, green accent |
| Midnight | Deep navy, blue/purple accent |
| Dark Green | Forest dark, bright green accent |

## CSE API

Uses the unofficial CSE API documented at `https://www.cse.lk/api/`.
Prices are cached in Supabase for 5 minutes to avoid hitting rate limits.
Search by full symbol e.g. `HNB.N0000`, `COMB.N0000`, `JKH.N0000`.

## Deployment (Vercel)

```bash
# Push to GitHub, then in Vercel:
# 1. Import the repo
# 2. Add environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
# 3. Deploy
```
