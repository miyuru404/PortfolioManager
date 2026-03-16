import { useState, useEffect } from "react";
import type { PriceCache } from "@/types";

export function usePrice(symbol: string | null) {
  const [price, setPrice] = useState<PriceCache | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) { setPrice(null); return; }
    setLoading(true);
    fetch(`/api/cse/price?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setPrice(d); })
      .finally(() => setLoading(false));

    // Refresh every 2 minutes
    const id = setInterval(() => {
      fetch(`/api/cse/price?symbol=${encodeURIComponent(symbol)}`)
        .then(r => r.json())
        .then(d => { if (!d.error) setPrice(d); });
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [symbol]);

  return { price, loading };
}
