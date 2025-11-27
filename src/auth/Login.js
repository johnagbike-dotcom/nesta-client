// src/auth/Login.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // fallbacks: redirect to where they came from or home
  const redirectTo = location.state?.from || "/";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        err?.message?.replace(/^Firebase:\s*/i, "") || "Login failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setError("");
    try {
      setSubmitting(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        err?.message?.replace(/^Firebase:\s*/i, "") || "Google sign-in failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-12 text-white">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Sign in</h1>
      <p className="text-gray-300 mb-6">
        Access your account to manage bookings & listings.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between text-sm">
        {/* your router exposes /reset for password reset */}
        <Link to="/reset" className="text-amber-300 hover:text-amber-200">
          Forgot password?
        </Link>
        <Link to="/signup" className="text-amber-300 hover:text-amber-200">
          Create account
        </Link>
      </div>

      <div className="mt-6">
        <button
          onClick={onGoogle}
          disabled={submitting}
          className="w-full py-3 rounded border border-white/15 bg-white/5 text-gray-100 hover:bg-white/10 disabled:opacity-60"
        >
          Continue with Google
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-400">
        <Link to="/" className="underline">Back to home</Link>
      </div>
    </main>
  );
}
