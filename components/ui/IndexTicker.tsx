"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

interface IndexStat { value: number; change: number; changePct: number }

// Compact live ASPI / S&P SL20 readout shown in every page header, fed by
// the same index_history table ChartCard uses for the full series — this
// only reads the latest two rows, so it stays cheap mounted on every page.
export default function IndexTicker() {
  const [aspi, setAspi] = useState<IndexStat | null>(null);
  const [sl20, setSl20] = useState<IndexStat | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function loadOne(name: "ASPI" | "SPSL20", set: (s: IndexStat) => void) {
      const { data } = await supabase
        .from("index_history")
        .select("value")
        .eq("index_name", name)
        .order("trade_date", { ascending: false })
        .limit(2);
      if (cancelled || !data || data.length < 2) return;
      const value = Number(data[0].value);
      const prev = Number(data[1].value);
      const change = value - prev;
      set({ value, change, changePct: prev !== 0 ? (change / prev) * 100 : 0 });
    }
    loadOne("ASPI", setAspi);
    loadOne("SPSL20", setSl20);
    return () => { cancelled = true; };
  }, []);

  if (!aspi && !sl20) return null;

  const Item = ({ label, stat }: { label: string; stat: IndexStat | null }) => {
    if (!stat) return null;
    const up = stat.change >= 0;
    return (
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="stat-label">{label}</span>
        <span className="text-sm font-semibold font-mono" style={{ color: "rgb(var(--ink))" }}>{fmt(stat.value)}</span>
        <span className={`text-xs font-medium font-mono ${up ? "text-green-500" : "text-red-500"}`}>
          {up ? "+" : ""}{fmt(stat.changePct, 2)}%
        </span>
      </div>
    );
  };

  return (
    <div className="hidden md:flex items-center gap-5">
      <Item label="ASPI" stat={aspi} />
      <Item label="SL20" stat={sl20} />
    </div>
  );
}
