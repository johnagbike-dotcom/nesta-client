// src/auth/SignUp.js
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

/* ---------------- Password policy helpers ---------------- */

const MIN_LEN = 10;

const COMMON_WEAK = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty",
  "qwerty123",
  "111111",
  "000000",
  "iloveyou",
  "admin",
  "welcome",
  "letmein",
]);

function getPwChecks(pwRaw, emailRaw = "", nameRaw = "") {
  const pw = String(pwRaw || "").trim();
  const email = String(emailRaw || "").trim().toLowerCase();
  const name = String(nameRaw || "").trim().toLowerCase();

  const hasMin = pw.length >= MIN_LEN;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);

  const pwLower = pw.toLowerCase();
  const isCommon = COMMON_WEAK.has(pwLower);

  const emailUser = email.includes("@") ? email.split("@")[0] : "";
  const includesEmailUser = emailUser && pwLower.includes(emailUser);
  const includesEmailFull = email && pwLower.includes(email);
  const includesName = name && name.length >= 3 && pwLower.includes(name.replace(/\s+/g, ""));

  const noPersonal = !includesEmailUser && !includesEmailFull && !includesName;

  const ok = hasMin && hasUpper && hasLower && hasNum && hasSpecial && !isCommon && noPersonal;

  let firstFail = "";
  if (!hasMin) firstFail = `Password must be at least ${MIN_LEN} characters.`;
  else if (!hasUpper) firstFail = "Add at least 1 uppercase letter (A–Z).";
  else if (!hasLower) firstFail = "Add at least 1 lowercase letter (a–z).";
  else if (!hasNum) firstFail = "Add at least 1 number (0–9).";
  else if (!hasSpecial) firstFail = "Add at least 1 special character (e.g. !@#£$).";
  else if (isCommon) firstFail = "That password is too common. Please choose a stronger one.";
  else if (!noPersonal) firstFail = "Don’t use your name or email in your password.";

  return {
    ok,
    hasMin,
    hasUpper,
    hasLower,
    hasNum,
    hasSpecial,
    isCommon,
    noPersonal,
    firstFail,
  };
}

/* ---------------- Error helper ---------------- */

function humanizeFirebaseError(e) {
  const code = e?.code || "";
  if (code === "auth/email-already-in-use") return "Email is already in use.";
  if (code === "auth/invalid-email") return "Invalid email address.";
  // Firebase checks only len>=6; our checks are stricter
  if (code === "auth/weak-password") return "Password is too weak. Please use a stronger one.";
  return e?.message?.replace(/^Firebase:\s*/i, "") || "Could not create your account.";
}

/* ---------------- Component ---------------- */

export default function SignUp() {
  const navigate = useNavigate();
  const { state } = useLocation(); // may carry { next: '/host' } later

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const pwChecks = useMemo(() => getPwChecks(pw, email, name), [pw, email, name]);
  const confirmOk = pw2.length > 0 && pw === pw2;

  const canSubmit = useMemo(() => {
    const cleanEmail = email.trim();
    return (
      !loading &&
      cleanEmail.length > 3 &&
      cleanEmail.includes("@") &&
      pwChecks.ok &&
      confirmOk
    );
  }, [email, pwChecks.ok, confirmOk, loading]);

  async function ensureUserProfile(uid, emailVal, displayName) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        email: emailVal,
        emailLower: String(emailVal || "").toLowerCase(),
        displayName: displayName || null,
        role: "guest", // default; can be changed after role-selection
        isAdmin: false,
        plan: "free",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !pw) {
      setErr("Please enter an email and password.");
      return;
    }
    if (!pwChecks.ok) {
      setErr(pwChecks.firstFail || "Please choose a stronger password.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pw);

      const displayName = (name.trim() || cleanEmail.split("@")[0]).slice(0, 60);
      try {
        await updateProfile(cred.user, { displayName });
      } catch {}

      await ensureUserProfile(cred.user.uid, cred.user.email || cleanEmail, displayName);

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
        <h2 style={{ margin: 0, marginBottom: 6, color: "#d4af37" }}>Create account</h2>
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
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>Full name (optional)</div>
          <input
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>Email</div>
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
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>Password</div>
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

          {/* lightweight hints (no redesign) */}
          <div style={{ marginTop: 10, fontSize: 12, color: "#bdbdbd", lineHeight: 1.6 }}>
            <div style={{ color: pwChecks.hasMin ? "#a7f3d0" : "#bdbdbd" }}>
              • At least {MIN_LEN} characters
            </div>
            <div style={{ color: pwChecks.hasUpper ? "#a7f3d0" : "#bdbdbd" }}>• 1 uppercase letter</div>
            <div style={{ color: pwChecks.hasLower ? "#a7f3d0" : "#bdbdbd" }}>• 1 lowercase letter</div>
            <div style={{ color: pwChecks.hasNum ? "#a7f3d0" : "#bdbdbd" }}>• 1 number</div>
            <div style={{ color: pwChecks.hasSpecial ? "#a7f3d0" : "#bdbdbd" }}>• 1 special character</div>
            <div style={{ color: !pwChecks.isCommon ? "#a7f3d0" : "#fca5a5" }}>
              • Not a common password
            </div>
            <div style={{ color: pwChecks.noPersonal ? "#a7f3d0" : "#fca5a5" }}>
              • Doesn’t include your name/email
            </div>
          </div>
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>Confirm password</div>
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
          {pw2.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: confirmOk ? "#a7f3d0" : "#fca5a5" }}>
              {confirmOk ? "✓ Passwords match" : "Passwords do not match"}
            </div>
          )}
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn"
          style={{
            marginTop: 16,
            width: "100%",
            backgroundColor: canSubmit ? "#d4af37" : "rgba(255,255,255,0.12)",
            color: canSubmit ? "#000" : "rgba(255,255,255,0.45)",
            fontWeight: 700,
            borderRadius: 10,
            padding: "12px 14px",
            cursor: canSubmit ? "pointer" : "not-allowed",
            border: "1px solid rgba(255,255,255,0.12)",
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
