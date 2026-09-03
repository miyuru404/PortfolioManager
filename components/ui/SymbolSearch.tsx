"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Search, Loader2 } from "lucide-react";

interface SymbolRow {
  symbol: string;
  row_count: number;
  first_date: string;
  last_date: string;
}

export default function SymbolSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("chart_symbols")
      .select("symbol, row_count, first_date, last_date")
      .then(({ data, error }) => {
        if (!error && data) setSymbols(data as SymbolRow[]);
        setLoaded(true);
      });
  }, [supabase]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return symbols.slice(0, 20);
    return symbols.filter((s) => s.symbol.toUpperCase().includes(q)).slice(0, 20);
  }, [symbols, query]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search a company, e.g. JKH.N0000"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-transparent text-sm"
        />
        {!loaded && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-muted" />}
      </div>

      {open && loaded && (
        <div
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-surface-border shadow-lg"
          style={{ background: "rgb(var(--surface-raised))" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">No matching symbols.</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.symbol}
                onClick={() => {
                  onSelect(s.symbol);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center justify-between gap-2"
              >
                <span className="font-mono">{s.symbol}</span>
                <span className="text-xs text-ink-muted shrink-0">
                  {s.first_date}&nbsp;→&nbsp;{s.last_date}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
