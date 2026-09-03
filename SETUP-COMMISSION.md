# Broker Commission & CSE Fees

## Background

Every CSE trade carries two kinds of cost:

1. **Broker commission** — set by whichever brokerage executes the trade.
   Historically capped at a regulated ceiling (0.64% on trades up to Rs. 100M,
   ~0.20% above that), but brokers negotiate below that ceiling — this varies
   by broker and sometimes by client. **This is why brokers are user-managed
   in this app, not hardcoded.**
2. **Exchange/regulatory levies** — fixed by the CSE/SEC/CDS, the same
   regardless of which broker you use:

   | Levy | Rate (trades ≤ Rs. 100M) |
   |---|---|
   | CSE Fee | 0.084% |
   | SEC Cess | 0.072% |
   | CDS Fee | 0.024% |
   | Share Transaction Levy | 0.300% |

   These are today's standard retail rates. The regulator does revise them
   occasionally (e.g. CSE revised debt-security transaction fees in
   September 2025), so they're kept editable in Settings rather than
   hardcoded — `lib/fees.ts` only supplies the starting defaults.

Sources: [CAL — What is the brokerage fee?](https://cal.lk/faq-items/what-is-the-brokerage-fee/),
[CSE Trading Details 2025](https://tonyjesuthasan.medium.com/colombo-stock-exchange-cse-trading-details-2025-explained-simply-30db37154043).

This app does not implement the >Rs. 100M tier — retail portfolio trades are
almost never that large. If you regularly trade above that size, edit the
rates in Settings manually for that transaction, or ask for the tiered
version to be added.

## 1. Run the database migration

In Supabase Dashboard → SQL Editor, run `supabase-migration-v3.sql`. It adds:

- `brokers` — the brokerage firm(s) you trade through, each with its own
  commission % and minimum fee
- `market_fees` — your copy of the CSE/SEC/CDS/levy rates (one row per user,
  defaults to the table above if you never save one)
- New columns on `transactions`: `broker_id`, `commission_amount`,
  `levies_amount`, `net_amount`, `realized_pl`

## 2. Add your broker(s)

Settings → **Brokers** → enter the brokerage name, its commission %, and a
minimum fee if it charges one. The first broker you add becomes the default
used in the Average Calculator; click the star icon on another to switch.

## 3. Use it

The **Average Calculator** now has **Buy** / **Sell** tabs:

- **Buy** — pick a broker, enter price + quantity (or a budget). The fee
  breakdown shows commission and each levy; your new average price already
  includes them, so Master Data never needs manual fee math again.
- **Sell** — pick a broker, enter price + quantity to sell. Shows net
  proceeds after fees and the realised P&L (net proceeds − original cost
  basis, which already includes the buy-side fees). Selling your full
  position removes the holding from Master Data; a partial sell just
  reduces the quantity (average price is unchanged, standard accounting).

Every transaction records which broker and how much commission/levies were
charged, so realised P&L on the Portfolio page is now commission-accurate
instead of the previous rough estimate.
