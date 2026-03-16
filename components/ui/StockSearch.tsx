"use client";
import { useState, useRef, useEffect } from "react";
import { Search, Loader2, X } from "lucide-react";
import type { CSEStock } from "@/types";

interface Props {
  onSelect: (stock: CSEStock) => void;
  placeholder?: string;
}

export default function StockSearch({ onSelect, placeholder = "Search by name or code (e.g. HNB.N0000)..." }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CSEStock | null>(null);
  const [error, setError] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResult(null); setError(""); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setError(""); setResult(null);
      try {
        const res = await fetch(`/api/cse/search?symbol=${encodeURIComponent(query.trim().toUpperCase())}`);
        const data = await res.json();
        if (data.error) { setError("Symbol not found. Try the full code e.g. HNB.N0000"); }
        else { setResult(data); setShowDrop(true); }
      } catch {
        setError("Failed to fetch. Check connection.");
      } finally {
        setLoading(false);
      }
    }, 600);
  }, [query]);

  function handleSelect(stock: CSEStock) {
    onSelect(stock);
    setQuery("");
    setResult(null);
    setShowDrop(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />
        <input
          className="input pl-9 pr-8"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => result && setShowDrop(true)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: "rgb(var(--ink-faint))" }} />}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setResult(null); setError(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-faint))" }} />
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1.5 text-red-500">{error}</p>}
      {showDrop && result && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-lg overflow-hidden"
          style={{ background: "rgb(var(--surface-raised))", borderColor: "rgb(var(--surface-border))" }}>
          <button className="w-full text-left px-4 py-3 hover:bg-surface transition-colors"
            onClick={() => handleSelect(result)}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-medium px-1.5 py-0.5 rounded mr-2"
                  style={{ background: "rgb(var(--brand-50))", color: "rgb(var(--brand-500))" }}>
                  {result.symbol}
                </span>
                <span className="text-sm font-medium">{result.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-medium">Rs. {result.lastTradedPrice.toFixed(2)}</p>
                <p className={`text-xs ${result.changePercentage >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {result.changePercentage >= 0 ? "+" : ""}{result.changePercentage.toFixed(3)}%
                </p>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
