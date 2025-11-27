// src/auth/SignUp.js
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

function humanizeFirebaseError(e) {
  const code = e?.code || "";
  if (code === "auth/email-already-in-use") return "Email is already in use.";
  if (code === "auth/invalid-email") return "Invalid email address.";
  if (code === "auth/weak-password") return "Password is too weak.";
  return e?.message?.replace(/^Firebase:\s*/i, "") || "Could not create your account.";
}

export default function SignUp() {
  const navigate = useNavigate();
  const { state } = useLocation(); // may carry { next: '/host' } later

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
        role: "guest",             // default; can be changed after role-selection
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !pw) {
      setErr("Please enter an email and password.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);

      const displayName = name.trim() || email.split("@")[0];
      try {
        await updateProfile(cred.user, { displayName });
      } catch {}

      await ensureUserProfile(cred.user.uid, cred.user.email || email.trim(), displayName);

      const next = state?.next || "/role-selection";
      navigate(next, { replace: true });
    } catch (e2) {
      console.error(e2);
      setErr(humanizeFirebaseError(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen grid place-items-center px-4"
      style={{
        background: "linear-gradient(135deg, #0f0f0f, #1a1a1a)",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md"
        style={{
          padding: 28,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(212,175,55,0.35)",
          color: "#fff",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 6, color: "#d4af37" }}>
          Create account
        </h2>
        <p style={{ marginTop: 0, color: "#bbb" }}>
          Join Nesta — Nigeria’s home of luxury stays.
        </p>

        {err && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
              borderRadius: 10,
              padding: "10px 12px",
              marginTop: 12,
              marginBottom: 10,
              fontSize: 14,
            }}
          >
            {err}
          </div>
        )}

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
            Full name (optional)
          </div>
          <input
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
            Email
          </div>
          <input
            type="email"
            placeholder="you@nesta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
            Password
          </div>
          <input
            type="password"
            placeholder="Create a strong password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
            Confirm password
          </div>
          <input
            type="password"
            placeholder="Re-enter password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            required
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn"
          style={{
            marginTop: 16,
            width: "100%",
            backgroundColor: "#d4af37",
            color: "#000",
            fontWeight: 700,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          {loading ? "Creating…" : "Sign up"}
        </button>

        <p style={{ marginTop: 14, color: "#bbb", fontSize: 14 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
