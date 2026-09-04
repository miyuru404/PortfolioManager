"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmt, fmtCompact, round } from "@/lib/utils";
import FlashNumber from "./FlashNumber";
import Sparkline from "./Sparkline";
import type { CSEStock, Holding } from "@/types";

interface Props {
  stock: CSEStock;
  holding?: Holding;
}

// A single hairline-divided watchlist row (list-style, as opposed to
// StockCard's grid card) - used on the Home page watchlist where several
// stocks are scanned at a glance rather than inspected one at a time.
export default function StockRow({ stock, holding }: Props) {
  const isUp = stock.changePercentage >= 0;
  const isFlat = stock.changePercentage === 0;

  const unrealisedValue = holding
    ? round(holding.quantity * (stock.lastTradedPrice - holding.avg_price), 2)
    : null;
  const unrealisedPct = holding && holding.avg_price > 0
    ? round(((stock.lastTradedPrice - holding.avg_price) / holding.avg_price) * 100, 2)
    : null;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface transition-colors">
      {/* Symbol + name + (optional) holding summary */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-xs font-medium px-2 py-0.5 rounded shrink-0"
            style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}
          >
            {stock.symbol}
          </span>
          <p className="text-sm font-medium truncate" style={{ color: "rgb(var(--ink))" }}>
            {stock.name}
          </p>
        </div>
        {holding && (
          <p className="text-xs mt-1 font-mono truncate" style={{ color: "rgb(var(--ink-faint))" }}>
            {holding.quantity.toLocaleString()} @ Rs. {fmt(holding.avg_price)}
            {unrealisedValue !== null && (
              <span className={unrealisedValue >= 0 ? "text-green-500" : "text-red-500"}>
                {" · "}
                {unrealisedValue >= 0 ? "+" : ""}Rs. {fmtCompact(Math.abs(unrealisedValue))}
                {unrealisedPct !== null ? ` (${unrealisedPct >= 0 ? "+" : ""}${fmt(unrealisedPct, 1)}%)` : ""}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Sparkline */}
      <div className="hidden sm:block shrink-0">
        <Sparkline symbol={stock.symbol} />
      </div>

      {/* Price + change */}
      <div className="text-right shrink-0 w-28">
        <p className="text-sm font-semibold" style={{ color: "rgb(var(--ink))" }}>
          <FlashNumber
            value={stock.lastTradedPrice}
            formatter={(v) => `Rs. ${fmt(v)}`}
            className="font-mono"
          />
        </p>
        <div
          className={`flex items-center justify-end gap-1 mt-0.5 ${
            isFlat ? "text-ink-muted" : isUp ? "text-green-500" : "text-red-500"
          }`}
        >
          {isFlat ? (
            <Minus className="w-3 h-3" />
          ) : isUp ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span className="text-xs font-medium font-mono">
            {isUp && "+"}
            {fmt(stock.changePercentage, 2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
