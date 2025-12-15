import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import OfficialLogo from "../assets/Official-Logo.jpg";
export default function SignUpPage() {
  const nav = useNavigate();
  const { state } = useLocation(); // optional { next: "/host-dashboard" }

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const nextAfterRole = useMemo(() => state?.next || "/dashboard", [state]);

  async function ensureUserProfile(uid, emailVal, displayName) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: emailVal,
        displayName: displayName || null,
        role: "guest",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  function humanizeFirebaseError(e) {
    const code = e?.code || "";
    if (code === "auth/email-already-in-use") return "That email is already in use.";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/weak-password") return "Password is too weak. Use at least 6+ characters.";
    return e?.message?.replace(/^Firebase:\s*/i, "") || "Could not create your account.";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !pw) return setErr("Please enter an email and password.");
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");

    try {
      setLoading(true);

      const cleanEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pw);

      const displayName = (name.trim() || cleanEmail.split("@")[0]).slice(0, 60);

      try {
        await updateProfile(cred.user, { displayName });
      } catch {}

      await ensureUserProfile(cred.user.uid, cred.user.email || cleanEmail, displayName);

      // keep your existing flow: role selection after signup
      nav("/role-selection", { replace: true, state: { next: nextAfterRole } });
    } catch (e2) {
      console.error(e2);
      setErr(humanizeFirebaseError(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#070b12] to-[#05070d] text-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Brand */}
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
            Create your Nesta account
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Join Nigeria’s home of luxury stays — trusted, verified, and secure.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]"
        >
          {err && (
            <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100 text-sm">
              {err}
            </div>
          )}

          <label className="block mb-4">
            <span className="block text-sm text-white/70 mb-1">Full name (optional)</span>
            <input
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-sm text-white/70 mb-1">Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-sm text-white/70 mb-1">Password</span>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Create a strong password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 pr-12 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              Tip: Use 8+ characters for a stronger account.
            </div>
          </label>

          <label className="block mb-5">
            <span className="block text-sm text-white/70 mb-1">Confirm password</span>
            <div className="relative">
              <input
                type={showPw2 ? "text" : "password"}
                placeholder="Re-enter password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 pr-12 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPw2((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
              >
                {showPw2 ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-2xl font-semibold transition shadow-[0_18px_50px_rgba(0,0,0,.55)] ${
              loading
                ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                : "bg-gradient-to-b from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-500"
            }`}
          >
            {loading ? "Creating…" : "Sign up"}
          </button>

          <p className="mt-4 text-center text-sm text-white/60">
            Already have an account?{" "}
            <Link to="/login" className="underline decoration-dotted hover:text-amber-200">
              Sign in
            </Link>
          </p>

          <p className="mt-2 text-center text-[11px] text-white/45 leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="underline decoration-dotted hover:text-amber-200">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline decoration-dotted hover:text-amber-200">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <div className="mt-5 text-center text-xs text-white/50">
          <Link to="/" className="underline decoration-dotted hover:text-amber-200">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
