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
  const { state } = useLocation(); // could contain { next: "/somewhere" }
  const nextPath = state?.next || "/role-selection";

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // If we arrive here after a redirect-based Google flow, just swallow any result errors
  getRedirectResult(auth).catch(() => {});

  function humanizeFirebaseError(err) {
    const c = err?.code || "";
    if (c === "auth/operation-not-allowed") {
      return "Google sign-in isn’t enabled yet. In Firebase → Authentication → Sign-in method, enable Google and set a Support email.";
    }
    if (c === "auth/popup-blocked") return "Popup was blocked. Please allow popups or try again.";
    if (c === "auth/network-request-failed") return "Network error. Check your connection and try again.";
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
    <main className="dash-bg">
      <div className="container dash-wrap">
        {/* Top CTA row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => navigate("/browse")}>Explore listings</button>
          <button className="btn ghost" onClick={() => navigate("/post-ad")}>Post ad</button>
        </div>

        <WelcomeCard
          title="Welcome to Nesta"
          subtitle="Premium stays, trusted hosts and agents, and a safe in-app chat. Join to unlock more."
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

          {/* 2-column layout: Left = CTAs, Right = perks */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1fr)",
              gap: 24,
            }}
          >
            {/* LEFT: primary actions */}
            <section
              style={{
                borderRadius: 14,
                padding: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(6px)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Get started</h3>

              <button
                type="button"
                className="btn"
                onClick={googleOneTap}
                disabled={busy}
                style={{ width: "100%" }}
              >
                {busy ? "Connecting…" : "Continue with Google"}
              </button>

              <div className="muted" style={{ textAlign: "center", margin: "12px 0" }}>
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

            {/* RIGHT: perks/benefits */}
            <section
              style={{
                borderRadius: 14,
                padding: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(6px)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Why join Nesta?</h3>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Message hosts & agents safely in-app.</li>
                <li>Verified listings with premium presentation.</li>
                <li>Contact details unlocked after booking (hosts) or with subscription (agents).</li>
                <li>Optional featured placement for extra visibility.</li>
              </ul>

              <div
                className="muted"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  borderTop: "1px dashed rgba(255,255,255,0.15)",
                  paddingTop: 10,
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