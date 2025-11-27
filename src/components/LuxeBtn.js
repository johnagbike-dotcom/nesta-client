// src/components/LuxeBtn.js
import React from "react";

/**
 * LuxeBtn — elevated pill button with luxe tones and gentle glow.
 *
 * Props (backwards compatible):
 * - kind:  "gold" | "emerald" | "ruby" | "slate" | "sky" | "amber" | "cobalt" | "violet"
 * - small: boolean  (legacy) -> maps to size="sm"
 * - size:  "xs" | "sm" | "md" | "lg"  (default: "md")
 * - block: boolean (full width)
 * - disabled: boolean
 * - loading: boolean (optional spinner + disabled)
 * - onClick, title, children
 */
const PALETTE = {
  gold: {
    bg: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
    hover: "linear-gradient(180deg,#ffe063,#ffc233 60%,#ffb21c)",
    text: "#1b1608",
    ring: "rgba(255,210,64,.75)",
    glow: "0 12px 26px rgba(250,204,21,.22)",
  },
  emerald: {
    bg: "linear-gradient(180deg,#34d399,#10b981)",
    hover: "linear-gradient(180deg,#5fe1b4,#10c395)",
    text: "#052e1c",
    ring: "rgba(16,185,129,.55)",
    glow: "0 12px 26px rgba(16,185,129,.22)",
  },
  ruby: {
    bg: "linear-gradient(180deg,#f87171,#dc2626)",
    hover: "linear-gradient(180deg,#ffa0a0,#e23a3a)",
    text: "#2b0b0b",
    ring: "rgba(239,68,68,.55)",
    glow: "0 12px 26px rgba(239,68,68,.22)",
  },
  slate: {
    bg: "linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.06))",
    hover: "linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.10))",
    text: "#e6e9ef",
    ring: "rgba(255,255,255,.18)",
    glow: "0 10px 22px rgba(0,0,0,.28)",
  },
  sky: {
    bg: "linear-gradient(180deg,#38bdf8,#0ea5e9)",
    hover: "linear-gradient(180deg,#63cdfa,#22b0ee)",
    text: "#052130",
    ring: "rgba(56,189,248,.55)",
    glow: "0 12px 26px rgba(56,189,248,.20)",
  },
  amber: {
    bg: "linear-gradient(180deg,#fbbf24,#f59e0b)",
    hover: "linear-gradient(180deg,#ffcd4d,#ffa320)",
    text: "#1f1405",
    ring: "rgba(245,158,11,.55)",
    glow: "0 12px 26px rgba(245,158,11,.22)",
  },
  cobalt: {
    bg: "linear-gradient(180deg,#6366f1,#4338ca)",
    hover: "linear-gradient(180deg,#7b7ef5,#4c43d8)",
    text: "#eef2ff",
    ring: "rgba(99,102,241,.55)",
    glow: "0 12px 26px rgba(99,102,241,.22)",
  },
  violet: {
    bg: "linear-gradient(180deg,#a78bfa,#8b5cf6)",
    hover: "linear-gradient(180deg,#b89cfe,#9666ff)",
    text: "#f5f3ff",
    ring: "rgba(139,92,246,.55)",
    glow: "0 12px 26px rgba(139,92,246,.22)",
  },
};

const SIZES = {
  xs: { pad: "6px 10px", fz: 11, radius: 999 },
  sm: { pad: "8px 12px", fz: 12, radius: 999 },
  md: { pad: "10px 16px", fz: 13, radius: 999 },
  lg: { pad: "12px 18px", fz: 15, radius: 999 },
};

function Spinner({ color = "currentColor" }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        marginRight: 8,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        animation: "luxspin .75s linear infinite",
        verticalAlign: "-2px",
      }}
    />
  );
}

// keyframes (scoped via inline <style>)
const spinnerStyle = (
  <style>
    {`@keyframes luxspin{to{transform:rotate(360deg)}}`}
  </style>
);

export default function LuxeBtn(props) {
  const {
    kind = "slate",
    small = false,       // legacy flag
    size: sizeProp,      // "xs" | "sm" | "md" | "lg"
    block = false,
    disabled = false,
    loading = false,
    onClick,
    children,
    title,
    style,
  } = props;

  const tone = PALETTE[kind] || PALETTE.slate;
  const sizeKey = sizeProp || (small ? "sm" : "md");
  const sz = SIZES[sizeKey] || SIZES.md;

  const isDisabled = disabled || loading;

  return (
    <>
      {spinnerStyle}
      <button
        type="button"
        title={title}
        onClick={isDisabled ? undefined : onClick}
        disabled={isDisabled}
        style={{
          display: block ? "block" : "inline-block",
          width: block ? "100%" : "auto",
          borderRadius: sz.radius,
          padding: sz.pad,
          fontWeight: 900,
          fontSize: sz.fz,
          letterSpacing: 0.2,
          background: tone.bg,
          color: tone.text,
          border: `1px solid ${tone.ring}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,.06), ${tone.glow}`,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.65 : 1,
          transition: "filter .18s ease, transform .06s ease, box-shadow .18s ease, background .18s ease",
          whiteSpace: "nowrap",
          outline: "none",
          ...style,
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        onMouseEnter={(e) => {
          if (isDisabled) return;
          e.currentTarget.style.filter = "brightness(1.04)";
          e.currentTarget.style.background = tone.hover;
          e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.06), ${tone.glow}, 0 2px 0 rgba(255,255,255,.1) inset`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
          e.currentTarget.style.background = tone.bg;
          e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.06), ${tone.glow}`;
        }}
        onFocus={(e) => {
          if (isDisabled) return;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${tone.ring}, inset 0 0 0 1px rgba(255,255,255,.06), ${tone.glow}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.06), ${tone.glow}`;
        }}
      >
        {loading && <Spinner color={tone.text} />}
        {children}
      </button>
    </>
  );
}
