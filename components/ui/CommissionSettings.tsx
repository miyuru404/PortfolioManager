"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { DEFAULT_MARKET_FEES, DEFAULT_COMMISSION_RATE } from "@/lib/fees";
import { Plus, Star, Trash2, Check, RotateCcw } from "lucide-react";
import type { Broker, MarketFees } from "@/types";

interface Props {
  userId: string;
}

const FEE_FIELDS: [keyof MarketFees, string][] = [
  ["cse_fee_pct", "CSE Fee %"],
  ["sec_cess_pct", "SEC Cess %"],
  ["cds_fee_pct", "CDS Fee %"],
  ["share_transaction_levy_pct", "Share Transaction Levy %"],
];

export default function CommissionSettings({ userId }: Props) {
  const supabase = createClient();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState(DEFAULT_COMMISSION_RATE.toString());
  const [newMinFee, setNewMinFee] = useState("0");
  const [savingBroker, setSavingBroker] = useState(false);

  const [fees, setFees] = useState<MarketFees>(DEFAULT_MARKET_FEES);
  const [savingFees, setSavingFees] = useState(false);
  const [feesMsg, setFeesMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: b }, { data: f }] = await Promise.all([
      supabase.from("brokers").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("market_fees").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (b) setBrokers(b);
    if (f) setFees(f);
  }

  async function addBroker() {
    if (!newName.trim()) return;
    setSavingBroker(true);
    await supabase.from("brokers").insert({
      user_id: userId,
      name: newName.trim(),
      commission_rate: parseFloat(newRate) || 0,
      min_fee: parseFloat(newMinFee) || 0,
      is_default: brokers.length === 0, // first broker added becomes the default
    });
    setNewName(""); setNewRate(DEFAULT_COMMISSION_RATE.toString()); setNewMinFee("0");
    await load();
    setSavingBroker(false);
  }

  async function setDefault(id: string) {
    await supabase.from("brokers").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("brokers").update({ is_default: true }).eq("id", id);
    load();
  }

  async function deleteBroker(id: string) {
    if (!confirm("Remove this broker? Past transactions keep their recorded fees.")) return;
    await supabase.from("brokers").delete().eq("id", id);
    load();
  }

  async function saveFees() {
    setSavingFees(true);
    await supabase.from("market_fees").upsert(
      { user_id: userId, ...fees, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSavingFees(false);
    setFeesMsg("Saved");
    setTimeout(() => setFeesMsg(""), 2000);
  }

  return (
    <>
      {/* Brokers */}
      <div className="card">
        <p className="text-sm font-medium mb-1" style={{ color: "rgb(var(--ink))" }}>Brokers</p>
        <p className="text-xs mb-4" style={{ color: "rgb(var(--ink-muted))" }}>
          Add the brokerage firm(s) you trade through. Their commission rate is applied
          automatically when you log a buy or sell in the Average Calculator.
        </p>

        {brokers.length > 0 && (
          <div className="space-y-2 mb-4">
            {brokers.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "rgb(var(--surface))" }}>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {b.name}
                    {b.is_default && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-mono" style={{ color: "rgb(var(--ink-faint))" }}>
                    {b.commission_rate}% commission{b.min_fee > 0 ? ` · min Rs. ${b.min_fee}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!b.is_default && (
                    <button onClick={() => setDefault(b.id)} title="Set as default"
                      className="p-1.5 rounded hover:bg-surface-raised">
                      <Star className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-faint))" }} />
                    </button>
                  )}
                  <button onClick={() => deleteBroker(b.id)} className="p-1.5 rounded hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="label">Broker name</label>
            <input className="input" placeholder="e.g. NDB Securities" value={newName}
              onChange={e => setNewName(e.target.value)} />
          </div>
          <div>
            <label className="label">Commission %</label>
            <input className="input" type="number" step="0.01" min="0" value={newRate}
              onChange={e => setNewRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Min fee (Rs.)</label>
            <input className="input" type="number" step="1" min="0" value={newMinFee}
              onChange={e => setNewMinFee(e.target.value)} />
          </div>
        </div>
        <button onClick={addBroker} disabled={!newName.trim() || savingBroker}
          className="btn-primary flex items-center gap-2 mt-3">
          <Plus className="w-4 h-4" /> Add broker
        </button>
      </div>

      {/* Market fees */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Exchange & regulatory fees</p>
          {feesMsg && (
            <span className="text-xs flex items-center gap-1 text-green-500">
              <Check className="w-3 h-3" /> {feesMsg}
            </span>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: "rgb(var(--ink-muted))" }}>
          CSE Fee, SEC Cess, CDS Fee and the Share Transaction Levy are fixed by the exchange/regulator —
          the same for every broker. These are today's standard retail rates; adjust them here if the
          exchange revises them.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {FEE_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" type="number" step="0.001" min="0"
                value={fees[key]}
                onChange={e => setFees(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveFees} disabled={savingFees} className="btn-primary">
            {savingFees ? "Saving..." : "Save fees"}
          </button>
          <button onClick={() => setFees(DEFAULT_MARKET_FEES)} className="btn-ghost flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5" /> Reset to CSE defaults
          </button>
        </div>
      </div>
    </>
  );
}
