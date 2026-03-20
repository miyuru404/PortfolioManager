"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StockSearch from "@/components/ui/StockSearch";
import { createClient } from "@/lib/supabase";
import { Pencil, Trash2, Check, X, Plus, Database } from "lucide-react";
import { fmt, round } from "@/lib/utils";
import type { Holding, CSEStock } from "@/types";

export default function MasterDataPage() {
  const supabase = createClient();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editAvg, setEditAvg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addStock, setAddStock] = useState<CSEStock | null>(null);
  const [addQty, setAddQty] = useState("");
  const [addAvg, setAddAvg] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadHoldings(user.id); }
    });
  }, []);

  async function loadHoldings(uid: string) {
    const { data } = await supabase.from("holdings").select("*").eq("user_id", uid).order("symbol");
    if (data) setHoldings(data);
  }

  async function saveEdit(h: Holding) {
    if (!editQty || !editAvg) return;
    setSaving(true);
    const avgRounded = round(parseFloat(editAvg), 2);
    const { error } = await supabase.from("holdings")
      .update({ quantity: parseInt(editQty), avg_price: avgRounded, updated_at: new Date().toISOString() })
      .eq("id", h.id);
    if (!error) {
      setHoldings(prev => prev.map(x => x.id === h.id
        ? { ...x, quantity: parseInt(editQty), avg_price: avgRounded }
        : x));
      setEditId(null);
      setMsg("Updated successfully");
      setTimeout(() => setMsg(""), 3000);
    }
    setSaving(false);
  }

  async function deleteHolding(id: string) {
    if (!confirm("Remove this holding? This won't affect your transaction history.")) return;
    await supabase.from("holdings").delete().eq("id", id);
    setHoldings(prev => prev.filter(x => x.id !== id));
  }

  async function addHolding() {
    if (!addStock || !addQty || !addAvg || !userId) return;
    setSaving(true);
    const avgRounded = round(parseFloat(addAvg), 2);
    const { error } = await supabase.from("holdings").upsert({
      user_id: userId,
      symbol: addStock.symbol,
      company_name: addStock.name,
      quantity: parseInt(addQty),
      avg_price: avgRounded,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,symbol" });
    if (!error) {
      loadHoldings(userId);
      setShowAdd(false); setAddStock(null); setAddQty(""); setAddAvg("");
      setMsg("Holding added successfully");
      setTimeout(() => setMsg(""), 3000);
    }
    setSaving(false);
  }

  const totalInvested = holdings.reduce((s, h) => s + h.quantity * h.avg_price, 0);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>Master Data</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
              Manage your holdings — these are used in the average calculator
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add holding
          </button>
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm animate-in">
            {msg}
          </div>
        )}

        {/* Add new holding */}
        {showAdd && (
          <div className="card animate-in">
            <p className="text-sm font-medium mb-4">Add new holding</p>
            <div className="space-y-3">
              <div>
                <label className="label">Search stock</label>
                <StockSearch onSelect={s => {
                    setAddStock(s);
                    setAddAvg(round(s.lastTradedPrice, 2).toString());
                  }}
                  placeholder="Search by symbol e.g. HNB.N0000..." />
                {addStock && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                      {addStock.symbol}
                    </span>
                    <span className="text-sm">{addStock.name}</span>
                    <button onClick={() => setAddStock(null)}>
                      <X className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-faint))" }} />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Number of shares</label>
                  <input className="input" type="number" min="1" placeholder="e.g. 412"
                    value={addQty} onChange={e => setAddQty(e.target.value)} />
                </div>
                <div>
                  <label className="label">Your average price (Rs.)</label>
                  <input className="input" type="number" step="0.01" placeholder="e.g. 455.50"
                    value={addAvg} onChange={e => setAddAvg(e.target.value)} />
                  <p className="text-xs mt-1" style={{ color: "rgb(var(--ink-faint))" }}>
                    Include broker fees in your average
                  </p>
                </div>
              </div>
              {addQty && addAvg && (
                <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface))" }}>
                  <p className="text-xs" style={{ color: "rgb(var(--ink-muted))" }}>
                    Total invested: <strong>Rs. {fmt(parseInt(addQty || "0") * parseFloat(addAvg || "0"))}</strong>
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addHolding} disabled={!addStock || !addQty || !addAvg || saving}
                  className="btn-primary">
                  {saving ? "Saving..." : "Save holding"}
                </button>
                <button onClick={() => { setShowAdd(false); setAddStock(null); setAddQty(""); setAddAvg(""); }}
                  className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {holdings.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total companies", value: holdings.length.toString() },
              { label: "Total shares", value: holdings.reduce((s,h) => s + h.quantity, 0).toLocaleString() },
              { label: "Total invested", value: `Rs. ${fmt(totalInvested)}` },
            ].map(m => (
              <div key={m.label} className="card">
                <p className="text-xs mb-1" style={{ color: "rgb(var(--ink-faint))" }}>{m.label}</p>
                <p className="text-base font-semibold font-mono">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Holdings table */}
        {holdings.length === 0 ? (
          <div className="card text-center py-16">
            <Database className="w-8 h-8 mx-auto mb-3" style={{ color: "rgb(var(--ink-faint))" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "rgb(var(--ink))" }}>No holdings yet</p>
            <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>
              Add your first holding to get started with the average calculator
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
                  {["Symbol", "Company", "Shares", "Avg Price", "Total Cost", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                      style={{ color: "rgb(var(--ink-faint))" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => (
                  <tr key={h.id} className="hover:bg-surface transition-colors"
                    style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                        {h.symbol}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "rgb(var(--ink-muted))" }}>{h.company_name}</td>
                    <td className="px-4 py-3 font-mono">
                      {editId === h.id ? (
                        <input className="input w-24 py-1" type="number" value={editQty}
                          onChange={e => setEditQty(e.target.value)} />
                      ) : h.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {editId === h.id ? (
                        <input className="input w-28 py-1" type="number" step="0.01" value={editAvg}
                          onChange={e => setEditAvg(e.target.value)} />
                      ) : `Rs. ${fmt(h.avg_price)}`}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: "rgb(var(--ink-muted))" }}>
                      Rs. {fmt(h.quantity * h.avg_price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editId === h.id ? (
                          <>
                            <button onClick={() => saveEdit(h)} className="p-1.5 rounded hover:bg-green-50">
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            </button>
                            <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-surface">
                              <X className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-faint))" }} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => {
                              setEditId(h.id);
                              setEditQty(h.quantity.toString());
                              setEditAvg(round(h.avg_price, 2).toString());
                            }}
                              className="p-1.5 rounded hover:bg-surface">
                              <Pencil className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-muted))" }} />
                            </button>
                            <button onClick={() => deleteHolding(h.id)}
                              className="p-1.5 rounded hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
