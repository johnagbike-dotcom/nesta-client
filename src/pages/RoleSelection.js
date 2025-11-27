// src/pages/RoleSelection.js
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";

export default function RoleSelection() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { state } = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.exists() ? snap.data()?.role : null;
      if (role) {
        navigate(state?.next || "/dashboard", { replace: true });
      }
    })();
  }, [user]); // eslint-disable-line

  const choose = async (picked) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const base = {
        email: user.email,
        updatedAt: serverTimestamp(),
      };
      const extra =
        picked === "partner"
          ? { role: "partner", partnerStatus: "pending" }
          : { role: "guest" };

      await setDoc(
        doc(db, "users", user.uid),
        { ...base, ...extra },
        { merge: true }
      );

      navigate(state?.next || "/dashboard", { replace: true });
    } catch (e) {
      setError(
        e?.message?.replace("Firebase:", "").trim() || "Failed to save role."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap" style={{ paddingBottom: 60 }}>
          <div
            className="card"
            style={{ marginTop: 24, padding: 26, borderRadius: 16 }}
          >
            <h1>Please sign in</h1>
            <p className="muted">You need an account before choosing a role.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="dash-bg"
      style={{
        background: "linear-gradient(135deg, #0f0f0f, #1c1c1c)",
        minHeight: "100vh",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <div className="container dash-wrap" style={{ paddingBottom: 60 }}>
        <div
          className="card"
          style={{
            marginTop: 40,
            padding: 32,
            borderRadius: 18,
            border: "1px solid rgba(212,175,55,0.35)", // gold tint
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(8px)",
            maxWidth: 720,
            marginInline: "auto",
          }}
        >
          <h1 style={{ margin: "0 0 8px", color: "#d4af37" }}>
            Choose Your Role
          </h1>
          <p className="muted" style={{ marginTop: 0, color: "#bbb" }}>
            Select how you want to experience Nesta.  
            <br />
            (You can always request support to switch later.)
          </p>

          {error && (
            <div
              className="text-sm rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2"
              style={{ marginTop: 12 }}
            >
              {error}
            </div>
          )}

          <div
            className="grid"
            style={{
              gap: 20,
              marginTop: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {/* Guest Card */}
            <div
              className="card"
              style={{
                padding: 22,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))",
              }}
            >
              <h2
                style={{
                  fontSize: "1.5rem",
                  marginBottom: 8,
                  color: "#fff",
                }}
              >
                Guest
              </h2>
              <p className="muted" style={{ marginTop: 6, color: "#aaa" }}>
                Discover and book verified luxury stays with seamless checkout.
              </p>
              <button
                className="btn"
                style={{
                  marginTop: 14,
                  width: "100%",
                  backgroundColor: "#d4af37",
                  color: "#000",
                  fontWeight: "600",
                }}
                onClick={() => choose("guest")}
                disabled={busy}
              >
                {busy ? "Saving…" : "Continue as Guest"}
              </button>
            </div>

            {/* Verified Partner Card */}
            <div
              className="card"
              style={{
                padding: 22,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))",
              }}
            >
              <h2
                style={{
                  fontSize: "1.5rem",
                  marginBottom: 8,
                  color: "#fff",
                }}
              >
                Verified Partner
              </h2>
              <p className="muted" style={{ marginTop: 6, color: "#aaa" }}>
                Upload listings, manage properties, and earn commissions.  
                Your status will begin as <strong>pending</strong> until our team verifies you.
              </p>
              <button
                className="btn"
                style={{
                  marginTop: 14,
                  width: "100%",
                  backgroundColor: "#d4af37",
                  color: "#000",
                  fontWeight: "600",
                }}
                onClick={() => choose("partner")}
                disabled={busy}
              >
                {busy ? "Saving…" : "Continue as Partner"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
