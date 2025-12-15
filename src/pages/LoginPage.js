import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OfficialLogo from "../assets/Official-Logo.jpg";
function safeRedirectFromState(state) {
  // supports:
  // state.from = "/reserve/abc"
  // state.from = { pathname: "/reserve/abc" }
  // state.from.pathname = "/reserve/abc"
  const from = state?.from;
  if (!from) return null;
  if (typeof from === "string") return from;
  if (typeof from?.pathname === "string") return from.pathname;
  return null;
}

export default function LoginPage() {
  const { beginLogin, loginWithGoogle, loading, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nav = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const from = safeRedirectFromState(location.state);
    return from || "/role-selection";
  }, [location.state]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);

      const res = await beginLogin(email, password);

      // ✅ MFA route
      if (res?.mfaRequired) {
        nav("/mfa", { replace: true, state: { redirectTo } });
        return;
      }

      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message?.replace(/^Firebase:\s*/i, "") || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setError("");
    try {
      setSubmitting(true);
      await loginWithGoogle();
      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        err?.message?.replace(/^Firebase:\s*/i, "") || "Google sign-in failed"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || loading;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#070b12] to-[#05070d] text-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Brand / header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center overflow-hidden">
          <img src={OfficialLogo} alt="Nesta" className="h-full w-full object-cover" />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{
              fontFamily:
                'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
            }}
          >
            Welcome back
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Sign in to manage bookings, chat with hosts, and reserve luxury stays.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          {(error || authError) && (
            <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100 text-sm">
              {error || authError}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm text-white/70 mb-1">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="block text-sm text-white/70 mb-1">Password</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 pr-12 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={disabled}
              className={`w-full py-3 rounded-2xl font-semibold transition shadow-[0_18px_50px_rgba(0,0,0,.55)] ${
                disabled
                  ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-b from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-500"
              }`}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-4">
            <button
              onClick={onGoogle}
              disabled={disabled}
              className={`w-full py-3 rounded-2xl border transition ${
                disabled
                  ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                  : "bg-white/5 border-white/15 hover:bg-white/10 text-white"
              }`}
            >
              Continue with Google
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            {/* ✅ your router uses /reset */}
            <Link
              to="/reset"
              className="text-white/70 hover:text-amber-200 underline decoration-dotted"
            >
              Forgot password?
            </Link>

            <Link
              to="/signup"
              className="text-white/70 hover:text-amber-200 underline decoration-dotted"
            >
              Create account
            </Link>
          </div>

          <div className="mt-5 text-[11px] text-white/45 leading-relaxed">
            Security note: contact details remain hidden by policy and are only
            revealed when your booking status permits.
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-white/50">
          <Link
            to="/"
            className="underline decoration-dotted hover:text-amber-200"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
