// src/components/StarRating.js
import React, { useMemo } from "react";

/**
 * Luxury-safe star rating component.
 *
 * Props:
 * - value: number (0..5)
 * - onChange: (nextValue:number)=>void (optional)
 * - readOnly: boolean
 * - size: number (px)
 * - showValue: boolean (shows "4.7" next to stars)
 */
export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = 16,
  showValue = false,
}) {
  const v = useMemo(() => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(5, n));
  }, [value]);

  const rounded = useMemo(() => Math.round(v * 10) / 10, [v]);

  const stars = useMemo(() => {
    // We render full/half/empty simply for display.
    const full = Math.floor(v);
    const frac = v - full;
    const half = frac >= 0.5 ? 1 : 0;

    return Array.from({ length: 5 }).map((_, i) => {
      if (i < full) return "★";
      if (i === full && half) return "⯪"; // subtle half mark
      return "☆";
    });
  }, [v]);

  const clickable = !readOnly && typeof onChange === "function";

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const starIndex = i + 1;
          const isActive = starIndex <= Math.round(v);

          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onChange(starIndex)}
              aria-label={`${starIndex} star${starIndex === 1 ? "" : "s"}`}
              className={`leading-none ${
                clickable ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                fontSize: size,
                padding: "2px 2px",
                opacity: clickable ? 1 : 0.95,
                color: isActive ? "rgb(252 211 77)" : "rgba(226,232,240,.55)", // amber-ish
                background: "transparent",
                border: "none",
              }}
            >
              {stars[i]}
            </button>
          );
        })}
      </div>

      {showValue ? (
        <span className="text-xs text-white/70" style={{ minWidth: 32 }}>
          {rounded.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
