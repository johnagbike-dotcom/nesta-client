// src/auth/SignUp.js
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function SignUp() {
  const navigate = useNavigate();
  const { state } = useLocation(); // may carry { next: '/host-dashboard' } later

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Optional: set displayName for a nicer dashboard greeting
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      // Create a user doc if it doesn't exist (no role yet)
      const uref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) {
        await setDoc(uref, {
          email: email.trim(),
          displayName: name.trim() || null,
          role: null,
          createdAt: Date.now()
        });
      }
      // Send them to role selection first time
      const next = state?.next || "/dashboard";
      navigate("/role-selection", { replace: true, state: { next } });
    } catch (e2) {
      console.error(e2);
      setErr("Could not create account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full card p-6">
        <h1 className="text-2xl font-bold text-amber-400 text-center">Create your Nesta account</h1>
        <p className="mt-1 text-center muted">
          Join Nesta to list or discover premium stays — <strong>fast, safe, and easy</strong>.
        </p>

        {err && <div className="alert-error mt-3">{err}</div>}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="name" className="muted">Full name (optional)</label>
            <input
              id="name"
              className="input mt-1"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e)=>setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="muted">Email</label>
            <input
              id="email"
              className="input mt-1"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
          </div>

          <div className="password-row mt-1">
            <div>
              <label htmlFor="password" className="muted">Password</label>
              <input
                id="password"
                className="input mt-1"
                type={show ? "text" : "password"}
                placeholder="Create a strong password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="button"
              className="btn ghost small self-end"
              onClick={() => setShow(s => !s)}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>

          <button className="btn w-full mt-2" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create Account"}
          </button>

          <p className="mt-2 text-center muted">
            Already have an account?{" "}
            <Link to="/login" className="link gold">Sign in</Link>
          </p>
          <p className="mt-1 text-center muted text-xs">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="link gold">Terms</Link> and{" "}
            <Link to="/privacy" className="link gold">Privacy Policy</Link>.
          </p>
        </form>
      </div>
    </main>
  );
}