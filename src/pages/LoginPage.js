import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login, loginWithGoogle, loading, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/role-selection";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      await login(email, password);
      navigate(redirectTo, { replace: true });
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
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message?.replace(/^Firebase:\s*/i, "") || "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Sign in</h1>
      <p className="text-gray-300 mb-6">Access your account to manage bookings & listings.</p>

      {(error || authError) && (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {error || authError}
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
          disabled={submitting || loading}
          className="w-full py-3 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4">
        <button
          onClick={onGoogle}
          disabled={submitting || loading}
          className="w-full py-3 rounded border border-white/15 bg-white/5 text-gray-100 hover:bg-white/10 disabled:opacity-60"
        >
          Continue with Google
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-400">
        <Link to="/reset-password" className="underline mr-3">Forgot password?</Link>
        <Link to="/signup" className="underline mr-3">Create account</Link>
        <Link to="/" className="underline">Back to home</Link>
      </div>
    </main>
  );
}
