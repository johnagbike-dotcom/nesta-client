// src/pages/Dashboard.js
import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
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
          maxWidth: 820,
          padding: 24,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(212,175,55,0.35)",
          backdropFilter: "blur(8px)",
        }}
      >
        <h2 style={{ margin: 0, color: "#d4af37" }}>Dashboard (SAFE)</h2>
        <p className="muted" style={{ marginTop: 6, color: "#bbb" }}>
          If you can see this, the <code>/dashboard</code> route is rendering correctly.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginTop: 16,
          }}
        >
          <Tile title="Open Guest Dashboard" to="/dashboard/guest" />
          <Tile title="Open Host Dashboard" to="/dashboard/host" />
          <Tile title="Open Verified Partner Dashboard" to="/dashboard/partner" />
          <Tile title="Open Admin Dashboard" to="/dashboard/admin" />
        </div>

        <p style={{ marginTop: 16, color: "#bbb" }}>
          After this is stable, we’ll re-introduce the smart dashboard (role-aware)
          — but this SAFE version guarantees no blank page while we iterate.
        </p>
      </div>
    </main>
  );
}

function Tile({ title, to }) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: "block",
        padding: 16,
        borderRadius: 12,
        textDecoration: "none",
        color: "white",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6, color: "#bbb" }}>
        Route: <code>{to}</code>
      </div>
    </Link>
  );
}
