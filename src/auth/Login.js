// src/auth/Login.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithEmail } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/role-selection";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmail({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (e) {
      console.error(e);
      setError(
        e?.message?.replace("Firebase:", "").trim() ||
          "Failed to sign in. Please check your credentials."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign in</h1>

        {error && (
          <div className="mb-4 text-sm rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-4 py-3"
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-4 py-3"
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-lg px-4 py-3 bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/reset-password" className="text-amber-300 hover:text-amber-200">
            Forgot password?
          </Link>
          <Link to="/signup" className="text-amber-300 hover:text-amber-200">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}