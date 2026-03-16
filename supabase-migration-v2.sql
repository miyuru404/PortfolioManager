-- Run this in Supabase SQL Editor (adds to the initial schema)

-- Add theme column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'light';

-- Watchlists table
CREATE TABLE IF NOT EXISTS public.watchlists (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Watchlist items (one company per watchlist)
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  watchlist_id uuid REFERENCES public.watchlists(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  company_name text,
  added_at timestamp with time zone DEFAULT now(),
  UNIQUE(watchlist_id, symbol)
);

-- RLS for watchlists
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlists"
  ON public.watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own watchlist items"
  ON public.watchlist_items FOR ALL
  USING (
    watchlist_id IN (
      SELECT id FROM public.watchlists WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    watchlist_id IN (
      SELECT id FROM public.watchlists WHERE user_id = auth.uid()
    )
  );
