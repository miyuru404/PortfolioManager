"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { fmt, fmtCompact, round } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart2, Plus, FolderPlus, X, RefreshCw, Bookmark } from "lucide-react";
import FlashNumber from "@/components/ui/FlashNumber";
import StockSearch from "@/components/ui/StockSearch";
import StockCard from "@/components/ui/StockCard";
import StockRow from "@/components/ui/StockRow";
import { StockRowSkeleton } from "@/components/ui/Skeleton";
import type { Holding, Transaction, Watchlist, WatchlistItem, CSEStock } from "@/types";

interface EnrichedHolding extends Holding {
  livePrice: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
  currentValue: number | null;
}

interface WatchlistStockData {
  item: WatchlistItem;
  stock: CSEStock | null;
  holding: Holding | undefined;
  loading: boolean;
}

const COLORS = ["#1D9E75","#378ADD","#D85A30","#7F77DD","#BA7517","#D4537E","#639922","#E24B4A"];

// Splits a "1,234.56"-style formatted number into its whole and decimal
// parts so the hero figure can render the cents in a smaller, muted size.
function splitDecimal(formatted: string): [string, string] {
  const i = formatted.lastIndexOf(".");
  return i === -1 ? [formatted, ""] : [formatted.slice(0, i), formatted.slice(i)];
}

export default function PortfolioPage() {
  const supabase = createClient();
  const [enriched, setEnriched] = useState<EnrichedHolding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Watchlists (moved here from the old standalone Home page)
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWL, setActiveWL] = useState<string | null>(null);
  const [wlItems, setWlItems] = useState<WatchlistStockData[]>([]);
  const [searchResult, setSearchResult] = useState<CSEStock | null>(null);
  const [showNewWL, setShowNewWL] = useState(false);
  const [showAddWL, setShowAddWL] = useState(false);
  const [newWLName, setNewWLName] = useState("");
  const [addToWLStock, setAddToWLStock] = useState<CSEStock | null>(null);
  const [selectedWLForAdd, setSelectedWLForAdd] = useState<string>("");
  const [wlRefreshing, setWlRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      loadWatchlists(user.id);

      const [{ data: holdings }, { data: txns }] = await Promise.all([
        supabase.from("holdings").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("traded_at"),
      ]);
      if (txns) setTransactions(txns);
      if (!holdings) { setLoading(false); return; }

      const enrichedData: EnrichedHolding[] = await Promise.all(
        holdings.map(async (h) => {
          try {
            const res = await fetch(`/api/cse/price?symbol=${encodeURIComponent(h.symbol)}`);
            const price = await res.json();
            if (price.error) return { ...h, livePrice: null, unrealised: null, unrealisedPct: null, currentValue: null };
            const lp = round(price.last_price, 2);
            const unrealised = round(h.quantity * (lp - h.avg_price), 2);
            const unrealisedPct = round(((lp - h.avg_price) / h.avg_price) * 100, 2);
            return { ...h, livePrice: lp, unrealised, unrealisedPct, currentValue: round(h.quantity * lp, 2) };
          } catch {
            return { ...h, livePrice: null, unrealised: null, unrealisedPct: null, currentValue: null };
          }
        })
      );
      setEnriched(enrichedData);
      setLoading(false);
    });
  }, []);

  async function loadWatchlists(uid: string) {
    const { data } = await supabase
      .from("watchlists").select("*").eq("user_id", uid).order("created_at");
    if (data) {
      setWatchlists(data);
      if (data.length > 0 && !activeWL) {
        setActiveWL(data[0].id);
        loadWLItems(data[0].id);
      }
    }
  }

  async function loadWLItems(wlId: string) {
    const { data } = await supabase
      .from("watchlist_items").select("*").eq("watchlist_id", wlId).order("added_at");
    if (!data) return;
    const items: WatchlistStockData[] = data.map(item => ({
      item, stock: null, holding: undefined, loading: true
    }));
    setWlItems(items);
    // Fetch prices for each
    data.forEach(async (item, i) => {
      try {
        const res = await fetch(`/api/cse/price?symbol=${encodeURIComponent(item.symbol)}`);
        const stock = await res.json();
        setWlItems(prev => prev.map((x, idx) => idx === i
          ? { ...x, stock: stock.error ? null : {
              symbol: stock.symbol, name: stock.company_name,
              lastTradedPrice: stock.last_price, change: stock.change,
              changePercentage: stock.change_pct, marketCap: stock.market_cap
            }, loading: false }
          : x));
      } catch {
        setWlItems(prev => prev.map((x, idx) => idx === i ? { ...x, loading: false } : x));
      }
    });
  }

  async function createWatchlist() {
    if (!newWLName.trim() || !userId) return;
    const { data } = await supabase.from("watchlists")
      .insert({ user_id: userId, name: newWLName.trim() }).select().single();
    if (data) {
      setWatchlists(prev => [...prev, data]);
      setNewWLName(""); setShowNewWL(false);
      setActiveWL(data.id); setWlItems([]);
    }
  }

  async function addToWatchlist(stock: CSEStock, wlId: string) {
    if (!wlId) return;
    const { error } = await supabase.from("watchlist_items").insert({
      watchlist_id: wlId,
      symbol: stock.symbol,
      company_name: stock.name,
    });
    if (!error) {
      if (wlId === activeWL) loadWLItems(wlId);
      setShowAddWL(false); setAddToWLStock(null); setSearchResult(null);
    } else if (error.code === "23505") {
      alert("This stock is already in that watchlist.");
    }
  }

  async function removeFromWatchlist(itemId: string) {
    await supabase.from("watchlist_items").delete().eq("id", itemId);
    setWlItems(prev => prev.filter(x => x.item.id !== itemId));
  }

  function handleSearchSelect(stock: CSEStock) {
    setSearchResult(stock);
    setAddToWLStock(stock);
  }

  async function refreshWLPrices() {
    setWlRefreshing(true);
    if (activeWL) await loadWLItems(activeWL);
    setWlRefreshing(false);
  }

  const activeWLData = watchlists.find(w => w.id === activeWL);

  const totalInvested = enriched.reduce((s, h) => s + h.quantity * h.avg_price, 0);
  const totalCurrent = enriched.reduce((s, h) => s + (h.currentValue ?? h.quantity * h.avg_price), 0);
  const totalUnrealised = totalCurrent - totalInvested;
  const totalUnrealisedPct = totalInvested > 0 ? (totalUnrealised / totalInvested) * 100 : 0;

  // Realised P&L from sell transactions. Sells logged via the Average
  // Calculator store the true realised P&L (net-of-fees proceeds minus the
  // cost basis at the time of sale) directly on the transaction row.
  // Older sell rows without that field (logged before commission tracking
  // was added) fall back to the previous approximation.
  const realisedPL = transactions
    .filter(t => t.type === "SELL")
    .reduce((s, t) => {
      if (t.realized_pl !== undefined && t.realized_pl !== null) return s + t.realized_pl;
      const buyCost = t.quantity * (enriched.find(h => h.symbol === t.symbol)?.avg_price ?? t.price);
      return s + (t.total_amount - buyCost);
    }, 0);

  // Pie data
  const pieData = enriched
    .filter(h => h.currentValue !== null)
    .map(h => ({ name: h.symbol, value: h.currentValue! }));

  // Bar chart data
  const barData = enriched.map(h => ({
    symbol: h.symbol.split(".")[0],
    gain: h.unrealised !== null ? parseFloat(h.unrealised.toFixed(0)) : 0,
    pct: h.unrealisedPct !== null ? parseFloat(h.unrealisedPct.toFixed(2)) : 0,
  }));

  // Portfolio value over time (approximate from transactions)
  const lineData = (() => {
    if (transactions.length === 0) return [];
    const byDate: Record<string, number> = {};
    let runningCost = 0;
    transactions.forEach(t => {
      const date = t.traded_at.split("T")[0];
      if (t.type === "BUY") runningCost += t.total_amount;
      else runningCost -= t.total_amount;
      byDate[date] = runningCost;
    });
    return Object.entries(byDate).map(([date, value]) => ({ date, value: parseFloat(value.toFixed(2)) }));
  })();

  const summaryCards = [
    { label: "Total invested", value: `Rs. ${fmtCompact(totalInvested)}`, icon: DollarSign, color: "text-ink" },
    {
      label: "Unrealised P&L",
      value: `${totalUnrealised >= 0 ? "+" : ""}Rs. ${fmtCompact(Math.abs(totalUnrealised))}`,
      icon: totalUnrealised >= 0 ? TrendingUp : TrendingDown,
      color: totalUnrealised >= 0 ? "text-green-500" : "text-red-500"
    },
    {
      label: "Total return",
      value: `${totalUnrealisedPct >= 0 ? "+" : ""}${fmt(totalUnrealisedPct, 1)}%`,
      icon: Percent,
      color: totalUnrealisedPct >= 0 ? "text-green-500" : "text-red-500"
    },
  ];

  if (loading) return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: "rgb(var(--surface-raised))" }} />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>Portfolio & P&L</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
            Live performance based on CSE prices and your master data
          </p>
        </div>

        {/* Hero: current portfolio value (serif "statement" numeral, Quiet Premium style) */}
        {enriched.length > 0 && (
          <div className="pb-7 border-b border-surface-border">
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: "rgb(var(--ink-faint))" }}>
              Current Value
            </p>
            <div className="flex items-baseline gap-4 flex-wrap mt-2">
              <FlashNumber
                value={totalCurrent}
                formatter={(v) => {
                  const [whole, decimals] = splitDecimal(fmt(v));
                  return (
                    <>
                      Rs.&nbsp;{whole}
                      <span className="text-xl sm:text-3xl" style={{ color: "rgb(var(--ink-faint))" }}>{decimals}</span>
                    </>
                  );
                }}
                className="font-hero text-4xl sm:text-6xl tracking-tight"
              />
              <span className={`text-sm font-mono font-medium ${totalUnrealised >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalUnrealised >= 0 ? "+" : ""}Rs. {fmtCompact(Math.abs(totalUnrealised))} (
                {totalUnrealisedPct >= 0 ? "+" : ""}
                {fmt(totalUnrealisedPct, 1)}%)
              </span>
            </div>
            <div className="w-14 h-0.5 mt-5" style={{ background: "rgb(var(--brand-500))" }} />
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>{label}</p>
              </div>
              <p className={`text-xl font-semibold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Watchlists (moved here from the old standalone Home page) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "rgb(var(--ink))" }}>Watchlists</h2>
              <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
                Your watchlists & live CSE prices
              </p>
            </div>
            <button onClick={refreshWLPrices} disabled={wlRefreshing}
              className="btn-ghost flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${wlRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="card mb-4">
            <p className="text-sm font-medium mb-3" style={{ color: "rgb(var(--ink))" }}>
              Search any CSE stock
            </p>
            <StockSearch onSelect={handleSearchSelect} />
            {searchResult && (
              <div className="mt-4 animate-in">
                <StockCard
                  stock={searchResult}
                  holding={enriched.find(h => h.symbol === searchResult.symbol)}
                  showWatchlistButton
                  onAddToWatchlist={() => { setAddToWLStock(searchResult); setShowAddWL(true); }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Bookmark className="w-4 h-4" style={{ color: "rgb(var(--ink-muted))" }} />
            {watchlists.map(wl => (
              <button key={wl.id}
                onClick={() => { setActiveWL(wl.id); loadWLItems(wl.id); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeWL === wl.id
                    ? "text-white"
                    : "hover:bg-surface border border-surface-border"
                }`}
                style={activeWL === wl.id
                  ? { background: "rgb(var(--brand-400))", color: "white" }
                  : { color: "rgb(var(--ink-muted))" }}>
                {wl.name}
              </button>
            ))}
            <button onClick={() => setShowNewWL(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-dashed transition-colors hover:bg-surface"
              style={{ borderColor: "rgb(var(--surface-border))", color: "rgb(var(--ink-faint))" }}>
              <Plus className="w-3.5 h-3.5" />
              New watchlist
            </button>
          </div>

          {/* New watchlist modal */}
          {showNewWL && (
            <div className="card mb-4 animate-in">
              <p className="text-sm font-medium mb-3">Create new watchlist</p>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="e.g. Blue chips, Long term..."
                  value={newWLName} onChange={e => setNewWLName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createWatchlist()} autoFocus />
                <button onClick={createWatchlist} className="btn-primary">Create</button>
                <button onClick={() => { setShowNewWL(false); setNewWLName(""); }} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {/* Add to watchlist modal */}
          {showAddWL && addToWLStock && (
            <div className="card mb-4 animate-in border-brand-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  Add <span style={{ color: "rgb(var(--brand-500))" }}>{addToWLStock.symbol}</span> to watchlist
                </p>
                <button onClick={() => setShowAddWL(false)}>
                  <X className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />
                </button>
              </div>
              <div className="flex gap-2">
                <select className="input flex-1"
                  value={selectedWLForAdd} onChange={e => setSelectedWLForAdd(e.target.value)}>
                  <option value="">Select a watchlist...</option>
                  {watchlists.map(wl => (
                    <option key={wl.id} value={wl.id}>{wl.name}</option>
                  ))}
                </select>
                <button onClick={() => selectedWLForAdd && addToWatchlist(addToWLStock, selectedWLForAdd)}
                  className="btn-primary">Add</button>
              </div>
            </div>
          )}

          {/* Watchlist items */}
          {watchlists.length === 0 ? (
            <div className="card text-center py-12">
              <FolderPlus className="w-8 h-8 mx-auto mb-3" style={{ color: "rgb(var(--ink-faint))" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "rgb(var(--ink))" }}>No watchlists yet</p>
              <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>
                Create a watchlist and search for stocks to add
              </p>
            </div>
          ) : wlItems.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm" style={{ color: "rgb(var(--ink-faint))" }}>
                No stocks in <strong>{activeWLData?.name}</strong> yet.
                Search above and add stocks here.
              </p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-surface-border overflow-hidden">
              {wlItems.map(({ item, stock, holding, loading: itemLoading }) => (
                <div key={item.id} className="relative group">
                  {itemLoading ? (
                    <StockRowSkeleton />
                  ) : stock ? (
                    <StockRow
                      stock={stock}
                      holding={enriched.find(h => h.symbol === item.symbol)}
                    />
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <span className="font-mono text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                        {item.symbol}
                      </span>
                      <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>
                        Price unavailable
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => removeFromWatchlist(item.id)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/10"
                    title="Remove from watchlist">
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {realisedPL !== 0 && (
          <div className="card">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Realised P&L (from sold positions)</p>
            <p className={`text-xl font-semibold font-mono ${realisedPL >= 0 ? "text-green-500" : "text-red-500"}`}>
              {realisedPL >= 0 ? "+" : ""}Rs. {fmt(Math.abs(realisedPL))}
            </p>
          </div>
        )}

        {enriched.length === 0 ? (
          <div className="card text-center py-16">
            <BarChart2 className="w-8 h-8 mx-auto mb-3" style={{ color: "rgb(var(--ink-faint))" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "rgb(var(--ink))" }}>No holdings to display</p>
            <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>
              Add holdings in Master Data to see your portfolio performance
            </p>
          </div>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <div className="card">
                <p className="text-sm font-medium mb-4" style={{ color: "rgb(var(--ink))" }}>Portfolio allocation</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`Rs. ${fmtCompact(v)}`, "Value"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs truncate" style={{ color: "rgb(var(--ink-muted))" }}>
                        {d.name.split(".")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart */}
              <div className="card">
                <p className="text-sm font-medium mb-4" style={{ color: "rgb(var(--ink))" }}>Unrealised gain / loss per stock</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
                    <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
                      tickFormatter={v => `${v >= 0 ? "+" : ""}${fmtCompact(v)}`} />
                    <Tooltip formatter={(v: number) => [`Rs. ${fmt(v)}`, "Gain/Loss"]} />
                    <Bar dataKey="gain" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.gain >= 0 ? "#1D9E75" : "#E24B4A"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line chart */}
            {lineData.length > 1 && (
              <div className="card">
                <p className="text-sm font-medium mb-4" style={{ color: "rgb(var(--ink))" }}>Invested capital over time</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={lineData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }}
                      tickFormatter={v => `Rs.${fmtCompact(v)}`} />
                    <Tooltip formatter={(v: number) => [`Rs. ${fmt(v)}`, "Invested"]} />
                    <Line type="monotone" dataKey="value" stroke="rgb(var(--brand-400))"
                      strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Holdings table */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b" style={{ borderColor: "rgb(var(--surface-border))" }}>
                <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Holdings detail</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
                      {["Symbol","Shares","Avg Price","Live Price","Current Value","Unrealised","Return"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap"
                          style={{ color: "rgb(var(--ink-faint))" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map(h => (
                      <tr key={h.id} className="hover:bg-surface transition-colors"
                        style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-medium px-2 py-0.5 rounded"
                            style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                            {h.symbol}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{h.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">Rs. {fmt(h.avg_price)}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: "rgb(var(--brand-400))" }}>
                          {h.livePrice ? `Rs. ${fmt(h.livePrice)}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {h.currentValue ? `Rs. ${fmtCompact(h.currentValue)}` : "—"}
                        </td>
                        <td className={`px-4 py-3 font-mono font-medium ${
                          h.unrealised === null ? "" :
                          h.unrealised >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {h.unrealised !== null
                            ? `${h.unrealised >= 0 ? "+" : ""}Rs. ${fmtCompact(Math.abs(h.unrealised))}`
                            : "—"}
                        </td>
                        <td className={`px-4 py-3 font-mono text-xs ${
                          h.unrealisedPct === null ? "" :
                          h.unrealisedPct >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {h.unrealisedPct !== null
                            ? `${h.unrealisedPct >= 0 ? "+" : ""}${fmt(h.unrealisedPct, 2)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
