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

export interface CSEStock {
  symbol: string;
  name: string;
  lastTradedPrice: number;
  change: number;
  changePercentage: number;
  marketCap: number;
}
