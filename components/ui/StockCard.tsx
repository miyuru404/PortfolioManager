"use client";
import { TrendingUp, TrendingDown, Minus, Plus, BookmarkPlus } from "lucide-react";
import { fmt, fmtCompact } from "@/lib/utils";
import type { CSEStock, Holding } from "@/types";

interface Props {
  stock: CSEStock;
  holding?: Holding;
  onAddToWatchlist?: () => void;
  showWatchlistButton?: boolean;
}

export default function StockCard({ stock, holding, onAddToWatchlist, showWatchlistButton }: Props) {
  const isUp = stock.changePercentage >= 0;
  const isFlat = stock.changePercentage === 0;

  const unrealisedValue = holding
    ? holding.quantity * (stock.lastTradedPrice - holding.avg_price)
    : null;
  const unrealisedPct = holding && holding.avg_price > 0
    ? ((stock.lastTradedPrice - holding.avg_price) / holding.avg_price) * 100
    : null;

  return (
    <div className="card hover:border-brand-100 transition-colors group animate-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium px-2 py-0.5 rounded"
              style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
              {stock.symbol}
            </span>
            {showWatchlistButton && (
              <button onClick={onAddToWatchlist}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface"
                title="Add to watchlist">
                <BookmarkPlus className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-muted))" }} />
              </button>
            )}
          </div>
          <p className="text-sm font-medium mt-1 leading-tight" style={{ color: "rgb(var(--ink))" }}>
            {stock.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold font-mono" style={{ color: "rgb(var(--ink))" }}>
            Rs. {fmt(stock.lastTradedPrice)}
          </p>
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${
            isFlat ? "text-ink-muted" : isUp ? "text-green-500" : "text-red-500"
          }`}>
            {isFlat ? <Minus className="w-3 h-3" /> :
             isUp   ? <TrendingUp className="w-3 h-3" /> :
                      <TrendingDown className="w-3 h-3" />}
            <span className="text-xs font-medium">
              {isUp && "+"}{fmt(stock.change)} ({isUp && "+"}{fmt(stock.changePercentage, 3)}%)
            </span>
          </div>
        </div>
      </div>

      {holding && (
        <div className="border-t pt-3 mt-3 grid grid-cols-3 gap-3" style={{ borderColor: "rgb(var(--surface-border))" }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: "rgb(var(--ink-faint))" }}>Holdings</p>
            <p className="text-sm font-medium font-mono">{holding.quantity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: "rgb(var(--ink-faint))" }}>Avg price</p>
            <p className="text-sm font-medium font-mono">Rs. {fmt(holding.avg_price)}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: "rgb(var(--ink-faint))" }}>Unrealised</p>
            <p className={`text-sm font-medium font-mono ${
              unrealisedValue === null ? "" :
              unrealisedValue >= 0 ? "text-green-500" : "text-red-500"
            }`}>
              {unrealisedValue !== null
                ? `${unrealisedValue >= 0 ? "+" : ""}Rs. ${fmtCompact(Math.abs(unrealisedValue))}`
                : "—"}
            </p>
            {unrealisedPct !== null && (
              <p className={`text-xs ${unrealisedPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                {unrealisedPct >= 0 ? "+" : ""}{fmt(unrealisedPct, 1)}%
              </p>
            )}
          </div>
        </div>
      )}

      {stock.marketCap > 0 && (
        <div className="mt-2">
          <p className="text-xs" style={{ color: "rgb(var(--ink-faint))" }}>
            Mkt cap: Rs. {fmtCompact(stock.marketCap)}
          </p>
        </div>
      )}
    </div>
  );
}
