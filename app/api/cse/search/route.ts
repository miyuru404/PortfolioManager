import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  try {
    const form = new URLSearchParams({ symbol });
    const res = await fetch("https://www.cse.lk/api/companyInfoSummery", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) throw new Error("CSE API error");
    const data = await res.json();
    if (!data?.reqSymbolInfo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      symbol: data.reqSymbolInfo.symbol,
      name: data.reqSymbolInfo.name,
      lastTradedPrice: data.reqSymbolInfo.lastTradedPrice ?? 0,
      change: data.reqSymbolInfo.change ?? 0,
      changePercentage: data.reqSymbolInfo.changePercentage ?? 0,
      marketCap: data.reqSymbolInfo.marketCap ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
