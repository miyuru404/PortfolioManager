import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  try {
    // Check cache first (5 min TTL)
    const supabase = createServerSupabaseClient();
    const { data: cached } = await supabase
      .from("price_cache")
      .select("*")
      .eq("symbol", symbol)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < 5 * 60 * 1000) {
        return NextResponse.json(cached);
      }
    }

    // Fetch fresh from CSE
    const form = new URLSearchParams({ symbol });
    const res = await fetch("https://www.cse.lk/api/companyInfoSummery", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) throw new Error("CSE API error");
    const data = await res.json();
    if (!data?.reqSymbolInfo) throw new Error("Not found");

    const row = {
      symbol: data.reqSymbolInfo.symbol,
      company_name: data.reqSymbolInfo.name,
      last_price: data.reqSymbolInfo.lastTradedPrice ?? 0,
      change: data.reqSymbolInfo.change ?? 0,
      change_pct: data.reqSymbolInfo.changePercentage ?? 0,
      market_cap: data.reqSymbolInfo.marketCap ?? 0,
      volume: 0,
      fetched_at: new Date().toISOString(),
    };

    await supabase.from("price_cache").upsert(row, { onConflict: "symbol" });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
