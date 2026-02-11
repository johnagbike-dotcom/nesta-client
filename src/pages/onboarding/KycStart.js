// src/pages/onboarding/KycStart.js
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import {
  createInitialKycProfile,
  loadKycProfile,
  saveKycProfile,
} from "../../api/kycProfile";

function normalizeIntentRole(raw) {
  const r = String(raw || "").toLowerCase();
  return r === "partner" || r === "verified_partner" ? "partner" : "host";
}

export default function KycStart() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!user) {
      nav("/login");
      return;
    }

    setSubmitting(true);

    // ✅ Priority order:
    // 1) URL (?role=host|partner) from homepage CTAs (ONLY if present)
    // 2) profile role
    // 3) localStorage role
    // 4) host
    const rawUrlRole = searchParams.get("role"); // null if absent
    const urlRole = rawUrlRole ? normalizeIntentRole(rawUrlRole) : "";

    const roleFromProfile = normalizeIntentRole(
      profile?.role || profile?.accountType || profile?.type
    );

    let roleFromStorage = "";
    try {
      const rawStored = localStorage.getItem("nesta_role");
      roleFromStorage = rawStored ? normalizeIntentRole(rawStored) : "";
    } catch {
      // ignore
    }

    let role = urlRole || roleFromProfile || roleFromStorage || "host";
    role = normalizeIntentRole(role);

    // remember intent for the rest of the onboarding flow
    try {
      localStorage.setItem("nesta_kyc_intent", role);
    } catch {
      // ignore
    }

    try {
      // Ensure KYC doc exists (so Step 2/3 never "floats" without a record)
      const existing = await loadKycProfile(user.uid);

      if (!existing) {
        // ✅ Create initial stub doc (API expects uid, role)
        await createInitialKycProfile(user.uid, role);

        // ✅ Add email + status in a merge-safe way
        await saveKycProfile(user.uid, {
          email: user.email || "",
          status: "DRAFT",
          role,
          step: 1,
        });
      } else {
        // ✅ Keep role/email aligned (safe merge)
        await saveKycProfile(user.uid, {
          role,
          email: user.email || existing.email || "",
          status: existing.status || "DRAFT",
        });
      }
    } catch (e) {
      console.error("Could not start KYC:", e);
      // continue anyway so user isn't blocked
    } finally {
      setSubmitting(false);
    }

    // ✅ Step 2 (application details)
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
          background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
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
