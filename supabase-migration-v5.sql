-- Chart tab support: a small lookup view so the UI can list which symbols
-- have price history, without pulling all ~45k rows just to dedupe them
-- client-side. Read-only, derived entirely from price_history (no new
-- historical data table).

create or replace view public.chart_symbols as
select
  symbol,
  count(*)        as row_count,
  min(trade_date) as first_date,
  max(trade_date) as last_date
from public.price_history
group by symbol
order by symbol;

-- Views don't automatically inherit table grants in every Supabase setup,
-- so grant read explicitly (RLS on price_history still applies underneath
-- via the invoking role; either way this data is public market data).
grant select on public.chart_symbols to anon, authenticated;
