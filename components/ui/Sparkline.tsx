"use client";
import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase";

// A minimal inline trend line (no axes/tooltip) fed by the last N days of
// price_history for a symbol. Silently renders an empty slot if there's
// not enough history yet, rather than an error or spinner.
export default function Sparkline({
  symbol,
  days = 30,
  height = 32,
  width = 88,
}: {
  symbol: string;
  days?: number;
  height?: number;
  width?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [points, setPoints] = useState<{ v: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = new Date();
    from.setDate(from.getDate() - days);
    supabase
      .from("price_history")
      .select("close")
      .eq("symbol", symbol)
      .gte("trade_date", from.toISOString().slice(0, 10))
      .order("trade_date", { ascending: true })
      .then(({ data }: any) => {
        if (cancelled) return;
        setPoints(
          (data || [])
            .filter((r: any) => r.close != null)
            .map((r: any) => ({ v: Number(r.close) }))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, symbol, days]);

  if (!points || points.length < 2) {
    return <div style={{ width, height }} />;
  }

  const up = points[points.length - 1].v >= points[0].v;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
