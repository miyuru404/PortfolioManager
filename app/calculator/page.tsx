"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { fmt, round } from "@/lib/utils";
import { Calculator, RotateCcw, Save, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import type { Holding } from "@/types";

export default function CalculatorPage() {
  const supabase = createClient();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  // Scenario inputs
  const [buyPrice, setBuyPrice] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [budget, setBudget] = useState("");
  // Saving
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadHoldings(user.id); }
    });
  }, []);

  async function loadHoldings(uid: string) {
    const { data } = await supabase.from("holdings").select("*").eq("user_id", uid).order("symbol");
    if (data) setHoldings(data);
  }

  async function fetchLivePrice(symbol: string) {
    if (!symbol) return;
    setPriceLoading(true);
    try {
      const res = await fetch(`/api/cse/price?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!data.error) {
        const priceRounded = round(data.last_price, 2);
        setLivePrice(priceRounded);
        setBuyPrice(priceRounded.toString());
      }
    } catch {}
    setPriceLoading(false);
  }

  function handleSelectSymbol(sym: string) {
    setSelectedSymbol(sym);
    setBuyPrice(""); setBuyQty(""); setBudget("");
    setLivePrice(null); setSaveMsg("");
    if (sym) fetchLivePrice(sym);
  }

  const holding = holdings.find(h => h.symbol === selectedSymbol);
  const price = parseFloat(buyPrice) || 0;
  const qty = buyQty ? parseInt(buyQty) : budget ? Math.floor(parseFloat(budget) / price) : 0;
  const spent = qty * price;
  const remainingBudget = budget ? parseFloat(budget) - spent : null;

  let newAvg = holding?.avg_price ?? 0;
  let newQty = holding?.quantity ?? 0;
  if (holding && qty > 0 && price > 0) {
    newQty = holding.quantity + qty;
    newAvg = round(((holding.quantity * holding.avg_price) + (qty * price)) / newQty, 2);
  }

  const avgChange = newAvg - (holding?.avg_price ?? 0);
  const isAveragingDown = avgChange < 0;

  async function saveTransaction() {
    if (!holding || !userId || qty <= 0 || price <= 0) return;
    setSaving(true);
    const avgPricePersist = round(newAvg, 2);
    const { error } = await supabase.from("holdings").update({
      quantity: newQty,
      avg_price: avgPricePersist,
      updated_at: new Date().toISOString(),
    }).eq("id", holding.id);

    if (!error) {
      // Also log as transaction
      await supabase.from("transactions").insert({
        user_id: userId,
        symbol: holding.symbol,
        company_name: holding.company_name,
        type: "BUY",
        quantity: qty,
        price: price,
        total_amount: spent,
        notes: "Added via average calculator",
        traded_at: new Date().toISOString(),
      });
      loadHoldings(userId);
      setSaveMsg(`Updated! New avg: Rs. ${fmt(newAvg)} for ${newQty.toLocaleString()} shares.`);
      handleReset();
    }
    setSaving(false);
  }

  function handleReset() {
    setBuyPrice(livePrice?.toString() ?? "");
    setBuyQty(""); setBudget("");
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>Average Calculator</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
            Calculate how a new purchase changes your average price
          </p>
        </div>

        {saveMsg && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm animate-in">
            {saveMsg}
          </div>
        )}

        {/* Stock selector */}
        <div className="card">
          <label className="label">Select a company (from your master data)</label>
          {holdings.length === 0 ? (
            <div className="p-4 rounded-lg text-center" style={{ background: "rgb(var(--surface))" }}>
              <p className="text-sm" style={{ color: "rgb(var(--ink-muted))" }}>
                No holdings in master data yet.{" "}
                <a href="/masterdata" className="underline" style={{ color: "rgb(var(--brand-400))" }}>
                  Add your holdings first →
                </a>
              </p>
            </div>
          ) : (
            <div className="relative">
              <select className="input appearance-none pr-8" value={selectedSymbol}
                onChange={e => handleSelectSymbol(e.target.value)}>
                <option value="">— Select a company —</option>
                {holdings.map(h => (
                  <option key={h.symbol} value={h.symbol}>{h.symbol} — {h.company_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "rgb(var(--ink-faint))" }} />
            </div>
          )}
        </div>

        {holding && (
          <>
            {/* Current position */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card">
                <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Current shares</p>
                <p className="text-lg font-semibold font-mono">{holding.quantity.toLocaleString()}</p>
              </div>
              <div className="card">
                <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Your avg price</p>
                <p className="text-lg font-semibold font-mono">Rs. {fmt(holding.avg_price)}</p>
              </div>
              <div className="card">
                <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Live CSE price</p>
                {priceLoading ? (
                  <div className="h-7 w-24 rounded animate-pulse" style={{ background: "rgb(var(--surface))" }} />
                ) : livePrice ? (
                  <p className="text-lg font-semibold font-mono" style={{ color: "rgb(var(--brand-400))" }}>
                    Rs. {fmt(livePrice)}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "rgb(var(--ink-faint))" }}>N/A</p>
                )}
              </div>
            </div>

            {/* Inputs */}
            <div className="card space-y-4">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Scenario inputs</p>
              <div>
                <label className="label">Buy price (Rs.) — default is live CSE price</label>
                <input className="input" type="number" step="0.01" placeholder="e.g. 450.00"
                  value={buyPrice} onChange={e => { setBuyPrice(e.target.value); setBuyQty(""); setBudget(""); }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Number of shares to buy</label>
                  <input className="input" type="number" min="1" placeholder="e.g. 100"
                    value={buyQty} onChange={e => { setBuyQty(e.target.value); setBudget(""); }}
                    disabled={!!budget} />
                </div>
                <div>
                  <label className="label">Or enter budget (Rs.)</label>
                  <input className="input" type="number" step="100" placeholder="e.g. 50000"
                    value={budget} onChange={e => { setBudget(e.target.value); setBuyQty(""); }}
                    disabled={!!buyQty} />
                  {budget && price > 0 && (
                    <p className="text-xs mt-1" style={{ color: "rgb(var(--ink-faint))" }}>
                      You can buy <strong>{qty.toLocaleString()}</strong> shares
                    </p>
                  )}
                </div>
              </div>

              <button onClick={handleReset} className="btn-ghost flex items-center gap-2 text-xs">
                <RotateCcw className="w-3 h-3" /> Reset to defaults
              </button>
            </div>

            {/* Result */}
            {qty > 0 && price > 0 && (
              <div className="card animate-in">
                <p className="text-sm font-medium mb-4" style={{ color: "rgb(var(--ink))" }}>
                  Scenario result
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                    <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Shares to buy</p>
                    <p className="text-xl font-semibold font-mono">{qty.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                    <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Amount to invest</p>
                    <p className="text-xl font-semibold font-mono">Rs. {fmt(spent)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                    <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>Total shares after</p>
                    <p className="text-xl font-semibold font-mono">{newQty.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    isAveragingDown ? "bg-green-500/10" : avgChange > 0 ? "bg-red-500/10" : ""
                  }`} style={!isAveragingDown && avgChange === 0 ? { background: "rgb(var(--surface))" } : {}}>
                    <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>New average price</p>
                    <p className={`text-xl font-semibold font-mono ${
                      isAveragingDown ? "text-green-500" : avgChange > 0 ? "text-red-500" : ""
                    }`}>
                      Rs. {fmt(newAvg)}
                    </p>
                    {avgChange !== 0 && (
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${isAveragingDown ? "text-green-500" : "text-red-500"}`}>
                        {isAveragingDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {isAveragingDown ? "" : "+"}{fmt(avgChange)} vs current avg
                        {isAveragingDown && " — averaging down ✓"}
                      </p>
                    )}
                  </div>
                </div>

                {remainingBudget !== null && (
                  <div className="p-3 rounded-lg mb-4" style={{ background: "rgb(var(--surface))" }}>
                    <p className="text-xs" style={{ color: "rgb(var(--ink-muted))" }}>
                      Remaining from budget:{" "}
                      <strong className="font-mono">Rs. {fmt(remainingBudget)}</strong>
                    </p>
                  </div>
                )}

                <button onClick={saveTransaction} disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Add transaction & update master data"}
                </button>
                <p className="text-xs mt-2 text-center" style={{ color: "rgb(var(--ink-faint))" }}>
                  This updates your holding quantity and average price
                </p>
              </div>
            )}
          </>
        )}

        {!selectedSymbol && holdings.length > 0 && (
          <div className="card text-center py-12">
            <Calculator className="w-8 h-8 mx-auto mb-3" style={{ color: "rgb(var(--ink-faint))" }} />
            <p className="text-sm" style={{ color: "rgb(var(--ink-faint))" }}>
              Select a company above to start calculating
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
