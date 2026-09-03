#!/usr/bin/env node
// One-time (re-runnable) migration from the existing cse_stock_prediction
// Postgres database into this app's shared price_history / index_history
// tables in Supabase.
//
// Run this yourself, in your own terminal, the same way you ran `psql`
// against the source DB — this script needs the same network access.
//
//   npm run migrate-source-db
//
// Reads source connection details from .env.local (see SETUP-PRICE-HISTORY.md):
//   SOURCE_PG_HOST, SOURCE_PG_PORT, SOURCE_PG_DATABASE, SOURCE_PG_USER, SOURCE_PG_PASSWORD
// and the Supabase secret key: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
//
// Order of operations: historical_prices (KAGGLE seed) first, then
// daily_prices (CSE_API, live collection) on top — daily_prices wins on any
// overlapping symbol+date since it's the more authoritative source.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// --- tiny .env.local loader (no dependency on dotenv) ---
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const required = ["SOURCE_PG_HOST", "SOURCE_PG_DATABASE", "SOURCE_PG_USER", "SOURCE_PG_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing env vars in .env.local: ${missing.join(", ")}\nSee SETUP-PRICE-HISTORY.md.`);
  process.exit(1);
}

const sourcePool = new pg.Pool({
  host: process.env.SOURCE_PG_HOST,
  port: Number(process.env.SOURCE_PG_PORT || 5432),
  database: process.env.SOURCE_PG_DATABASE,
  user: process.env.SOURCE_PG_USER,
  password: process.env.SOURCE_PG_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const INDEX_NAME_MAP = { "ASPI": "ASPI", "S&P SL20": "SPSL20" };

async function migratePriceTable(tableName) {
  console.log(`\nReading ${tableName} from source DB...`);
  const { rows: srcRows } = await sourcePool.query(
    `SELECT symbol, date, open, high, low, close, volume FROM ${tableName} WHERE symbol IS NOT NULL`
  );
  console.log(`  ${srcRows.length} rows found.`);
  if (srcRows.length === 0) return 0;

  const rows = srcRows.map(r => ({
    symbol: r.symbol,
    trade_date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    open: r.open !== null ? Number(r.open) : null,
    high: r.high !== null ? Number(r.high) : null,
    low: r.low !== null ? Number(r.low) : null,
    close: r.close !== null ? Number(r.close) : null,
    volume: r.volume !== null ? Number(r.volume) : null,
  })).filter(r => r.close !== null);

  return upsertRowsToPriceHistory(rows);
}

async function upsertRowsToPriceHistory(rows) {
  const CHUNK = 1000;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("price_history").upsert(chunk, { onConflict: "symbol,trade_date" });
    if (error) throw new Error(`price_history upsert failed: ${error.message}`);
    total += chunk.length;
    process.stdout.write(`\r  upserted ${total}/${rows.length}`);
  }
  console.log("");
  return total;
}

async function migrateIndexPrices() {
  console.log("\nReading index_prices from source DB...");
  const { rows: srcRows } = await sourcePool.query(
    `SELECT index_name, date, value, change, change_pct FROM index_prices WHERE value IS NOT NULL`
  );
  console.log(`  ${srcRows.length} rows found.`);
  if (srcRows.length === 0) return 0;

  const unmapped = new Set();
  const rows = [];
  for (const r of srcRows) {
    const mapped = INDEX_NAME_MAP[r.index_name];
    if (!mapped) { unmapped.add(r.index_name); continue; }
    rows.push({
      index_name: mapped,
      trade_date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
      value: Number(r.value),
      change: r.change !== null ? Number(r.change) : null,
      change_pct: r.change_pct !== null ? Number(r.change_pct) : null,
    });
  }
  if (unmapped.size > 0) {
    console.warn(`  WARNING: unrecognised index_name value(s), skipped: ${[...unmapped].join(", ")}`);
  }

  const CHUNK = 1000;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("index_history").upsert(chunk, { onConflict: "index_name,trade_date" });
    if (error) throw new Error(`index_history upsert failed: ${error.message}`);
    total += chunk.length;
  }
  console.log(`  upserted ${total} index rows.`);
  return total;
}

async function main() {
  console.log("Checking source DB connection and symbol format...");
  const { rows: sample } = await sourcePool.query("SELECT symbol, name FROM stocks LIMIT 5");
  console.log("  Sample symbols:", sample.map(r => r.symbol).join(", "));
  const looksLikeCseFormat = sample.some(r => r.symbol && r.symbol.includes("."));
  if (!looksLikeCseFormat) {
    console.warn(
      "  WARNING: none of the sample symbols contain a '.' — this app expects CSE-style symbols\n" +
      "  like 'COMB.N0000'. If these don't match, charts/search won't line up. Check before relying on this."
    );
  }

  const histCount = await migratePriceTable("historical_prices");
  const dailyCount = await migratePriceTable("daily_prices");
  const indexCount = await migrateIndexPrices();

  console.log(`\nDone. historical_prices: ${histCount} rows, daily_prices: ${dailyCount} rows, index_prices: ${indexCount} rows.`);
  await sourcePool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
