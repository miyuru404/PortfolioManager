"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, TrendingUp, Calculator, Database, Settings, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portfolio",  icon: BarChart2,   label: "Portfolio" },
  { href: "/home",       icon: TrendingUp,  label: "Charts" },
  { href: "/calculator", icon: Calculator,  label: "Calculator" },
  { href: "/masterdata", icon: Database,    label: "Master Data" },
  { href: "/settings",   icon: Settings,    label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const Mark = ({ size }: { size: number }) => (
    <div className="rounded-md shrink-0" style={{ width: size, height: size, background: "rgb(var(--brand-400))" }} />
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5">
        <Mark size={22} />
        <span className="font-heading text-sm uppercase tracking-wide" style={{ color: "rgb(var(--ink))" }}>
          Ceylon Capital
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn("sidebar-link uppercase text-xs tracking-wide", pathname.startsWith(href) && "active")}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-surface-border">
        <button onClick={signOut}
          className="sidebar-link uppercase text-xs tracking-wide w-full text-left hover:text-red-500">
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-surface-border h-screen sticky top-0"
        style={{background:"rgb(var(--surface-raised))"}}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-surface-border"
        style={{background:"rgb(var(--surface-raised))"}}>
        <div className="flex items-center gap-2">
          <Mark size={20} />
          <span className="font-heading text-sm uppercase tracking-wide" style={{ color: "rgb(var(--ink))" }}>
            Ceylon Capital
          </span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-surface">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute top-0 left-0 w-64 h-full shadow-xl"
            style={{background:"rgb(var(--surface-raised))"}}
            onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
