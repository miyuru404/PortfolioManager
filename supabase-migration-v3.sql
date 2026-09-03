-- Run this in Supabase SQL Editor (adds broker & commission support)

-- Brokers the user trades through, each with its own commission rate.
CREATE TABLE IF NOT EXISTS public.brokers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 0.64,   -- percent, e.g. 0.64 = 0.64%
  min_fee numeric NOT NULL DEFAULT 0,               -- flat minimum commission (Rs.)
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- CSE / SEC / CDS levies. Fixed by the exchange/regulator (not per-broker),
-- but kept editable per user since they do get revised occasionally.
-- One row per user; the app falls back to hardcoded defaults if none exists.
CREATE TABLE IF NOT EXISTS public.market_fees (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cse_fee_pct numeric NOT NULL DEFAULT 0.084,
  sec_cess_pct numeric NOT NULL DEFAULT 0.072,
  cds_fee_pct numeric NOT NULL DEFAULT 0.024,
  share_transaction_levy_pct numeric NOT NULL DEFAULT 0.300,
  updated_at timestamp with time zone DEFAULT now()
);

-- Record which broker + how much commission/levies applied to each transaction.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS levies_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric,
  ADD COLUMN IF NOT EXISTS realized_pl numeric;

-- RLS
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brokers"
  ON public.brokers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own market fees"
  ON public.market_fees FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
