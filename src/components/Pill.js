// src/components/Pill.js
import React from "react";

/**
 * Luxury status/role/grade pill
 * tone accepts semantic keys: pending, confirmed, cancelled, refunded,
 * processing, paid, failed, active, inactive, admin, host, partner, guest,
 * planned, shipped, rejected, archived, grade-elite, grade-a, grade-b, grade-unset, slate
 */
const MAP = {
  pending:    { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },
  confirmed:  { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  cancelled:  { bg: "#cf2336", text: "#ffe9ec", ring: "#a51a2a" },
  refunded:   { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
  processing: { bg: "#2563eb", text: "#e8f1ff", ring: "#1e40af" },
  paid:       { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  failed:     { bg: "#cf2336", text: "#ffe9ec", ring: "#a51a2a" },

  active:     { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  inactive:   { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },

  admin:      { bg: "rgba(59,130,246,.18)",  text: "#bfdbfe", ring: "rgba(59,130,246,.35)" },
  host:       { bg: "rgba(16,185,129,.18)",  text: "#a7f3d0", ring: "rgba(16,185,129,.35)" },
  partner:    { bg: "rgba(245,158,11,.18)",  text: "#fde68a", ring: "rgba(245,158,11,.35)" },
  guest:      { bg: "rgba(148,163,184,.18)", text: "#e5e7eb", ring: "rgba(148,163,184,.35)" },

  planned:    { bg: "rgba(59,130,246,.25)",  text: "#bfdbfe", ring: "rgba(59,130,246,.35)" },
  shipped:    { bg: "rgba(16,185,129,.25)",  text: "#a7f3d0", ring: "rgba(16,185,129,.35)" },
  rejected:   { bg: "rgba(239,68,68,.25)",   text: "#fecaca", ring: "rgba(239,68,68,.35)" },
  archived:   { bg: "rgba(148,163,184,.25)", text: "#e2e8f0", ring: "rgba(148,163,184,.35)" },

  "grade-elite": { bg: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)", text: "#1b1608", ring: "rgba(255,210,64,.75)" },
  "grade-a":     { bg: "rgba(34,197,94,.18)",  text: "#bbf7d0", ring: "rgba(34,197,94,.35)" },
  "grade-b":     { bg: "rgba(59,130,246,.18)", text: "#bfdbfe", ring: "rgba(59,130,246,.35)" },
  "grade-unset": { bg: "rgba(148,163,184,.18)",text: "#e5e7eb", ring: "rgba(148,163,184,.35)" },

  slate:      { bg: "rgba(255,255,255,.08)", text: "#e6e9ef", ring: "rgba(255,255,255,.18)" },
};

export default function Pill({ tone = "slate", label, size = "md", upper = false, minWidth, style }) {
  const c = MAP[tone] || MAP.slate;
  const h = size === "sm" ? 28 : size === "lg" ? 38 : 32;
  const fs = size === "sm" ? 12 : size === "lg" ? 13.5 : 12.5;
  const mw = minWidth ?? (size === "sm" ? 74 : 96);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: mw,
        height: h,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 800,
        fontSize: fs,
        textTransform: upper ? "uppercase" : "capitalize",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
        ...style,
      }}
    >
      {label ?? tone}
    </span>
  );
}

/** helper to convert raw values to pill tones */
export function toneFor(kind, value) {
  const v = String(value || "").toLowerCase();
  if (kind === "status") return MAP[v] ? v : "slate";
  if (kind === "role") {
    if (["admin","host","partner","guest"].includes(v)) return v;
    return "slate";
  }
  if (kind === "grade") {
    if (v === "elite") return "grade-elite";
    if (v === "a") return "grade-a";
    if (v === "b") return "grade-b";
    return "grade-unset";
  }
  return "slate";
}
