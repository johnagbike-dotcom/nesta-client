// src/auth/NewPassword.js
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";

export default function NewPassword({ oobCode: oobProp }) {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const auth = getAuth();

  const oobCode = oobProp || sp.get("oobCode");
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await verifyPasswordResetCode(auth, oobCode);
        if (alive) setValid(true);
      } catch (e) {
        if (alive) setMsg("Invalid or expired link.");
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [auth, oobCode]);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await confirmPasswordReset(auth, oobCode, pwd);
      setMsg("Password updated. Redirecting to sign in…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e) {
      setMsg(e.message || "Could not reset password.");
    }
  }

  if (checking) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f1419] text-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-extrabold mb-3">Set a new password</h1>

        {!valid ? (
          <p className="text-red-300 text-sm">{msg || "Invalid reset link."}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-yellow-400 text-black font-semibold py-2 hover:bg-yellow-500"
            >
              Save password
            </button>
            {msg && <div className="text-sm mt-2">{msg}</div>}
          </form>
        )}
      </div>
    </main>
  );
} 
