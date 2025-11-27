// src/pages/AuthActionHandler.js
// Handles Firebase email actions (reset password, verify email, etc.)
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from "firebase/auth";
import { auth } from "../firebase";

export default function AuthActionHandler() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode = params.get("mode");       // e.g. resetPassword, verifyEmail
  const oobCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl") || "/login";

  const [stage, setStage] = useState("loading"); // loading | ready | done | error
  const [error, setError] = useState("");
  const [email, setEmail] = useState(null);

  // reset password fields
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const canSubmit = useMemo(() => p1 && p2 && p1 === p2 && p1.length >= 10, [p1, p2]);

  useEffect(() => {
    (async () => {
      try {
        if (!mode || !oobCode) throw new Error("Invalid link.");
        if (mode === "resetPassword") {
          const mail = await verifyPasswordResetCode(auth, oobCode);
          setEmail(mail);
          setStage("ready");
          return;
        }
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          setStage("done");
          return;
        }
        throw new Error("Unsupported action.");
      } catch (e) {
        setError(e?.message || "Link is invalid or expired.");
        setStage("error");
      }
    })();
  }, [mode, oobCode]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await confirmPasswordReset(auth, oobCode, p1);
      setStage("done");
      // optional: small delay then go to login
      setTimeout(() => navigate(continueUrl), 1200);
    } catch (e) {
      setError(e?.message || "Could not reset password.");
    }
  }

  // UI
  if (stage === "loading") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center text-white">
        Validating link…
      </main>
    );
  }

  if (stage === "error") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-xl p-5 text-white">
          <h1 className="text-xl font-bold mb-2">Link problem</h1>
          <p className="text-red-200">{error}</p>
          <div className="mt-4">
            <Link to="/reset" className="underline text-amber-300">Request a new reset link</Link>
          </div>
        </div>
      </main>
    );
  }

  if (mode === "verifyEmail" && stage === "done") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-xl p-5 text-white">
          <h1 className="text-xl font-bold mb-2">Email verified</h1>
          <p className="text-white/80">Thanks! Your email has been verified.</p>
          <div className="mt-4">
            <Link to="/login" className="px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold">Continue</Link>
          </div>
        </div>
      </main>
    );
  }

  // reset password form
  return (
    <main className="min-h-[70vh] px-4 py-10 text-white">
      <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-extrabold">Set a new password</h1>
        {email ? <p className="text-white/70 mt-1">for <strong>{email}</strong></p> : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="font-semibold mb-1">Password rules</div>
          <ul className="list-disc pl-5 space-y-1 text-sm text-white/80">
            <li>At least 10 characters</li>
            <li>Uppercase and lowercase letters</li>
            <li>A number and a special character</li>
          </ul>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-white/80">New password</span>
            <input
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-white/80">Confirm new password</span>
            <input
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
            />
          </label>

          {error ? <div className="text-red-300 text-sm">{error}</div> : null}

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
            Remembered? <Link to="/login" className="text-amber-300 underline">Back to login</Link>
          </div>
        </form>
      </div>
    </main>
  );
} 
