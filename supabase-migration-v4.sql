-- Run this in Supabase SQL Editor (adds shared price/index history)
--
-- Unlike every other table so far, these are NOT per-user: market prices are
-- the same for everyone. Everyone can read them; only the server-side
-- "secret key" client (never the browser anon key) can write to them, so
-- RLS grants a public SELECT policy and deliberately no INSERT/UPDATE/DELETE
-- policy at all — the secret key bypasses RLS entirely for the backfill
-- script and the daily cron job.

CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol text NOT NULL,
  trade_date date NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric NOT NULL,
  volume bigint,
  turnover numeric,
  UNIQUE(symbol, trade_date)
);
CREATE INDEX IF NOT EXISTS price_history_symbol_date_idx ON public.price_history (symbol, trade_date DESC);

CREATE TABLE IF NOT EXISTS public.index_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  index_name text NOT NULL CHECK (index_name IN ('ASPI', 'SPSL20')),
  trade_date date NOT NULL,
  value numeric NOT NULL,
  change numeric,
  change_pct numeric,
  UNIQUE(index_name, trade_date)
);
CREATE INDEX IF NOT EXISTS index_history_name_date_idx ON public.index_history (index_name, trade_date DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read price history"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read index history"
  ON public.index_history FOR SELECT
  USING (true);
