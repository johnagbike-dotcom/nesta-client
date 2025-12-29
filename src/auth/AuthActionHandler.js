// src/auth/AuthActionHandler.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

function stripFirebasePrefix(msg) {
  return String(msg || "").replace(/^Firebase:\s*/i, "").trim();
}

export default function AuthActionHandler() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const mode = params.get("mode"); // verifyEmail | resetPassword | recoverEmail | verifyAndChangeEmail
  const oobCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl");

  const [stage, setStage] = useState("loading"); // loading | ready | done | error
  const [err, setErr] = useState("");

  // reset password
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const canSubmit = pw1 && pw2 && pw1 === pw2 && pw1.length >= 10;

  useEffect(() => {
    (async () => {
      setErr("");
      setStage("loading");

      try {
        if (!mode || !oobCode) throw new Error("Invalid or incomplete link.");

        // ✅ VERIFY EMAIL
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);

          // ✅ Force-refresh auth state if user exists in this browser
          // (Often there is no currentUser because the verify link opens in a new browser context)
          try {
            if (auth.currentUser) {
              await auth.currentUser.reload();
              await auth.currentUser.getIdToken(true);
              await auth.currentUser.reload();
            }
          } catch {
            // ignore
          }

          // ✅ IMPORTANT: sign out so login page starts from a clean session
          try {
            await signOut(auth);
          } catch {
            // ignore
          }

          setStage("done");

          // ✅ Redirect back to login with a cache buster so SPA state is fresh
          setTimeout(() => {
            nav("/login", {
              replace: true,
              state: {
                info:
                  "✅ Email verified successfully. Please sign in again (fresh session).",
                from: continueUrl || "/role-selection",
                ts: Date.now(),
              },
            });
          }, 700);

          return;
        }

        // ✅ RESET PASSWORD flow
        if (mode === "resetPassword") {
          const mail = await verifyPasswordResetCode(auth, oobCode);
          setEmail(mail || "");
          setStage("ready");
          return;
        }

        // Other modes: validate so we can show a friendly message
        await checkActionCode(auth, oobCode);
        setStage("done");
      } catch (e) {
        console.error("AuthActionHandler error:", e);
        setErr(stripFirebasePrefix(e?.message) || "This link is invalid or has expired.");
        setStage("error");
      }
    })();
  }, [mode, oobCode, nav, continueUrl]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!canSubmit) {
      if (pw1.length < 10) return setErr("Password must be at least 10 characters.");
      if (pw1 !== pw2) return setErr("Passwords do not match.");
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, pw1);
      setStage("done");
      setTimeout(() => nav("/login", { replace: true }), 900);
    } catch (e2) {
      console.error("confirmPasswordReset error:", e2);
      setErr(stripFirebasePrefix(e2?.message) || "Could not reset password.");
    }
  }

  if (stage === "loading") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center text-white">
        Processing…
      </main>
    );
  }

  if (stage === "error") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-2">Link problem</h1>
          <p className="text-red-200 text-sm">{err}</p>

          <div className="mt-4 flex gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white"
            >
              Back to login
            </Link>
            <Link
              to="/reset"
              className="px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ✅ Email verification success (brief)
  if (mode === "verifyEmail" && stage === "done") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-2">Email verified</h1>
          <p className="text-white/80 text-sm">
            Redirecting you back to login…
          </p>
        </div>
      </main>
    );
  }

  // ✅ Reset password form
  if (mode === "resetPassword" && stage === "ready") {
    return (
      <main className="min-h-[70vh] px-4 py-10 text-white">
        <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-extrabold">Set a new password</h1>
          {email ? (
            <p className="text-white/70 mt-1">
              for <strong>{email}</strong>
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-white/80">New password</span>
              <input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-white/80">Confirm new password</span>
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                autoComplete="new-password"
                required
              />
            </label>

            {err ? <div className="text-red-300 text-sm">{err}</div> : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`mt-2 px-4 py-2 rounded-xl font-semibold ${
                canSubmit
                  ? "bg-amber-400 text-black hover:bg-amber-500"
                  : "bg-white/10 text-white/60 cursor-not-allowed"
              }`}
            >
              Save new password
            </button>

            <div className="text-sm text-white/70 mt-2">
              Remembered?{" "}
              <Link to="/login" className="text-amber-300 underline">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white">
        <h1 className="text-xl font-bold mb-2">Done</h1>
        <p className="text-white/80 text-sm">You can now continue.</p>
        <div className="mt-4">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold"
          >
            Go to login
          </Link>
        </div>
      </div>
    </main>
  );
}
