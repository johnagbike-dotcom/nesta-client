// src/pages/LoginPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../firebase";
import OfficialLogo from "../assets/Official-Logo.jpg";

function safeRedirectFromState(state) {
  const from = state?.from;
  if (!from) return null;
  if (typeof from === "string") return from;
  if (typeof from?.pathname === "string") return from.pathname;
  return null;
}

function stripFirebasePrefix(msg) {
  return String(msg || "").replace(/^Firebase:\s*/i, "").trim();
}

function humanizeAuthError(e) {
  const code = e?.code || "";
  const msg = stripFirebasePrefix(e?.message || "");

  if (code === "auth/wrong-password") return "Incorrect password.";
  if (code === "auth/user-not-found") return "No account found with that email.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait and try again.";
  if (code === "auth/network-request-failed")
    return "Network error. Check your connection and try again.";
  return msg || "Login failed";
}

/**
 * ✅ Robust refresh: emailVerified can lag after clicking verify link (esp. mobile in-app browsers).
 * We retry a few times before deciding the user is unverified.
 */
async function refreshVerifiedStateWithRetry(user, { retries = 6, delayMs = 450 } = {}) {
  if (!user) return null;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < retries; i++) {
    try {
      await user.reload();
    } catch {
      // ignore
    }

    // quick exit if verified
    if (user.emailVerified) return user;

    // force token refresh (helps pull latest claims/user state)
    try {
      await user.getIdToken(true);
    } catch {
      // ignore
    }

    try {
      await user.reload();
    } catch {
      // ignore
    }

    if (user.emailVerified) return user;

    // tiny pause then retry
    await wait(delayMs);
  }

  return user;
}

export default function LoginPage() {
  const { beginLogin, loginWithGoogle, loading, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Verification UX
  const [needsVerify, setNeedsVerify] = useState(false);
  const [verifyEmailToResend, setVerifyEmailToResend] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");

  const nav = useNavigate();
  const location = useLocation();

  const incomingInfo = location.state?.info || "";

  const redirectTo = useMemo(() => {
    const from = safeRedirectFromState(location.state);
    return from || "/role-selection";
  }, [location.state]);

  useEffect(() => {
    if (incomingInfo) setInfoMsg(String(incomingInfo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disabled = submitting || loading;

  /**
   * ✅ Gate using the signed-in user returned by beginLogin()
   */
  const runVerifiedGate = async (signedInUser, cleanEmail) => {
    if (!signedInUser) return { ok: false, reason: "no-user" };

    // Try to get freshest possible state (with retries)
    const fresh = await refreshVerifiedStateWithRetry(signedInUser);

    const providerIds = (fresh?.providerData || [])
      .map((p) => p?.providerId)
      .filter(Boolean);

    const isPasswordUser =
      providerIds.includes("password") || providerIds.length === 0;

    // If password user still not verified after retries, block
    if (isPasswordUser && fresh?.emailVerified === false) {
      setNeedsVerify(true);
      setVerifyEmailToResend(cleanEmail);

      setError(
        "Your email is not verified yet. Please check your inbox (and spam) for the verification link, then sign in again."
      );

      // Sign out so they don’t enter app unverified
      try {
        await signOut(auth);
      } catch {}

      return { ok: false, reason: "not-verified" };
    }

    return { ok: true };
  };

  const resetMessages = () => {
    setError("");
    setInfoMsg("");
    setNeedsVerify(false);
    setVerifyEmailToResend("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim().toLowerCase();

    try {
      setSubmitting(true);

      // 1) sign in (supports MFA)
      const res = await beginLogin(cleanEmail, password);

      if (res?.mfaRequired) {
        nav("/mfa", { replace: true, state: { redirectTo } });
        return;
      }

      const signedInUser = res?.user;

      // 2) verification gate
      const gate = await runVerifiedGate(signedInUser, cleanEmail);
      if (!gate.ok) return;

      // 3) continue
      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(humanizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    resetMessages();

    try {
      setSubmitting(true);
      await loginWithGoogle();
      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(stripFirebasePrefix(err?.message) || "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    setError("");
    setInfoMsg("");

    const cleanEmail = verifyEmailToResend || email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Enter your email and password, then tap Resend verification.");
      return;
    }

    try {
      setResendBusy(true);

      const res = await beginLogin(cleanEmail, password);
      if (res?.mfaRequired) {
        setError("This account has MFA enabled. Please finish sign-in first.");
        return;
      }

      const signedInUser = res?.user;
      if (!signedInUser) {
        setError("Could not authenticate to resend verification. Please try again.");
        return;
      }

      const fresh = await refreshVerifiedStateWithRetry(signedInUser, { retries: 3, delayMs: 250 });

      if (fresh?.emailVerified) {
        setInfoMsg("✅ Your email is already verified. Please sign in.");
        setNeedsVerify(false);
        try {
          await signOut(auth);
        } catch {}
        return;
      }

      await sendEmailVerification(signedInUser);
      setInfoMsg("✅ Verification email sent. Please check inbox/spam.");

      try {
        await signOut(auth);
      } catch {}
    } catch (e) {
      console.error(e);
      setError(stripFirebasePrefix(e?.message) || "Could not resend verification email.");
    } finally {
      setResendBusy(false);
    }
  };

  const refreshVerificationStatus = async () => {
    setError("");
    setInfoMsg("");

    const cleanEmail = verifyEmailToResend || email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Enter your email and password, then tap Refresh status.");
      return;
    }

    try {
      setRefreshBusy(true);

      const res = await beginLogin(cleanEmail, password);
      if (res?.mfaRequired) {
        setError("This account has MFA enabled. Please finish sign-in first.");
        return;
      }

      const signedInUser = res?.user;

      // Run the full retry gate here too
      const gate = await runVerifiedGate(signedInUser, cleanEmail);
      if (!gate.ok) return;

      setInfoMsg("✅ Verification detected. You can now sign in.");
      try {
        await signOut(auth);
      } catch {}
    } catch (e) {
      console.error(e);
      setError(stripFirebasePrefix(e?.message) || "Could not refresh status.");
      try {
        await signOut(auth);
      } catch {}
    } finally {
      setRefreshBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#070b12] to-[#05070d] text-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">
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

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          {infoMsg ? (
            <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-emerald-100 text-sm">
              {infoMsg}
            </div>
          ) : null}

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

          {needsVerify && (
            <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-400/10 p-4">
              <div className="text-sm text-amber-100 font-semibold">
                Email verification required
              </div>
              <div className="text-xs text-white/70 mt-1">
                If you can’t find the link, resend it below. If you already verified, refresh your status.
              </div>

              <button
                type="button"
                onClick={resendVerification}
                disabled={resendBusy || disabled}
                className={`mt-3 w-full py-2.5 rounded-2xl font-semibold transition ${
                  resendBusy || disabled
                    ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                    : "bg-white/5 border border-white/15 hover:bg-white/10 text-white"
                }`}
              >
                {resendBusy ? "Resending…" : "Resend verification email"}
              </button>

              <button
                type="button"
                onClick={refreshVerificationStatus}
                disabled={refreshBusy || disabled}
                className={`mt-2 w-full py-2.5 rounded-2xl font-semibold transition ${
                  refreshBusy || disabled
                    ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                    : "bg-white/5 border border-white/15 hover:bg-white/10 text-white"
                }`}
              >
                {refreshBusy ? "Refreshing…" : "Refresh verification status"}
              </button>

              <div className="mt-2 text-[11px] text-white/55">
                Tip: Gmail may open the verify link in an in-app browser. After verifying, come back and tap Refresh status.
              </div>
            </div>
          )}

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
            Security note: contact details remain hidden by policy and are only revealed when your booking status permits.
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-white/50">
          <Link to="/" className="underline decoration-dotted hover:text-amber-200">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
