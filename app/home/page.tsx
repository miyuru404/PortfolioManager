"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import ChartCard from "@/components/ui/ChartCard";
import SymbolSearch from "@/components/ui/SymbolSearch";

export default function HomePage() {
  const [companies, setCompanies] = useState<string[]>([]);
  function addCompany(symbol: string) { setCompanies((prev) => (prev.includes(symbol) ? prev : [...prev, symbol])); }
  function removeCompany(symbol: string) { setCompanies((prev) => prev.filter((s) => s !== symbol)); }
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Charts" subtitle="ASPI, S&P SL20 and per-company OHLC history" />

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard source={{ kind: "index", name: "ASPI", label: "ASPI — All Share Price Index" }} defaultMode="area" />
            <ChartCard source={{ kind: "index", name: "SPSL20", label: "S&P SL20" }} defaultMode="area" />
          </div>
          <div>
            <label className="stat-label mb-2 block">Add a company chart</label>
            <div className="max-w-md"><SymbolSearch onSelect={addCompany} /></div>
          </div>
          {companies.length > 0 && (
            <div className="space-y-4">
              {companies.map((symbol) => (
                <ChartCard key={symbol} source={{ kind: "stock", symbol, label: symbol }} defaultMode="candlestick" onClear={() => removeCompany(symbol)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
