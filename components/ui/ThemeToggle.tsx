"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { applyTheme } from "@/lib/themes";
import type { Theme } from "@/types";

// Quick light/dark toggle shown in every page header (the Revamp design
// puts this top-right on every screen). Cycles only light <-> dark; the
// other theme options (Midnight, Dark Green) stay Settings-only.
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  async function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    setIsDark(!isDark);
    applyTheme(next);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ theme: next }).eq("id", user.id);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border hover:bg-surface transition-colors shrink-0"
    >
      {isDark
        ? <Sun className="w-4 h-4" style={{ color: "rgb(var(--ink-muted))" }} />
        : <Moon className="w-4 h-4" style={{ color: "rgb(var(--ink-muted))" }} />}
    </button>
  );
}
