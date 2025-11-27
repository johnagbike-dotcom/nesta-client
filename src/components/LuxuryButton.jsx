// src/components/LuxuryButton.jsx
import React from "react";
import clsx from "clsx";

export default function LuxuryButton({
  children,
  tone = "neutral", // primary | warning | danger | neutral
  onClick,
  disabled,
  className,
  type = "button",
}) {
  const tones = {
    primary:
      "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100 border border-emerald-400/40",
    warning:
      "bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 border border-amber-400/40",
    danger:
      "bg-rose-500/10 hover:bg-rose-500/20 text-rose-100 border border-rose-400/40",
    neutral:
      "bg-white/10 hover:bg-white/20 text-white border border-white/15",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </button>
  );
}
