// src/pages/Login.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const { state } = useLocation(); // may contain { next: "/somewhere" }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const goNext = () => {
    navigate(state?.next || "/role-selection", { replace: true });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      goNext();
    } catch (err) {
      setError(err?.message?.replace("Firebase:", "").trim() || "Failed to sign in.");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      goNext();
    } catch (err) {
      setError(err?.message?.replace("Firebase:", "").trim() || "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap" style={{ paddingBottom: 60 }}>
        <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>

        <div
          className="card"
          style={{
            marginTop: 16,
            padding: 26,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(180deg, rgba(30,41,59,0.40), rgba(30,41,59,0.30))",
            boxShadow: "0 18px 36px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h1 style={{ margin: "0 0 8px" }}>Welcome back to Nesta</h1>
          <p className="muted" style={{ marginTop: 0 }}>Sign in to continue your journey.</p>

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fca5a5",
                borderRadius: 8,
                padding: "8px 12px",
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
            <label className="muted" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
              required
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginTop: 14 }}>
              <div>
                <label className="muted" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type={show ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                  required
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              className="btn"
              type="submit"
              style={{ width: "100%", marginTop: 18 }}
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <button className="btn ghost" type="button" onClick={onGoogle} disabled={busy}>
                Continue with Google
              </button>
              <Link className="btn ghost" to="/phone-signin">Use phone instead</Link>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <Link to="/reset-password" className="muted linkish">Forgot password?</Link>
              <Link to="/signup" className="muted linkish">Create account</Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}