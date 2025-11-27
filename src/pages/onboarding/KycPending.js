// src/pages/onboarding/KycPending.js
import React from "react";
import { Link } from "react-router-dom";

export default function KycPending() {
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
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Your verification is under review</h1>

      <p style={{ maxWidth: 500, margin: "12px auto 0", color: "#a9b2c4", lineHeight: 1.6 }}>
        Our team is currently reviewing your KYC submission to ensure compliance and authenticity.
        This usually takes a short time. You’ll be notified once approved.
      </p>

      <div style={{ marginTop: 24 }}>
        <Link
          to="/"
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 15,
            background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
            color: "#1c1709",
            border: "1px solid rgba(255,210,64,.6)",
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          Return to home
        </Link>
      </div>
    </div>
  );
}
