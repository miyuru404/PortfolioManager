"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { TrendingUp, Eye, EyeOff, ArrowRight, RotateCcw } from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "reset";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/home");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        setMessage("Account created! Please check your email to confirm, then log in.");
        setMode("login");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{background:"rgb(var(--surface))"}}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{background:"rgb(var(--brand-400))"}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">CSE Tracker</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold text-white leading-tight mb-4">
            Track your CSE<br />portfolio with<br />confidence.
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Live prices from the Colombo Stock Exchange, portfolio averages,
            P&L visualisation, and more — all in one place.
          </p>
        </div>
        <div className="flex gap-6">
          {["Live CSE Prices","Average Calculator","P&L Tracker"].map(f => (
            <div key={f} className="bg-white/10 rounded-lg px-3 py-2">
              <span className="text-white/90 text-xs font-medium">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <TrendingUp className="w-5 h-5" style={{color:"rgb(var(--brand-400))"}} />
            <span className="font-semibold">CSE Tracker</span>
          </div>

          <h2 className="text-2xl font-semibold mb-1" style={{color:"rgb(var(--ink))"}}>
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Reset password"}
          </h2>
          <p className="text-sm mb-7" style={{color:"rgb(var(--ink-muted))"}}>
            {mode === "login" && "Sign in to your portfolio"}
            {mode === "signup" && "Start tracking your CSE investments"}
            {mode === "forgot" && "We'll send a reset link to your email"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
          )}
          {message && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">{message}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Full name</label>
                <input className="input" type="text" placeholder="Your name" value={fullName}
                  onChange={e => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            {(mode === "login" || mode === "signup") && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input className="input pr-10" type={showPwd ? "text" : "password"}
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{color:"rgb(var(--ink-faint))"}}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2">
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" && "Sign in"}
                  {mode === "signup" && "Create account"}
                  {mode === "forgot" && "Send reset link"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}
                  className="text-xs block w-full" style={{color:"rgb(var(--ink-muted))"}}>
                  Forgot your password?
                </button>
                <p className="text-sm" style={{color:"rgb(var(--ink-muted))"}}>
                  No account?{" "}
                  <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
                    className="font-medium" style={{color:"rgb(var(--brand-400))"}}>
                    Sign up
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-sm" style={{color:"rgb(var(--ink-muted))"}}>
                Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                  className="font-medium" style={{color:"rgb(var(--brand-400))"}}>
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="text-sm" style={{color:"rgb(var(--ink-muted))"}}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
