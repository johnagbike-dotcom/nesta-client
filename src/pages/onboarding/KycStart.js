// src/pages/onboarding/KycStart.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startKycFlow } from "../../api/kycProfile";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";

export default function KycStart() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!user) {
      nav("/login");
      return;
    }

    setSubmitting(true);
    let role = "host";

    try {
      // determine role: profile role first, fallback to localStorage, then host
      const roleFromStorage = localStorage.getItem("nesta_role");
      role = (profile?.role || roleFromStorage || "host").toLowerCase();

      // only host/partner are meaningful here
      if (role !== "partner") role = "host";

      // remember intent for the rest of the onboarding flow
      try {
        localStorage.setItem("nesta_kyc_intent", role);
      } catch {
        // ignore if localStorage not available
      }

      await startKycFlow({
        uid: user.uid,
        role,
        email: user.email || "",
      });
    } catch (e) {
      console.error("Could not start KYC:", e);
      // we still continue so the user isn't blocked
    } finally {
      setSubmitting(false);
    }

    // go to the main KYC application form (step 2)
    nav(`/onboarding/kyc/apply?role=${encodeURIComponent(role)}`);
  }

  return (
    <div
      style={{
        padding: "60px 20px",
        maxWidth: 540,
        margin: "0 auto",
        textAlign: "center",
        color: "#e6e9ef",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        Let's verify your identity
      </h1>
      <p style={{ marginTop: 10, color: "#a9b2c4" }}>
        We'll confirm your identity using your uploaded documents. This keeps
        Nesta a trusted environment where all hosts and verified partners are
        properly checked.
      </p>

      <button
        disabled={submitting}
        onClick={handleSubmit}
        style={{
          marginTop: 22,
          padding: "14px 22px",
          fontSize: 16,
          fontWeight: 800,
          borderRadius: 12,
          background:
            "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
          border: "1px solid rgba(255,210,64,.6)",
          cursor: "pointer",
          opacity: submitting ? 0.6 : 1,
          color: "#1c1709",
        }}
      >
        {submitting ? "Submitting…" : "Proceed to verification"}
      </button>
    </div>
  );
}
