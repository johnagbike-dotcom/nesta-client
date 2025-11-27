// src/pages/onboarding/KycRetry.js
import React from "react";
import { Link } from "react-router-dom";

export default function KycRetry() {
  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        color: "#e6e9ef",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: 30, fontWeight: 900, color: "#ffb31e" }}>
        Verification not approved
      </h1>

      <p style={{ maxWidth: 500, margin: "12px auto 0", color: "#a9b2c4", lineHeight: 1.6 }}>
        Your previous submission could not be verified. This may be due to unclear
        identification, mismatched details, or document quality issues.
      </p>

      <p style={{ maxWidth: 500, margin: "10px auto 0", color: "#cfd6e4" }}>
        Please review your documents and try again to continue your onboarding.
      </p>

      <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center" }}>
        <Link
          to="/onboarding/kyc"
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 15,
            background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
            color: "#1c1709",
            border: "1px solid rgba(255,210,64,.6)",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Resubmit KYC
        </Link>

        <Link
          to="/"
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 15,
            background: "rgba(255,255,255,.08)",
            color: "#e6e9ef",
            border: "1px solid rgba(255,255,255,.18)",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
