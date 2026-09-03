import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the project's secret key. This bypasses
// Row Level Security, so it must NEVER be imported from a "use client"
// component or exposed to the browser — only from route handlers / scripts.
// (Deliberately not using the `server-only` npm package here to avoid adding
// a dependency; enforce this by review — grep for this import before adding
// it to any client component.)
// price_history and index_history are shared market data (not per-user), so
// writes to them go through this client rather than the per-user anon client
// the rest of the app uses.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. " +
      "Get the secret key from Supabase Dashboard -> Project Settings -> API Keys " +
      "(it's the sb_secret_... counterpart to your sb_publishable_... anon key) " +
      "and add it as SUPABASE_SECRET_KEY in .env.local and in Vercel's env vars."
    );
  }
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
