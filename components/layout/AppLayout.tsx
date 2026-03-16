"use client";
import Sidebar from "./Sidebar";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { applyTheme } from "@/lib/themes";
import type { Theme } from "@/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .single();
      if (data?.theme) applyTheme(data.theme as Theme);
    });
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "rgb(var(--surface))" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 lg:p-8 p-4 pt-16 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
