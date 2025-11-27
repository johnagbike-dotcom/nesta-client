// src/components/VerifiedRoleBadge.jsx
import React from "react";

export default function VerifiedRoleBadge({ role, verified }) {
  if (!role) return null;

  const label = verified ? `${role} • Verified` : `${role} • KYC pending`;

  const styles = verified
    ? {
        bg: "rgba(16,185,129,.10)",
        bd: "rgba(16,185,129,.35)",
        dot: "#34d399",
        fg: "#d1fae5",
      }
    : {
        bg: "rgba(245,158,11,.10)",
        bd: "rgba(245,158,11,.35)",
        dot: "#fbbf24",
        fg: "#ffe8b5",
      };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${styles.bd}`,
        background: styles.bg,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
        color: styles.fg,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "999px",
          background: styles.dot,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
