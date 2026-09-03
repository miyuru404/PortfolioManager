"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { RefreshCw, X } from "lucide-react";
import PriceChart, { ChartMode, ChartPoint } from "./PriceChart";

export type ChartSource =
  | { kind: "index"; name: "ASPI" | "SPSL20"; label: string }
  | { kind: "stock"; symbol: string; label: string };

const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 182 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "All", days: null },
  { key: "CUSTOM", label: "Custom", days: null },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ChartCard({
  source,
  defaultMode = "line",
  onClear,
}: {
  source: ChartSource;
  defaultMode?: ChartMode;
  onClear?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const canCandlestick = source.kind === "stock";
  const [mode, setMode] = useState<ChartMode>(
    !canCandlestick && defaultMode === "candlestick" ? "line" : defaultMode
  );
  const [preset, setPreset] = useState("3M");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === "CUSTOM") return { from: customFrom || null, to: customTo || null };
    const p = PRESETS.find((p) => p.key === preset);
    return { from: p?.days ? isoDaysAgo(p.days) : null, to: null as string | null };
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (source.kind === "index") {
        let q = supabase
          .from("index_history")
          .select("trade_date, value")
          .eq("index_name", source.name)
          .order("trade_date", { ascending: true });
        if (range.from) q = q.gte("trade_date", range.from);
        if (range.to) q = q.lte("trade_date", range.to);
        const { data: rows, error: err } = await q;
        if (err) throw err;
        setData((rows || []).map((r: any) => ({ date: r.trade_date, value: Number(r.value) })));
      } else {
        let q = supabase
          .from("price_history")
          .select("trade_date, open, high, low, close")
          .eq("symbol", source.symbol)
          .order("trade_date", { ascending: true });
        if (range.from) q = q.gte("trade_date", range.from);
        if (range.to) q = q.lte("trade_date", range.to);
        const { data: rows, error: err } = await q;
        if (err) throw err;
        setData(
          (rows || []).map((r: any) => ({
            date: r.trade_date,
            value: r.close != null ? Number(r.close) : NaN,
            open: r.open != null ? Number(r.open) : null,
            high: r.high != null ? Number(r.high) : null,
            low: r.low != null ? Number(r.low) : null,
            close: r.close != null ? Number(r.close) : null,
          }))
        );
      }
    } catch (e: any) {
      setError(e.message || "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [supabase, source, range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-surface-border p-4" style={{ background: "rgb(var(--surface-raised))" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm truncate">{source.label}</h3>
          {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-ink-muted shrink-0" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs">
            {(["line", "area", "candlestick"] as ChartMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={m === "candlestick" && !canCandlestick}
                title={m === "candlestick" && !canCandlestick ? "Only available for individual companies" : undefined}
                className={`px-2.5 py-1 capitalize transition-colors ${
                  mode === m ? "bg-brand-500 text-white" : "hover:bg-surface"
                } ${m === "candlestick" && !canCandlestick ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-2 py-1 transition-colors ${
                  preset === p.key ? "bg-brand-500 text-white" : "hover:bg-surface"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {onClear && (
            <button onClick={onClear} className="p-1 rounded hover:bg-surface text-ink-muted hover:text-red-500" title="Remove">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {preset === "CUSTOM" && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-surface-border rounded px-1.5 py-0.5 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-surface-border rounded px-1.5 py-0.5 bg-transparent"
            />
          </label>
        </div>
      )}

      {error ? (
        <div className="text-sm text-red-500 py-8 text-center">{error}</div>
      ) : (
        <PriceChart data={data} mode={canCandlestick ? mode : mode === "candlestick" ? "line" : mode} />
      )}
    </div>
  );
}
