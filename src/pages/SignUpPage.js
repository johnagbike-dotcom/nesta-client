import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function SignUpPage() {
  const nav = useNavigate();
  const { state } = useLocation(); // optional { next: '/host-dashboard' }

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function ensureUserProfile(uid, emailVal, displayName) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: emailVal,
        displayName: displayName || null,
        role: "guest", // sensible default
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  function humanizeFirebaseError(e) {
    const code = e?.code || "";
    if (code === "auth/email-already-in-use") return "Email is already in use.";
    if (code === "auth/invalid-email") return "Invalid email address.";
    if (code === "auth/weak-password") return "Password is too weak.";
    return e?.message?.replace(/^Firebase:\s*/i, "") || "Could not create your account.";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !pw) return setErr("Please enter an email and password.");
    if (pw !== pw2) return setErr("Passwords do not match.");

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      const displayName = name.trim() || email.split("@")[0];
      try {
        await updateProfile(cred.user, { displayName });
      } catch {}

      await ensureUserProfile(cred.user.uid, cred.user.email || email.trim(), displayName);

      const next = state?.next || "/dashboard";
      nav("/role-selection", { replace: true, state: { next } });
    } catch (e2) {
      console.error(e2);
      setErr(humanizeFirebaseError(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white grid place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md p-7 rounded-2xl bg-white/5 border border-amber-400/30 backdrop-blur">
        <h2 className="text-2xl font-bold text-amber-400 mb-1">Create account</h2>
        <p className="text-gray-300 mb-4">Join Nesta — Nigeria’s home of luxury stays.</p>

        {err && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">
            {err}
          </div>
        )}

        <label className="block mb-3">
          <span className="block text-sm text-gray-300 mb-1">Full name (optional)</span>
          <input
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm text-gray-300 mb-1">Email</span>
          <input
            type="email"
            placeholder="you@nesta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-sm text-gray-300 mb-1">Password</span>
          <input
            type="password"
            placeholder="Create a strong password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-sm text-gray-300 mb-1">Confirm password</span>
          <input
            type="password"
            placeholder="Re-enter password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account? <Link to="/login" className="underline">Sign in</Link>
        </p>
        <p className="mt-1 text-center text-xs text-gray-400">
          By creating an account, you agree to our{" "}
          <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </main>
  );
}
