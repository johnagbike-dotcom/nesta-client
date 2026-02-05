// src/components/DescriptionClamp.js
import React, { useState } from "react";

/**
 * Luxury text clamp
 * - Prevents long text sprawl
 * - Used across Guest / Host / Admin
 *
 * Props:
 * - text (string)
 * - lines (number) default = 2
 * - expandable (boolean) default = true
 */
export default function DescriptionClamp({
  text = "",
  lines = 2,
  expandable = true,
}) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  const shouldClamp = expandable && !open;

  return (
    <div className="text-sm text-white/80 leading-relaxed">
      <div
        className={`${
          shouldClamp ? `line-clamp-${lines}` : ""
        } whitespace-pre-wrap`}
      >
        {text}
      </div>

      {expandable && text.length > 140 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-amber-300 hover:text-amber-200 underline decoration-dotted"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
