"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase";
import { fmt, round } from "@/lib/utils";
import { calculateFees, DEFAULT_MARKET_FEES } from "@/lib/fees";
import { Calculator, RotateCcw, Save, TrendingUp, TrendingDown, ChevronDown, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import type { Holding, Broker, MarketFees } from "@/types";

type Mode = "buy" | "sell";

export default function CalculatorPage() {
  const supabase = createClient();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("buy");

  // Brokers & fees
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [marketFees, setMarketFees] = useState<MarketFees>(DEFAULT_MARKET_FEES);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");

  // Buy inputs
  const [buyPrice, setBuyPrice] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [budget, setBudget] = useState("");

  // Sell inputs
  const [sellPrice, setSellPrice] = useState("");
  const [sellQty, setSellQty] = useState("");

  // Saving
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadHoldings(user.id);
        loadBrokersAndFees(user.id);
      }
    });
  }, []);

  async function loadHoldings(uid: string) {
    const { data } = await supabase.from("holdings").select("*").eq("user_id", uid).order("symbol");
    if (data) setHoldings(data);
  }

  async function loadBrokersAndFees(uid: string) {
    const [{ data: b }, { data: f }] = await Promise.all([
      supabase.from("brokers").select("*").eq("user_id", uid).order("created_at"),
      supabase.from("market_fees").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    if (b) {
      setBrokers(b);
      const def = b.find((x: Broker) => x.is_default) || b[0];
      if (def) setSelectedBrokerId(def.id);
    }
    if (f) setMarketFees(f);
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
        setSellPrice(priceRounded.toString());
      }
    } catch {}
    setPriceLoading(false);
  }

  function handleSelectSymbol(sym: string) {
    setSelectedSymbol(sym);
    setBuyPrice(""); setBuyQty(""); setBudget("");
    setSellPrice(""); setSellQty("");
    setLivePrice(null); setSaveMsg("");
    if (sym) fetchLivePrice(sym);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setSaveMsg("");
  }

  const holding = holdings.find(h => h.symbol === selectedSymbol);
  const selectedBroker = brokers.find(b => b.id === selectedBrokerId) || null;

  // ---- Buy scenario ----
  const price = parseFloat(buyPrice) || 0;
  const qty = buyQty ? parseInt(buyQty) : budget ? Math.floor(parseFloat(budget) / price) : 0;
  const tradeValue = qty * price;
  const remainingBudget = budget ? parseFloat(budget) - tradeValue : null;
  const buyFees = calculateFees(tradeValue, selectedBroker, marketFees);

  let newAvg = holding?.avg_price ?? 0;
  let newQty = holding?.quantity ?? 0;
  if (holding && qty > 0 && price > 0) {
    newQty = holding.quantity + qty;
    newAvg = round(((holding.quantity * holding.avg_price) + buyFees.netBuyCost) / newQty, 2);
  }
  const avgChange = newAvg - (holding?.avg_price ?? 0);
  const isAveragingDown = avgChange < 0;

  // ---- Sell scenario ----
  const sPrice = parseFloat(sellPrice) || 0;
  const sQty = sellQty ? parseInt(sellQty) : 0;
  const sTradeValue = sQty * sPrice;
  const sellFees = calculateFees(sTradeValue, selectedBroker, marketFees);
  const costBasis = holding ? sQty * holding.avg_price : 0;
  const realizedPL = round(sellFees.netSellProceeds - costBasis, 2);
  const remainingQty = (holding?.quantity ?? 0) - sQty;
  const sellExceedsHolding = !!holding && sQty > holding.quantity;

  async function saveBuy() {
    if (!holding || !userId || qty <= 0 || price <= 0) return;
    setSaving(true);
    const { error } = await supabase.from("holdings").update({
      quantity: newQty,
      avg_price: round(newAvg, 2),
      updated_at: new Date().toISOString(),
    }).eq("id", holding.id);

    if (!error) {
      await supabase.from("transactions").insert({
        user_id: userId,
        symbol: holding.symbol,
        company_name: holding.company_name,
        type: "BUY",
        quantity: qty,
        price: price,
        total_amount: tradeValue,
        broker_id: selectedBrokerId || null,
        commission_amount: buyFees.commission,
        levies_amount: buyFees.totalLevies,
        net_amount: buyFees.netBuyCost,
        notes: "Added via average calculator",
        traded_at: new Date().toISOString(),
      });
      loadHoldings(userId);
      setSaveMsg(`Updated! New avg: Rs. ${fmt(newAvg)} for ${newQty.toLocaleString()} shares (incl. Rs. ${fmt(buyFees.totalFees)} fees).`);
      handleReset();
    }
    setSaving(false);
  }

  async function saveSell() {
    if (!holding || !userId || sQty <= 0 || sPrice <= 0 || sellExceedsHolding) return;
    setSaving(true);

    const { error } = remainingQty === 0
      ? await supabase.from("holdings").delete().eq("id", holding.id)
      : await supabase.from("holdings").update({
          quantity: remainingQty,
          updated_at: new Date().toISOString(),
        }).eq("id", holding.id);

    if (!error) {
      await supabase.from("transactions").insert({
        user_id: userId,
        symbol: holding.symbol,
        company_name: holding.company_name,
        type: "SELL",
        quantity: sQty,
        price: sPrice,
        total_amount: sTradeValue,
        broker_id: selectedBrokerId || null,
        commission_amount: sellFees.commission,
        levies_amount: sellFees.totalLevies,
        net_amount: sellFees.netSellProceeds,
        realized_pl: realizedPL,
        notes: "Sold via average calculator",
        traded_at: new Date().toISOString(),
      });
      loadHoldings(userId);
      setSaveMsg(
        `Sold ${sQty.toLocaleString()} shares. Net proceeds Rs. ${fmt(sellFees.netSellProceeds)} · ` +
        `Realised P&L ${realizedPL >= 0 ? "+" : ""}Rs. ${fmt(realizedPL)}.`
      );
      handleReset();
    }
    setSaving(false);
  }

  function handleReset() {
    setBuyPrice(livePrice?.toString() ?? "");
    setBuyQty(""); setBudget("");
    setSellPrice(livePrice?.toString() ?? "");
    setSellQty("");
  }

  const feesForDisplay = mode === "buy" ? buyFees : sellFees;
  const showFeeBreakdown = mode === "buy" ? tradeValue > 0 : sTradeValue > 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Average Calculator" subtitle="Buy or sell with commission and levies applied" />

        <div className="space-y-6">
          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as Mode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs sm:text-sm font-semibold uppercase tracking-wide border transition-colors ${
                  mode === m ? "border-brand-400" : "border-surface-border hover:bg-surface"
                }`}
                style={mode === m ? { background: "rgb(var(--brand-400))", color: "white" } : { color: "rgb(var(--ink-muted))" }}>
                {m === "buy" ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                {m === "buy" ? "Buy · Average down" : "Sell · Realise"}
              </button>
            ))}
          </div>

          {saveMsg && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm animate-in">
              {saveMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT: selection + scenario inputs */}
            <div className="space-y-6">
              <div className="card">
                <label className="label">Company (from your master data)</label>
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

              <div className="card">
                <label className="label">Broker (for commission calculation)</label>
                {brokers.length === 0 ? (
                  <p className="text-sm" style={{ color: "rgb(var(--ink-muted))" }}>
                    No brokers set up yet — commission will be Rs. 0, only CSE/SEC/CDS fees apply.{" "}
                    <a href="/settings" className="underline" style={{ color: "rgb(var(--brand-400))" }}>
                      Add a broker in Settings →
                    </a>
                  </p>
                ) : (
                  <div className="relative">
                    <select className="input appearance-none pr-8" value={selectedBrokerId}
                      onChange={e => setSelectedBrokerId(e.target.value)}>
                      <option value="">No broker (fees only)</option>
                      {brokers.map(b => (
                        <option key={b.id} value={b.id}>{b.name} — {b.commission_rate}%</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: "rgb(var(--ink-faint))" }} />
                  </div>
                )}
              </div>

              {holding && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card">
                      <p className="stat-label mb-1">Shares held</p>
                      <p className="font-heading text-lg">{holding.quantity.toLocaleString()}</p>
                    </div>
                    <div className="card">
                      <p className="stat-label mb-1">Your average</p>
                      <p className="font-heading text-lg">Rs. {fmt(holding.avg_price)}</p>
                    </div>
                    <div className="card">
                      <p className="stat-label mb-1">Live CSE price</p>
                      {priceLoading ? (
                        <div className="h-6 w-20 rounded animate-pulse" style={{ background: "rgb(var(--surface))" }} />
                      ) : livePrice ? (
                        <p className="font-heading text-lg" style={{ color: "rgb(var(--brand-400))" }}>
                          Rs. {fmt(livePrice)}
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: "rgb(var(--ink-faint))" }}>N/A</p>
                      )}
                    </div>
                  </div>

                  {mode === "buy" ? (
                    <div className="card space-y-4">
                      <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Scenario inputs</p>
                      <div>
                        <label className="label">Buy price (Rs.) — defaults to the live price</label>
                        <input className="input" type="number" step="0.01" placeholder="e.g. 450.00"
                          value={buyPrice} onChange={e => { setBuyPrice(e.target.value); setBuyQty(""); setBudget(""); }} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Shares to buy</label>
                          <input className="input" type="number" min="1" placeholder="e.g. 100"
                            value={buyQty} onChange={e => { setBuyQty(e.target.value); setBudget(""); }}
                            disabled={!!budget} />
                        </div>
                        <div>
                          <label className="label">Or budget (Rs.)</label>
                          <input className="input" type="number" step="100" placeholder="e.g. 50000"
                            value={budget} onChange={e => { setBudget(e.target.value); setBuyQty(""); }}
                            disabled={!!buyQty} />
                          {budget && price > 0 && (
                            <p className="text-xs mt-1" style={{ color: "rgb(var(--ink-faint))" }}>
                              Leave blank to size by share count
                            </p>
                          )}
                        </div>
                      </div>
                      <button onClick={handleReset} className="btn-ghost flex items-center gap-2">
                        <RotateCcw className="w-3 h-3" /> Reset to defaults
                      </button>
                    </div>
                  ) : (
                    <div className="card space-y-4">
                      <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Scenario inputs</p>
                      <div>
                        <label className="label">Sell price (Rs.) — defaults to the live price</label>
                        <input className="input" type="number" step="0.01" placeholder="e.g. 450.00"
                          value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Shares to sell (you hold {holding.quantity.toLocaleString()})</label>
                        <input className="input" type="number" min="1" max={holding.quantity} placeholder="e.g. 100"
                          value={sellQty} onChange={e => setSellQty(e.target.value)} />
                        <div className="flex items-center justify-between mt-1">
                          {sellExceedsHolding && (
                            <p className="text-xs text-red-500">Can't sell more than you hold</p>
                          )}
                          <button onClick={() => setSellQty(holding.quantity.toString())}
                            className="text-xs ml-auto font-medium" style={{ color: "rgb(var(--brand-500))" }}>
                            Sell all
                          </button>
                        </div>
                      </div>
                      <button onClick={handleReset} className="btn-ghost flex items-center gap-2">
                        <RotateCcw className="w-3 h-3" /> Reset to defaults
                      </button>
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

            {/* RIGHT: result + fee breakdown */}
            <div className="space-y-6">
              {holding && mode === "buy" && qty > 0 && price > 0 && (
                <div className="card animate-in">
                  <p className="stat-label mb-4">Result</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Shares to buy</p>
                      <p className="font-heading text-xl">{qty.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Total cost incl. fees</p>
                      <p className="font-heading text-xl">Rs. {fmt(buyFees.netBuyCost)}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Position after</p>
                      <p className="font-heading text-xl">{newQty.toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      isAveragingDown ? "bg-green-500/10" : avgChange > 0 ? "bg-red-500/10" : ""
                    }`} style={!isAveragingDown && avgChange === 0 ? { background: "rgb(var(--surface))" } : {}}>
                      <p className="stat-label mb-1">New average price</p>
                      <p className={`font-heading text-xl ${
                        isAveragingDown ? "text-green-500" : avgChange > 0 ? "text-red-500" : ""
                      }`}>
                        Rs. {fmt(newAvg)}
                      </p>
                      {avgChange !== 0 && (
                        <p className={`text-xs flex items-center gap-1 mt-0.5 ${isAveragingDown ? "text-green-500" : "text-red-500"}`}>
                          {isAveragingDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {isAveragingDown ? "" : "+"}{fmt(avgChange)} vs current average
                        </p>
                      )}
                    </div>
                  </div>

                  {remainingBudget !== null && (() => {
                    const afterFees = remainingBudget - buyFees.totalFees;
                    return (
                      <div className="p-3 rounded-lg mb-4" style={{ background: "rgb(var(--surface))" }}>
                        <p className="text-xs" style={{ color: afterFees < 0 ? "rgb(239 68 68)" : "rgb(var(--ink-muted))" }}>
                          {afterFees < 0 ? "Over budget once fees are included: " : "Remaining from budget after fees: "}
                          <strong className="font-mono">Rs. {fmt(Math.abs(afterFees))}</strong>
                          {afterFees < 0 ? " short" : ""}
                        </p>
                      </div>
                    );
                  })()}

                  <button onClick={saveBuy} disabled={saving}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Log buy & update master data"}
                  </button>
                  <p className="text-xs mt-2 text-center" style={{ color: "rgb(var(--ink-faint))" }}>
                    This updates your holding quantity and average price (fees included)
                  </p>
                </div>
              )}

              {holding && mode === "sell" && sQty > 0 && sPrice > 0 && (
                <div className="card animate-in">
                  <p className="stat-label mb-4">Result</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Shares to sell</p>
                      <p className="font-heading text-xl">{sQty.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Net proceeds after fees</p>
                      <p className="font-heading text-xl">Rs. {fmt(sellFees.netSellProceeds)}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                      <p className="stat-label mb-1">Shares remaining</p>
                      <p className="font-heading text-xl">{Math.max(remainingQty, 0).toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${realizedPL >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      <p className="stat-label mb-1">Realised P&amp;L</p>
                      <p className={`font-heading text-xl ${realizedPL >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {realizedPL >= 0 ? "+" : ""}Rs. {fmt(realizedPL)}
                      </p>
                    </div>
                  </div>

                  <button onClick={saveSell} disabled={saving || sellExceedsHolding}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Log sell & update master data"}
                  </button>
                  <p className="text-xs mt-2 text-center" style={{ color: "rgb(var(--ink-faint))" }}>
                    {remainingQty === 0
                      ? "This sells your entire position and removes it from master data"
                      : "This reduces your holding quantity (average price stays the same)"}
                  </p>
                </div>
              )}

              {holding && showFeeBreakdown && (
                <div className="card">
                  <p className="stat-label mb-3">
                    Commission &amp; levies{selectedBroker ? ` — ${selectedBroker.name}` : ""}
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ["Trade value", feesForDisplay.tradeValue],
                      ["Broker commission", feesForDisplay.commission],
                      ["CSE fee", feesForDisplay.cseFee],
                      ["SEC cess", feesForDisplay.secCess],
                      ["CDS fee", feesForDisplay.cdsFee],
                      ["Share transaction levy", feesForDisplay.shareTransactionLevy],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between">
                        <span style={{ color: "rgb(var(--ink-muted))" }}>{label}</span>
                        <span className="font-mono">Rs. {fmt(value as number)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1.5 mt-1.5 border-t font-medium"
                      style={{ borderColor: "rgb(var(--surface-border))" }}>
                      <span>Total fees</span>
                      <span className="font-mono">Rs. {fmt(feesForDisplay.totalFees)}</span>
                    </div>
                    <div className="flex justify-between font-semibold" style={{ color: "rgb(var(--ink))" }}>
                      <span>{mode === "buy" ? "Total cost" : "Net proceeds"}</span>
                      <span className="font-mono">
                        Rs. {fmt(mode === "buy" ? feesForDisplay.netBuyCost : feesForDisplay.netSellProceeds)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
