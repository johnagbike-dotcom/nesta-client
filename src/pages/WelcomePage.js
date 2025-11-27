// src/pages/WelcomePage.js
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import WelcomeCard from "../components/WelcomeCard";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "../firebase";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const nextPath = state?.next || "/role-selection";

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Handle Google redirect result quietly
  getRedirectResult(auth).catch(() => {});

  function humanizeFirebaseError(err) {
    const c = err?.code || "";
    if (c === "auth/operation-not-allowed") {
      return "Google sign-in isn’t enabled yet. Enable Google in Firebase Authentication.";
    }
    if (c === "auth/popup-blocked") return "Popup was blocked. Please allow popups or try again.";
    if (c === "auth/network-request-failed") return "Network error. Check your connection.";
    return err?.message || "Something went wrong. Please try again.";
  }

  async function googleOneTap() {
    setError("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate(nextPath, { replace: true });
    } catch (err) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
          return;
        } catch (err2) {
          setError(humanizeFirebaseError(err2));
        }
      } else {
        setError(humanizeFirebaseError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="dash-bg"
      style={{
        background: "linear-gradient(135deg, #0f0f0f, #1a1a1a)",
        minHeight: "100vh",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <div className="container dash-wrap" style={{ paddingTop: 40 }}>
        {/* Top CTA row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <button className="btn ghost" onClick={() => navigate("/browse")}>
            Explore Listings
          </button>
          <button className="btn ghost" onClick={() => navigate("/post-ad")}>
            List a Property
          </button>
        </div>

        <WelcomeCard
          title="Welcome to Nesta"
          subtitle="Nigeria’s premier platform for luxury stays and exclusive verified partners."
        >
          {/* Error banner */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fca5a5",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          {/* 2-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1fr)",
              gap: 24,
            }}
          >
            {/* LEFT: actions */}
            <section
              style={{
                borderRadius: 16,
                padding: 18,
                border: "1px solid rgba(212,175,55,0.25)", // subtle gold
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10, color: "#d4af37" }}>Get Started</h3>

              <button
                type="button"
                className="btn"
                onClick={googleOneTap}
                disabled={busy}
                style={{
                  width: "100%",
                  backgroundColor: "#d4af37",
                  color: "#000",
                  fontWeight: "600",
                }}
              >
                {busy ? "Connecting…" : "Continue with Google"}
              </button>

              <div
                className="muted"
                style={{ textAlign: "center", margin: "12px 0", color: "#aaa" }}
              >
                OR
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <Link
                  className="btn-outline"
                  to="/signup"
                  state={{ next: nextPath }}
                  style={{ textAlign: "center" }}
                >
                  Create account with email
                </Link>

                <Link
                  className="btn-outline"
                  to="/login"
                  state={{ next: nextPath }}
                  style={{ textAlign: "center" }}
                >
                  Sign in with email
                </Link>

                <Link
                  className="btn-outline"
                  to="/phone-signin"
                  style={{ textAlign: "center" }}
                >
                  Use phone instead
                </Link>
              </div>
            </section>

            {/* RIGHT: perks */}
            <section
              style={{
                borderRadius: 16,
                padding: 18,
                border: "1px solid rgba(212,175,55,0.25)",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10, color: "#d4af37" }}>
                Why Join Nesta?
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Access verified luxury listings across Nigeria.</li>
                <li>Exclusive in-app chat with trusted hosts & partners.</li>
                <li>Seamless booking experience with premium support.</li>
                <li>Earn visibility with optional featured placements.</li>
              </ul>

              <div
                className="muted"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  borderTop: "1px dashed rgba(255,255,255,0.15)",
                  paddingTop: 10,
                  color: "#999",
                }}
              >
                By continuing, you agree to our{" "}
                <Link to="/terms">Terms</Link> and{" "}
                <Link to="/privacy">Privacy Policy</Link>.
              </div>
            </section>
          </div>
        </WelcomeCard>
      </div>
    </main>
  );
}
