"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { fmt, fmtCompact } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart2 } from "lucide-react";
import type { Holding, Transaction } from "@/types";

interface EnrichedHolding extends Holding {
  livePrice: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
  currentValue: number | null;
}

const COLORS = ["#1D9E75","#378ADD","#D85A30","#7F77DD","#BA7517","#D4537E","#639922","#E24B4A"];

export default function PortfolioPage() {
  const supabase = createClient();
  const [enriched, setEnriched] = useState<EnrichedHolding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
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
            const lp = price.last_price;
            const unrealised = h.quantity * (lp - h.avg_price);
            const unrealisedPct = ((lp - h.avg_price) / h.avg_price) * 100;
            return { ...h, livePrice: lp, unrealised, unrealisedPct, currentValue: h.quantity * lp };
          } catch {
            return { ...h, livePrice: null, unrealised: null, unrealisedPct: null, currentValue: null };
          }
        })
      );
      setEnriched(enrichedData);
      setLoading(false);
    });
  }, []);

  const totalInvested = enriched.reduce((s, h) => s + h.quantity * h.avg_price, 0);
  const totalCurrent = enriched.reduce((s, h) => s + (h.currentValue ?? h.quantity * h.avg_price), 0);
  const totalUnrealised = totalCurrent - totalInvested;
  const totalUnrealisedPct = totalInvested > 0 ? (totalUnrealised / totalInvested) * 100 : 0;

  // Realised P&L from sell transactions
  const realisedPL = transactions
    .filter(t => t.type === "SELL")
    .reduce((s, t) => {
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
    { label: "Current value", value: `Rs. ${fmtCompact(totalCurrent)}`, icon: TrendingUp, color: "text-ink" },
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
