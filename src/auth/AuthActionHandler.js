// src/auth/AuthActionHandler.js
import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
} from "firebase/auth";
import { auth } from "../firebase";

export default function AuthActionHandler() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const mode = params.get("mode");      // resetPassword | verifyEmail | recoverEmail
  const oobCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl") || "/";

  const [stage, setStage] = useState("loading"); // loading | ready | done | error
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!oobCode) throw new Error("Missing action code.");
        if (mode === "resetPassword") {
          const e = await verifyPasswordResetCode(auth, oobCode);
          setEmail(e);
          setStage("ready");
        } else if (mode === "verifyEmail") {
          await checkActionCode(auth, oobCode);
          setStage("done");
        } else {
          throw new Error("Unsupported action.");
        }
      } catch (e) {
        setErr(e?.message?.replace("Firebase:", "").trim() || "Invalid or expired link.");
        setStage("error");
      }
    })();
  }, [mode, oobCode]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (pw1.length < 10) return setErr("Password must be at least 10 characters.");
    if (pw1 !== pw2) return setErr("Passwords do not match.");
    try {
      await confirmPasswordReset(auth, oobCode, pw1);
      setStage("done");
      // optional redirect after a moment
      setTimeout(() => nav("/login", { replace: true }), 1200);
    } catch (e) {
      setErr(e?.message?.replace("Firebase:", "").trim() || "Could not set password.");
    }
  }

  if (stage === "loading") return null;

  // Email verification success
  if (mode === "verifyEmail" && stage === "done") {
    return (
      <main className="container mx-auto max-w-md px-4 py-12 text-white">
        <h1 className="text-2xl font-bold text-yellow-400 mb-2">Email verified</h1>
        <p className="text-white/80">Thanks! You can now sign in.</p>
        <Link to="/login" className="inline-block mt-4 px-4 py-2 rounded bg-yellow-400 text-black font-semibold">Go to login</Link>
      </main>
    );
  }

  // Password reset form
  if (mode === "resetPassword" && (stage === "ready" || stage === "error")) {
    return (
      <main className="container mx-auto max-w-md px-4 py-12 text-white">
        <h1 className="text-2xl font-bold text-yellow-400 mb-2">Set a new password</h1>
        <p className="text-white/70">for <strong>{email || "your account"}</strong></p>

        {err && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">{err}</div>}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm text-white/80 mb-1">New password</label>
            <input
              type="password"
              value={pw1}
              onChange={(e)=>setPw1(e.target.value)}
              placeholder="Create a strong password"
              className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 focus:border-yellow-400"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1">Confirm password</label>
            <input
              type="password"
              value={pw2}
              onChange={(e)=>setPw2(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 focus:border-yellow-400"
              autoComplete="new-password"
              required
            />
          </div>
          <button className="w-full py-3 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500">
            Save new password
          </button>
        </form>

        <p className="mt-4 text-sm text-white/60">
          Or return to <Link to="/login" className="underline">login</Link>.
        </p>
      </main>
    );
  }

  // Generic error
  return (
    <main className="container mx-auto max-w-md px-4 py-12 text-white">
      <h1 className="text-2xl font-bold text-yellow-400 mb-2">Link problem</h1>
      <p className="text-white/80">{err || "This link is invalid or has expired."}</p>
      <Link to="/reset" className="inline-block mt-4 px-4 py-2 rounded bg-yellow-400 text-black font-semibold">Request a new link</Link>
    </main>
  );
} 
