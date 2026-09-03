import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { createAdminClient } from "@/lib/supabase-admin";

// Vercel Cron hits this once a day after market close (see vercel.json).
// Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` for
// configured cron jobs — set CRON_SECRET in Vercel's env vars to match.
//
// Data source: the existing cse_stock_prediction Postgres DB (its own
// scheduled job collects fresh daily_prices/index_prices independently of
// this app) rather than scraping cse.lk directly — same tables the one-time
// migration script (scripts/migrate-from-source-db.mjs) reads from. Only
// rows newer than what we already have get pulled each run.

const INDEX_NAME_MAP: Record<string, string> = { "ASPI": "ASPI", "S&P SL20": "SPSL20" };

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const required = ["SOURCE_PG_HOST", "SOURCE_PG_DATABASE", "SOURCE_PG_USER", "SOURCE_PG_PASSWORD"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing env vars: ${missing.join(", ")}` }, { status: 500 });
  }

  const supabase = createAdminClient();
  const sourcePool = new Pool({
    host: process.env.SOURCE_PG_HOST,
    port: Number(process.env.SOURCE_PG_PORT || 5432),
    database: process.env.SOURCE_PG_DATABASE,
    user: process.env.SOURCE_PG_USER,
    password: process.env.SOURCE_PG_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  const result = { priceRows: 0, indexRows: 0, errors: [] as string[] };

  try {
    // Find how far we've already synced, then pull anything newer.
    const { data: lastPrice } = await supabase
      .from("price_history").select("trade_date").order("trade_date", { ascending: false }).limit(1).maybeSingle();
    const since = lastPrice?.trade_date || "2000-01-01";

    const { rows: priceRows } = await sourcePool.query(
      `SELECT symbol, date, open, high, low, close, volume FROM daily_prices
       WHERE date >= $1 AND symbol IS NOT NULL`,
      [since]
    );
    const mapped = priceRows
      .map(r => ({
        symbol: r.symbol,
        trade_date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
        open: r.open !== null ? Number(r.open) : null,
        high: r.high !== null ? Number(r.high) : null,
        low: r.low !== null ? Number(r.low) : null,
        close: r.close !== null ? Number(r.close) : null,
        volume: r.volume !== null ? Number(r.volume) : null,
      }))
      .filter(r => r.close !== null);

    if (mapped.length > 0) {
      const { error } = await supabase.from("price_history").upsert(mapped, { onConflict: "symbol,trade_date" });
      if (error) result.errors.push(`price_history: ${error.message}`);
      else result.priceRows = mapped.length;
    }
  } catch (err: any) {
    result.errors.push(`daily_prices sync failed: ${err.message}`);
  }

  try {
    const { data: lastIndex } = await supabase
      .from("index_history").select("trade_date").order("trade_date", { ascending: false }).limit(1).maybeSingle();
    const since = lastIndex?.trade_date || "2000-01-01";

    const { rows: indexRows } = await sourcePool.query(
      `SELECT index_name, date, value, change, change_pct FROM index_prices WHERE date >= $1`,
      [since]
    );
    const mapped = indexRows
      .map(r => ({
        index_name: INDEX_NAME_MAP[r.index_name],
        trade_date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
        value: r.value !== null ? Number(r.value) : null,
        change: r.change !== null ? Number(r.change) : null,
        change_pct: r.change_pct !== null ? Number(r.change_pct) : null,
      }))
      .filter(r => r.index_name && r.value !== null);

    if (mapped.length > 0) {
      const { error } = await supabase.from("index_history").upsert(mapped, { onConflict: "index_name,trade_date" });
      if (error) result.errors.push(`index_history: ${error.message}`);
      else result.indexRows = mapped.length;
    }
  } catch (err: any) {
    result.errors.push(`index_prices sync failed: ${err.message}`);
  }

  await sourcePool.end();
  return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
