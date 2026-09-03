#!/usr/bin/env node
// One-time (re-runnable) backfill of historical price data into Supabase.
//
// MUST be run from a real terminal with normal internet access to cse.lk —
// NOT through an AI agent's sandboxed shell, which is typically proxied and
// blocks that domain. Run it yourself:
//
//   node scripts/backfill-price-history.mjs
//
// It:
//   1. Loads the 31 companies already present in data/cse_prices_raw.json
//      directly (no need to re-fetch those from the live API).
//   2. Fetches the full list of currently-listed CSE symbols from the
//      "todaySharePrice" endpoint.
//   3. For every symbol NOT already covered by the JSON file (and not
//      already in the database, so this is safe to re-run), fetches full
//      daily OHLC history from the "charts" endpoint.
//   4. Upserts everything into the `price_history` table.
//   5. Seeds `index_history` with today's ASPI and S&P SL20 values (no
//      historical endpoint exists for these — history builds forward from
//      the daily cron job instead).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.\n" +
    "Add SUPABASE_SECRET_KEY from Supabase Dashboard -> Project Settings -> API Keys\n" +
    "(the sb_secret_... counterpart to your sb_publishable_... anon key)."
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

const CSE_BASE = "https://www.cse.lk/api/";
const DELAY_MS = 400; // be polite to an unofficial API

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function csePost(endpoint, data = {}) {
  const form = new URLSearchParams(data);
  const res = await fetch(CSE_BASE + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
  return res.json();
}

function toColomboDateString(epochMs) {
  // tradeDate is epoch ms at midnight Asia/Colombo (per the raw file's own note).
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

async function upsertRows(symbol, rawRows) {
  if (!rawRows || rawRows.length === 0) return 0;
  const rows = rawRows.map(r => ({
    symbol,
    trade_date: toColomboDateString(r.tradeDate),
    open: r.open ?? null,
    high: r.high ?? null,
    low: r.low ?? null,
    close: r.close,
    volume: r.shareVolume ?? null,
    turnover: r.turnover ?? null,
  })).filter(r => r.close !== undefined && r.close !== null);

  const CHUNK = 1000;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("price_history").upsert(chunk, { onConflict: "symbol,trade_date" });
    if (error) throw new Error(`upsert failed for ${symbol}: ${error.message}`);
    total += chunk.length;
  }
  return total;
}

async function main() {
  console.log("Loading local dump (data/cse_prices_raw.json)...");
  const dumpPath = path.join(ROOT, "data", "cse_prices_raw.json");
  const dump = JSON.parse(readFileSync(dumpPath, "utf8"));
  const dumpedSymbols = Object.keys(dump.companies || {});
  console.log(`Found ${dumpedSymbols.length} companies in the local dump.`);

  console.log("Finding symbols already in the database (safe to re-run)...");
  const { data: existing, error: existingErr } = await supabase
    .from("price_history")
    .select("symbol")
    .limit(5000);
  if (existingErr) throw new Error(`Couldn't read price_history: ${existingErr.message}`);
  const alreadyInDb = new Set((existing || []).map(r => r.symbol));

  // 1. Import the 31 companies straight from the local dump.
  for (const symbol of dumpedSymbols) {
    if (alreadyInDb.has(symbol)) {
      console.log(`  [dump] ${symbol}: already in DB, skipping`);
      continue;
    }
    const rows = dump.companies[symbol].rows;
    const count = await upsertRows(symbol, rows);
    console.log(`  [dump] ${symbol}: upserted ${count} rows`);
  }

  // 2. Get the full current symbol list from CSE and fetch history for
  //    anything not covered by the dump or already in the DB.
  console.log("\nFetching full CSE symbol list (todaySharePrice)...");
  const today = await csePost("todaySharePrice");
  const allEntries = Array.isArray(today) ? today : today?.reqTodayShareprice || today?.data || [];
  const allSymbols = [...new Set(
    allEntries.map(e => e.symbol || e.Symbol || e.SYMBOL).filter(Boolean)
  )];
  console.log(`CSE currently lists ${allSymbols.length} symbols.`);

  const toFetch = allSymbols.filter(s => !dumpedSymbols.includes(s) && !alreadyInDb.has(s));
  console.log(`${toFetch.length} symbols need a live history fetch.\n`);

  const to = todayDDMMYYYY();
  let done = 0, failed = 0;
  for (const symbol of toFetch) {
    try {
      const chart = await csePost("charts", { symbol, from: "01-01-2000", to, period: "1" });
      const rows = chart?.rows || chart?.data || (Array.isArray(chart) ? chart : []);
      const count = await upsertRows(symbol, rows);
      console.log(`  [live] ${symbol}: upserted ${count} rows`);
      done++;
    } catch (err) {
      console.error(`  [live] ${symbol}: FAILED — ${err.message}`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  // 3. Seed index_history with today's ASPI / S&P SL20 values.
  console.log("\nSeeding today's index values...");
  try {
    const [aspi, snp] = await Promise.all([csePost("aspiData"), csePost("snpData")]);
    const todayIso = new Date().toISOString().slice(0, 10);
    const indexRows = [
      aspi && { index_name: "ASPI", trade_date: todayIso, value: aspi.value ?? aspi.indexValue, change: aspi.change, change_pct: aspi.changePercentage },
      snp && { index_name: "SPSL20", trade_date: todayIso, value: snp.value ?? snp.indexValue, change: snp.change, change_pct: snp.changePercentage },
    ].filter(r => r && r.value != null);
    if (indexRows.length > 0) {
      const { error } = await supabase.from("index_history").upsert(indexRows, { onConflict: "index_name,trade_date" });
      if (error) throw new Error(error.message);
      console.log(`Seeded ${indexRows.length} index row(s).`);
    } else {
      console.log("Couldn't parse index values — inspect the aspiData/snpData response shape manually.");
    }
  } catch (err) {
    console.error(`Index seed failed: ${err.message}`);
  }

  console.log(`\nDone. Live-fetched ${done} symbols, ${failed} failed.`);
  if (failed > 0) console.log("Re-run this script to retry failed symbols — already-loaded ones are skipped.");
}

main().catch(err => { console.error(err); process.exit(1); });
