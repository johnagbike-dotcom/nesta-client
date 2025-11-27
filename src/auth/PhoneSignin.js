// src/auth/PhoneSignin.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Luxury phone sign-in with OTP (Firebase)
 * - Make sure Phone provider is enabled in Firebase Auth
 * - Add your domain (localhost and production) to Firebase Auth authorized domains
 */
export default function PhoneSignin() {
  const navigate = useNavigate();
  const location = useLocation();

  const nextPath = useMemo(() => {
    const s = location.state?.next;
    const q = new URLSearchParams(location.search).get("next");
    return s || q || "/dashboard";
  }, [location.state, location.search]);

  const [phone, setPhone] = useState("+234");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter-phone" | "enter-code">("enter-phone");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);

  // Mount reCAPTCHA one time
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible", // change to 'normal' if you want the widget visible
          callback: () => {
            // auto-called when reCAPTCHA is solved
          },
          "expired-callback": () => {
            // user took too long; they'll solve a new one on next attempt
          },
        }
      );
    }
    // Cleanup on unmount to avoid duplicate widgets
    return () => {
      try {
        window.recaptchaVerifier?.clear();
        window.recaptchaVerifier = null;
      } catch {}
    };
  }, []);

  function formatError(e) {
    const c = e?.code || "";
    if (c === "auth/invalid-phone-number") return "Please enter a valid phone number in international format (e.g. +2348012345678).";
    if (c === "auth/too-many-requests") return "Too many attempts. Please try again later.";
    if (c === "auth/quota-exceeded") return "OTP quota exceeded. Try again later.";
    return e?.message?.replace(/^Firebase:\s*/i, "") || "Something went wrong.";
  }

  async function ensureUserProfile(uid, phoneNumber) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          phone: phoneNumber,
          role: null, // let them choose on /role-selection
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Touch updatedAt
      await setDoc(
        ref,
        { updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }

  const sendCode = async (e) => {
    e.preventDefault();
    setErr("");
    const p = phone.trim();
    if (!p.startsWith("+") || p.length < 8) {
      setErr("Enter phone in international format, e.g. +2348012345678.");
      return;
    }

    try {
      setBusy(true);
      const appVerifier = window.recaptchaVerifier;
      const res = await signInWithPhoneNumber(auth, p, appVerifier);
      setConfirmResult(res);
      setStep("enter-code");
    } catch (e2) {
      setErr(formatError(e2));
      try {
        // Reset recaptcha so the user can try again
        window.recaptchaVerifier?.clear();
        window.recaptchaVerifier = null;
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setErr("");

    if (!confirmResult || !code.trim()) {
      setErr("Enter the 6-digit code sent to your phone.");
      return;
    }

    try {
      setBusy(true);
      const cred = await confirmResult.confirm(code.trim());
      await ensureUserProfile(cred.user.uid, cred.user.phoneNumber || phone.trim());

      // First time users go choose role; we pass where they wanted to go after
      navigate("/role-selection", { replace: true, state: { next: nextPath } });
    } catch (e2) {
      setErr(formatError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="dash-bg"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0f0f, #1a1a1a)",
        display: "grid",
        placeItems: "center",
        padding: "40px 16px",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 28,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(212,175,55,0.35)",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 6, color: "#d4af37" }}>
          {step === "enter-phone" ? "Continue with phone" : "Enter verification code"}
        </h2>
        <p className="muted" style={{ marginTop: 0, color: "#bbb" }}>
          {step === "enter-phone"
            ? "We’ll send a one-time code by SMS."
            : "Check your SMS and enter the 6-digit code."}
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

        {step === "enter-phone" ? (
          <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
                Phone number (E.164)
              </div>
              <input
                type="tel"
                placeholder="+2348012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>

            <button
              className="btn"
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                width: "100%",
                backgroundColor: "#d4af37",
                color: "#000",
                fontWeight: 700,
              }}
            >
              {busy ? "Sending…" : "Send code"}
            </button>

            <p style={{ marginTop: 10, color: "#bbb", fontSize: 14 }}>
              Prefer email? <Link to="/login">Sign in</Link> or{" "}
              <Link to="/signup">Create account</Link>.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6, color: "#ddd", fontSize: 14 }}>
                6-digit code
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                style={{ width: "100%", letterSpacing: 4, textAlign: "center" }}
              />
            </label>

            <button
              className="btn"
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                width: "100%",
                backgroundColor: "#d4af37",
                color: "#000",
                fontWeight: 700,
              }}
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setStep("enter-phone");
                setCode("");
                setConfirmResult(null);
                setErr("");
              }}
            >
              Use a different number
            </button>
          </form>
        )}

        {/* reCAPTCHA mounts into this div (invisible mode) */}
        <div id="recaptcha-container" />
      </div>
    </main>
  );
}
