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

// Above this many points, aggregate into evenly-sized buckets so long
// ranges (years of daily data) stay fast to render and readable instead of
// a wall of noise. Aggregation keeps true high/low, first open, last close.
const DOWNSAMPLE_THRESHOLD = 400;
const DOWNSAMPLE_TARGET = 300;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function downsample(points: ChartPoint[]): { points: ChartPoint[]; applied: boolean } {
  if (points.length <= DOWNSAMPLE_THRESHOLD) return { points, applied: false };
  const bucketSize = Math.ceil(points.length / DOWNSAMPLE_TARGET);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const highs = bucket.map((b) => b.high ?? b.value).filter((v): v is number => v != null);
    const lows = bucket.map((b) => b.low ?? b.value).filter((v): v is number => v != null);
    out.push({
      date: last.date,
      value: last.close ?? last.value,
      open: first.open ?? undefined,
      close: last.close ?? undefined,
      high: highs.length ? Math.max(...highs) : undefined,
      low: lows.length ? Math.min(...lows) : undefined,
    });
  }
  return { points: out, applied: true };
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
  const [downsampled, setDownsampled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avgPrice, setAvgPrice] = useState<number | null>(null);

  const range = useMemo(() => {
    if (preset === "CUSTOM") return { from: customFrom || null, to: customTo || null };
    const p = PRESETS.find((p) => p.key === preset);
    return { from: p?.days ? isoDaysAgo(p.days) : null, to: null as string | null };
  }, [preset, customFrom, customTo]);

  // For a company chart, show the user's own average buy price as a
  // reference line — the fastest way for someone unfamiliar with charts to
  // tell "am I up or down" at a glance.
  useEffect(() => {
    if (source.kind !== "stock") return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return;
      const { data: holding } = await supabase
        .from("holdings")
        .select("avg_price")
        .eq("user_id", userId)
        .eq("symbol", source.symbol)
        .maybeSingle();
      if (!cancelled) setAvgPrice(holding?.avg_price != null ? Number(holding.avg_price) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, source]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rows: ChartPoint[] = [];
      if (source.kind === "index") {
        let q = supabase
          .from("index_history")
          .select("trade_date, value")
          .eq("index_name", source.name)
          .order("trade_date", { ascending: true });
        if (range.from) q = q.gte("trade_date", range.from);
        if (range.to) q = q.lte("trade_date", range.to);
        const { data: r, error: err } = await q;
        if (err) throw err;
        rows = (r || []).map((x: any) => ({ date: x.trade_date, value: Number(x.value) }));
      } else {
        let q = supabase
          .from("price_history")
          .select("trade_date, open, high, low, close")
          .eq("symbol", source.symbol)
          .order("trade_date", { ascending: true });
        if (range.from) q = q.gte("trade_date", range.from);
        if (range.to) q = q.lte("trade_date", range.to);
        const { data: r, error: err } = await q;
        if (err) throw err;
        rows = (r || []).map((x: any) => ({
          date: x.trade_date,
          value: x.close != null ? Number(x.close) : NaN,
          open: x.open != null ? Number(x.open) : null,
          high: x.high != null ? Number(x.high) : null,
          low: x.low != null ? Number(x.low) : null,
          close: x.close != null ? Number(x.close) : null,
        }));
      }
      const { points, applied } = downsample(rows);
      setData(points);
      setDownsampled(applied);
    } catch (e: any) {
      setError(e.message || "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [supabase, source, range]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
    const change = last - first;
    const changePct = (change / first) * 100;
    return { last, change, changePct };
  }, [data]);

  const presetLabel = PRESETS.find((p) => p.key === preset)?.label ?? preset;

  return (
    <div className="rounded-xl border border-surface-border p-4" style={{ background: "rgb(var(--surface-raised))" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
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

      {stats && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-semibold font-mono">{stats.last.toFixed(2)}</span>
          <span className={`text-sm font-medium ${stats.change >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.change >= 0 ? "+" : ""}
            {stats.change.toFixed(2)} ({stats.changePct >= 0 ? "+" : ""}
            {stats.changePct.toFixed(2)}%) over {presetLabel === "All" ? "the full period" : presetLabel}
          </span>
        </div>
      )}

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
        <>
          <PriceChart
            data={data}
            mode={canCandlestick ? mode : mode === "candlestick" ? "line" : mode}
            referenceValue={avgPrice}
            referenceLabel={avgPrice != null ? `Your avg: ${avgPrice.toFixed(2)}` : undefined}
          />
          {downsampled && (
            <p className="text-xs text-ink-muted mt-1">
              Showing a smoothed view (grouped into ~{DOWNSAMPLE_TARGET} points) for readability over this long a range.
              Switch to a shorter preset to see every trading day.
            </p>
          )}
          <p className="text-xs text-ink-muted mt-1">Drag the strip below the chart to zoom into any custom range.</p>
        </>
      )}
    </div>
  );
}
