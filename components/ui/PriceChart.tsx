"use client";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Customized, Brush, ReferenceLine,
} from "recharts";

export type ChartMode = "line" | "area" | "candlestick";

export interface ChartPoint {
  date: string; // YYYY-MM-DD
  value: number; // close (stock) or index value — used for line/area
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

const BRAND = "rgb(15 110 86)"; // matches --brand-500

function formatDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function ChartTooltip({ active, payload, label, mode }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartPoint;
  return (
    <div
      className="rounded-lg border border-surface-border px-3 py-2 text-xs shadow-lg"
      style={{ background: "rgb(var(--surface-raised))" }}
    >
      <div className="font-medium mb-1">{formatDate(label)}</div>
      {mode === "candlestick" && d.open != null ? (
        <div className="space-y-0.5 font-mono">
          <div>O: {d.open?.toFixed(2)}</div>
          <div>H: {d.high?.toFixed(2)}</div>
          <div>L: {d.low?.toFixed(2)}</div>
          <div>C: {d.close?.toFixed(2)}</div>
        </div>
      ) : (
        <div className="font-mono">{d.value?.toFixed(2)}</div>
      )}
    </div>
  );
}

// Draws OHLC candles on top of an otherwise-invisible chart. Recharts has no
// built-in candlestick series, so this reads the axes' own d3 scales (via
// the Customized render props) to place each wick/body at the correct pixel
// position — the same technique used for any custom Recharts overlay.
function CandlestickLayer(props: any) {
  const { data, xAxisMap, yAxisMap } = props;
  if (!xAxisMap || !yAxisMap || !data) return null;
  const xAxisId = Object.keys(xAxisMap)[0];
  const yAxisId = Object.keys(yAxisMap)[0];
  const xScale = xAxisMap[xAxisId]?.scale;
  const yScale = yAxisMap[yAxisId]?.scale;
  if (!xScale || !yScale) return null;

  let bandwidth = 6;
  if (typeof xScale.bandwidth === "function") {
    bandwidth = xScale.bandwidth();
  } else if (typeof xScale.step === "function") {
    bandwidth = xScale.step() * 0.6;
  } else if (data.length > 1) {
    const x0 = xScale(data[0].date);
    const x1 = xScale(data[1].date);
    if (typeof x0 === "number" && typeof x1 === "number") {
      bandwidth = Math.max(2, Math.abs(x1 - x0) * 0.6);
    }
  }
  const half = Math.max(1, bandwidth / 2);

  return (
    <g>
      {data.map((d: ChartPoint, i: number) => {
        if (d.open == null || d.close == null || d.high == null || d.low == null) return null;
        const x = xScale(d.date);
        if (typeof x !== "number" || Number.isNaN(x)) return null;
        const up = d.close >= d.open;
        const color = up ? "#22c55e" : "#ef4444"; // tailwind green-500 / red-500
        const yHigh = yScale(d.high);
        const yLow = yScale(d.low);
        const yOpen = yScale(d.open);
        const yClose = yScale(d.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        return (
          <g key={`${d.date}-${i}`}>
            <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
            <rect x={x - half} y={bodyTop} width={half * 2} height={bodyHeight} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

const CROSSHAIR = { stroke: "rgb(120 120 120)", strokeDasharray: "3 3", strokeOpacity: 0.5 };

export default function PriceChart({
  data,
  mode,
  height = 320,
  showBrush = true,
  referenceValue,
  referenceLabel,
}: {
  data: ChartPoint[];
  mode: ChartMode;
  height?: number;
  showBrush?: boolean;
  referenceValue?: number | null;
  referenceLabel?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-ink-muted" style={{ height }}>
        No data for this range.
      </div>
    );
  }

  const brushEl =
    showBrush && data.length > 5 ? (
      <Brush
        dataKey="date"
        height={22}
        stroke={BRAND}
        travellerWidth={8}
        tickFormatter={formatDate}
        fill="rgb(var(--surface))"
      />
    ) : null;

  const refLine =
    referenceValue != null ? (
      <ReferenceLine
        y={referenceValue}
        stroke="#a855f7"
        strokeDasharray="4 4"
        strokeWidth={1.5}
        label={{
          value: referenceLabel ?? `Avg: ${referenceValue.toFixed(2)}`,
          position: "insideTopRight",
          fill: "#a855f7",
          fontSize: 11,
        }}
      />
    ) : null;

  if (mode === "candlestick") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            minTickGap={40}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip content={<ChartTooltip mode={mode} />} cursor={CROSSHAIR} />
          {/* invisible series so Recharts computes the y-domain from high/low */}
          <Line dataKey="high" stroke="none" dot={false} isAnimationActive={false} legendType="none" />
          <Line dataKey="low" stroke="none" dot={false} isAnimationActive={false} legendType="none" />
          {refLine}
          <Customized component={(p: any) => <CandlestickLayer {...p} data={data} />} />
          {brushEl}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (mode === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="95%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            minTickGap={40}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip content={<ChartTooltip mode={mode} />} cursor={CROSSHAIR} />
          {refLine}
          <Area
            type="monotone"
            dataKey="value"
            stroke={BRAND}
            strokeWidth={1.75}
            fill="url(#priceFill)"
            isAnimationActive={false}
            dot={false}
          />
          {brushEl}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          minTickGap={40}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip content={<ChartTooltip mode={mode} />} cursor={CROSSHAIR} />
        {refLine}
        <Line
          type="monotone"
          dataKey="value"
          stroke={BRAND}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        {brushEl}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
