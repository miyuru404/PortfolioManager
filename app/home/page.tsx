"use client";
import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StockSearch from "@/components/ui/StockSearch";
import StockCard from "@/components/ui/StockCard";
import { createClient } from "@/lib/supabase";
import { Plus, FolderPlus, X, ChevronDown, RefreshCw, Bookmark } from "lucide-react";
import type { Watchlist, WatchlistItem, Holding, CSEStock } from "@/types";

interface WatchlistStockData {
  item: WatchlistItem;
  stock: CSEStock | null;
  holding: Holding | undefined;
  loading: boolean;
}

export default function HomePage() {
  const supabase = createClient();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWL, setActiveWL] = useState<string | null>(null);
  const [wlItems, setWlItems] = useState<WatchlistStockData[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [searchResult, setSearchResult] = useState<CSEStock | null>(null);
  const [showNewWL, setShowNewWL] = useState(false);
  const [showAddWL, setShowAddWL] = useState(false);
  const [newWLName, setNewWLName] = useState("");
  const [addToWLStock, setAddToWLStock] = useState<CSEStock | null>(null);
  const [selectedWLForAdd, setSelectedWLForAdd] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadWatchlists(user.id);
        loadHoldings(user.id);
      }
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

  async function loadHoldings(uid: string) {
    const { data } = await supabase.from("holdings").select("*").eq("user_id", uid);
    if (data) setHoldings(data);
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

  async function refreshPrices() {
    setRefreshing(true);
    if (activeWL) await loadWLItems(activeWL);
    setRefreshing(false);
  }

  const activeWLData = watchlists.find(w => w.id === activeWL);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>Home</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
              Your watchlists & live CSE prices
            </p>
          </div>
          <button onClick={refreshPrices} disabled={refreshing}
            className="btn-ghost flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="card">
          <p className="text-sm font-medium mb-3" style={{ color: "rgb(var(--ink))" }}>
            Search any CSE stock
          </p>
          <StockSearch onSelect={handleSearchSelect} />
          {searchResult && (
            <div className="mt-4 animate-in">
              <StockCard
                stock={searchResult}
                holding={holdings.find(h => h.symbol === searchResult.symbol)}
                showWatchlistButton
                onAddToWatchlist={() => { setAddToWLStock(searchResult); setShowAddWL(true); }}
              />
            </div>
          )}
        </div>

        {/* Watchlists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {wlItems.map(({ item, stock, holding, loading }) => (
                <div key={item.id} className="relative group">
                  {loading ? (
                    <div className="card animate-pulse h-32" />
                  ) : stock ? (
                    <StockCard
                      stock={stock}
                      holding={holdings.find(h => h.symbol === item.symbol)}
                    />
                  ) : (
                    <div className="card">
                      <span className="font-mono text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                        {item.symbol}
                      </span>
                      <p className="text-xs mt-2" style={{ color: "rgb(var(--ink-faint))" }}>
                        Price unavailable
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => removeFromWatchlist(item.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50"
                    title="Remove from watchlist">
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
