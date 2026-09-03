"use client";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Eye, EyeOff, ArrowRight, RotateCcw } from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "reset";

function AuthPageInner() {
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
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error") === "oauth_failed") {
      setError("Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

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

  async function handleGoogleSignIn() {
    setError(""); setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
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

          {(mode === "login" || mode === "signup") && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1" style={{background:"rgb(var(--ink-faint))"}} />
                <span className="text-xs" style={{color:"rgb(var(--ink-muted))"}}>OR</span>
                <div className="h-px flex-1" style={{background:"rgb(var(--ink-faint))"}} />
              </div>

              <button type="button" onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm"
                style={{borderColor:"rgb(var(--ink-faint))", color:"rgb(var(--ink))"}}>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.96H1.26v3.11A12 12 0 0 0 12 24z"/>
                  <path fill="#FBBC05" d="M5.25 14.28A7.2 7.2 0 0 1 4.86 12c0-.79.14-1.56.39-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l3.99-3.11z"/>
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.61l3.99 3.11C6.2 6.89 8.86 4.77 12 4.77z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

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

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
