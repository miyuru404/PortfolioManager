"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ChartCard from "@/components/ui/ChartCard";
import SymbolSearch from "@/components/ui/SymbolSearch";

export default function ChartPage() {
  const [companies, setCompanies] = useState<string[]>([]);

  function addCompany(symbol: string) {
    setCompanies((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
  }

  function removeCompany(symbol: string) {
    setCompanies((prev) => prev.filter((s) => s !== symbol));
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>
            Chart
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Index trends and per-company price history. Pick a chart type and time range per chart.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard source={{ kind: "index", name: "ASPI", label: "ASPI (All Share Price Index)" }} defaultMode="area" />
          <ChartCard source={{ kind: "index", name: "SPSL20", label: "S&P SL20" }} defaultMode="area" />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-muted mb-1 block">Add a company chart</label>
          <div className="max-w-md">
            <SymbolSearch onSelect={addCompany} />
          </div>
        </div>

        {companies.length > 0 && (
          <div className="space-y-4">
            {companies.map((symbol) => (
              <ChartCard
                key={symbol}
                source={{ kind: "stock", symbol, label: symbol }}
                defaultMode="candlestick"
                onClear={() => removeCompany(symbol)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
