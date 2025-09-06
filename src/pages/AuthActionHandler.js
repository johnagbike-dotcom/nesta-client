// src/pages/AuthActionHandler.js
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import { auth } from "../firebase";

export default function AuthActionHandler() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode = params.get("mode");      // 'resetPassword' | 'verifyEmail' | 'recoverEmail' | ...
  const oobCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl");

  const [status, setStatus] = useState("loading"); // 'loading' | 'form' | 'done' | 'error'
  const [message, setMessage] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);

  // Helpers
  const goNext = () => {
    if (continueUrl) {
      window.location.assign(continueUrl);
    } else {
      navigate("/login");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!oobCode || !mode) {
        setStatus("error");
        setMessage("Invalid or missing action code.");
        return;
      }

      try {
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          setStatus("done");
          setMessage("Email verified successfully. You can now sign in.");
        } else if (mode === "verifyEmail") {
  await checkActionCode(auth, oobCode);   // validate first
  await applyActionCode(auth, oobCode);   // apply the code
  try { await auth.currentUser?.reload(); } catch {} // refresh user
  setStatus("done");
  setMessage("Email verified successfully. You can now continue.");
} else if (mode === "resetPassword") {
          // Validate the reset code; then show the password form.
          await verifyPasswordResetCode(auth, oobCode);
          if (cancelled) return;
          setStatus("form");
          setMessage("Enter a new password to complete the reset.");
        } else {
          setStatus("error");
          setMessage("Unsupported action.");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage(err?.message || "This link is invalid or expired.");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [mode, oobCode, navigate]);

  async function submitNewPassword(e) {
    e.preventDefault();
    if (!newPass || newPass.length < 6) {
      setMessage("Please choose a password with at least 6 characters.");
      return;
    }
    try {
      setBusy(true);
      await confirmPasswordReset(auth, oobCode, newPass);
      setStatus("done");
      setMessage("Password updated. You can now sign in.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(err?.message || "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen text-white bg-[#0b0f14] px-5 py-10">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Processing request…</h1>

        {status === "loading" && (
          <p className="text-white/80">Please wait…</p>
        )}

        {status === "form" && mode === "resetPassword" && (
          <form onSubmit={submitNewPassword} className="space-y-4">
            <p className="text-white/80">{message}</p>
            <input
              type="password"
              placeholder="New password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl px-5 py-3 bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold shadow-[0_6px_0_#c47e00] disabled:opacity-60"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
            <div className="mt-4">
              <Link to="/login" className="text-amber-300 underline">Back to login</Link>
            </div>
          </form>
        )}

        {status === "done" && (
          <div className="space-y-4">
            <p className="text-white/80">{message}</p>
            <button
              onClick={goNext}
              className="rounded-xl px-5 py-3 bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold shadow-[0_6px_0_#c47e00]"
            >
              Continue
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-red-400">{message}</p>
            <Link to="/login" className="text-amber-300 underline">Back to login</Link>
          </div>
        )}
      </div>
    </main>
  );
}