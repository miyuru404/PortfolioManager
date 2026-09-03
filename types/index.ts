export type Theme = "light" | "dark" | "midnight" | "darkgreen";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  theme: Theme;
  created_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string;
  quantity: number;
  avg_price: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total_amount: number;
  notes: string | null;
  traded_at: string;
  broker_id?: string | null;
  commission_amount?: number;
  levies_amount?: number;
  net_amount?: number | null;
  realized_pl?: number | null;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  company_name: string;
  added_at: string;
}

export interface PriceCache {
  symbol: string;
  company_name: string;
  last_price: number;
  change: number;
  change_pct: number;
  market_cap: number;
  volume: number;
  fetched_at: string;
}

export interface Broker {
  id: string;
  user_id: string;
  name: string;
  commission_rate: number; // percent, e.g. 0.64 means 0.64%
  min_fee: number;
  is_default: boolean;
  created_at: string;
}

export interface MarketFees {
  cse_fee_pct: number;
  sec_cess_pct: number;
  cds_fee_pct: number;
  share_transaction_levy_pct: number;
}

export interface CSEStock {
  symbol: string;
  name: string;
  lastTradedPrice: number;
  change: number;
  changePercentage: number;
  marketCap: number;
}
