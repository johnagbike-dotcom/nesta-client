// src/components/AdminHeader.js
import React from "react";
import { useNavigate } from "react-router-dom";

export default function AdminHeader({
  title,
  subtitle,
  back = false,
  rightActions = null,
}) {
  const navigate = useNavigate();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "4px 0 14px",
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "linear-gradient(180deg, rgba(12,14,20,.55), rgba(12,14,20,.35))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.04), 0 10px 28px rgba(0,0,0,.35)",
      }}
    >
      {back && (
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 12,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(255,255,255,.06)",
            color: "#e5e7eb",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ← Back
        </button>
      )}

      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{title}</h1>
        {subtitle && (
          <div style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
        )}
      </div>

      <div style={{ marginLeft: "auto" }}>{rightActions}</div>
    </header>
  );
} 
