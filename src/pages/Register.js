// src/pages/Register.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Register() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const goNext = () => {
    // after sign up, we want them to pick a role first
    navigate("/role-selection", { replace: true, state: { next: state?.next || null } });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // create/merge minimal profile doc
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email,
          role: null,      // will be set on /role-selection
          plan: "free",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // give Firebase Auth a displayName so header can show something
      await updateProfile(cred.user, { displayName: cred.user.email?.split("@")[0] || "User" });

      goNext();
    } catch (err) {
      setError(err?.message?.replace("Firebase:", "").trim() || "Failed to create account.");
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
          <h1 style={{ margin: "0 0 8px" }}>Create your Nesta account</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Join Nesta to list or discover premium stays — <strong>fast, safe, and easy</strong>.
          </p>

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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                marginTop: 14,
              }}
            >
              <div>
                <label className="muted" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type={show ? "text" : "password"}
                  placeholder="Create a strong password"
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
              {busy ? "Creating…" : "Create Account"}
            </button>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <Link className="btn ghost" to="/phone-signin">Use phone instead</Link>
            </div>

            <p className="muted" style={{ marginTop: 12 }}>
              Already have an account?{" "}
              <Link to="/login" className="linkish" style={{ fontWeight: 700 }}>
                Sign in
              </Link>
            </p>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="linkish">Terms</Link> and{" "}
              <Link to="/privacy" className="linkish">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}