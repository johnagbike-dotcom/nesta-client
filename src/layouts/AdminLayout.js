// src/layouts/AdminLayout.js
import React from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLayout({ title, subtitle, right, children }) {
  const nav = useNavigate();

  return (
    <main
      className="min-h-screen text-white"
      style={{
        paddingTop: "calc(var(--topbar-h, 88px) + 18px)",
        paddingBottom: 36,
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Header card */}
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,.06)",
            background:
              "radial-gradient(circle at top, rgba(255,255,255,.05), rgba(255,255,255,.02) 55%, rgba(0,0,0,.10))",
            boxShadow: "0 18px 60px rgba(0,0,0,.35)",
            padding: "18px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => nav(-1)}
              style={{
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.10)",
                color: "#e5e7eb",
                padding: "8px 14px",
                borderRadius: 14,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              ← Back
            </button>

            <div>
              <div style={{ fontSize: 34, fontWeight: 950, lineHeight: 1.05 }}>
                {title}
              </div>
              {subtitle ? (
                <div style={{ color: "rgba(226,232,240,.65)", marginTop: 6 }}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          {right ? <div>{right}</div> : null}
        </div>

        {children}
      </div>
    </main>
  );
}
