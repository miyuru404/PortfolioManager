"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { applyTheme } from "@/lib/themes";
import { Eye, EyeOff, Check, Moon, Sun, Zap, Leaf } from "lucide-react";
import type { Theme, Profile } from "@/types";

const THEMES: { id: Theme; label: string; icon: React.ReactNode; preview: string[] }[] = [
  { id: "light",     label: "Light",      icon: <Sun className="w-4 h-4" />,  preview: ["#F8F8F6","#FFFFFF","#1D9E75"] },
  { id: "dark",      label: "Dark",       icon: <Moon className="w-4 h-4" />, preview: ["#121214","#1C1C20","#1D9E75"] },
  { id: "midnight",  label: "Midnight",   icon: <Zap className="w-4 h-4" />,  preview: ["#080A16","#0E1023","#6478F0"] },
  { id: "darkgreen", label: "Dark Green", icon: <Leaf className="w-4 h-4" />, preview: ["#060E0A","#0A160F","#22B45A"] },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTheme, setActiveTheme] = useState<Theme>("light");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: "", ok: true });
  const [themeSaved, setThemeSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) { setProfile(data); setActiveTheme(data.theme || "light"); }
    });
  }, []);

  async function handleTheme(theme: Theme) {
    setActiveTheme(theme);
    applyTheme(theme);
    if (profile) {
      await supabase.from("profiles").update({ theme }).eq("id", profile.id);
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 2000);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ text: "New passwords don't match", ok: false }); return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ text: "Password must be at least 6 characters", ok: false }); return;
    }
    setPwdLoading(true); setPwdMsg({ text: "", ok: true });
    try {
      // Re-authenticate with old password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email, password: oldPwd
      });
      if (signInError) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdMsg({ text: "Password changed successfully!", ok: true });
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      setPwdMsg({ text: err.message || "Failed to change password", ok: false });
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "rgb(var(--ink))" }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
            Manage your account and preferences
          </p>
        </div>

        {/* Account info */}
        {profile && (
          <div className="card">
            <p className="text-sm font-medium mb-3" style={{ color: "rgb(var(--ink))" }}>Account</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b"
                style={{ borderColor: "rgb(var(--surface-border))" }}>
                <span className="text-sm" style={{ color: "rgb(var(--ink-muted))" }}>Email</span>
                <span className="text-sm font-medium">{profile.email}</span>
              </div>
              {profile.full_name && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm" style={{ color: "rgb(var(--ink-muted))" }}>Name</span>
                  <span className="text-sm font-medium">{profile.full_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Theme */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: "rgb(var(--ink))" }}>Colour theme</p>
            {themeSaved && (
              <span className="text-xs flex items-center gap-1 text-green-500">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(t => (
              <button key={t.id} onClick={() => handleTheme(t.id)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  activeTheme === t.id ? "border-brand-400" : "border-surface-border hover:border-brand-100"
                }`}>
                {/* Preview swatches */}
                <div className="flex gap-1.5 mb-2.5">
                  {t.preview.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-black/10"
                      style={{ background: c }} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "rgb(var(--ink-muted))" }}>{t.icon}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  {activeTheme === t.id && (
                    <Check className="w-4 h-4" style={{ color: "rgb(var(--brand-400))" }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <p className="text-sm font-medium mb-4" style={{ color: "rgb(var(--ink))" }}>Change password</p>
          {pwdMsg.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              pwdMsg.ok
                ? "bg-green-500/10 border border-green-500/20 text-green-600"
                : "bg-red-500/10 border border-red-500/20 text-red-500"
            }`}>{pwdMsg.text}</div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="label">Current password</label>
              <div className="relative">
                <input className="input pr-10" type={showOld ? "text" : "password"}
                  placeholder="••••••••" value={oldPwd} onChange={e => setOldPwd(e.target.value)} required />
                <button type="button" onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showOld ? <EyeOff className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />
                           : <Eye className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input className="input pr-10" type={showNew ? "text" : "password"}
                  placeholder="••••••••" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  required minLength={6} />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showNew ? <EyeOff className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />
                           : <Eye className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
            </div>
            <button type="submit" disabled={pwdLoading} className="btn-primary">
              {pwdLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
