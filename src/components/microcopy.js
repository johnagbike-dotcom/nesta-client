import React, { useState } from "react";

export function HelpText({ children }) {
  return <p className="text-sm text-white/70 leading-relaxed">{children}</p>;
}

export function WhyToggle({ label = "Why?", children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-amber-200/90 hover:text-amber-200 underline underline-offset-4"
      >
        {label}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          {children}
        </div>
      ) : null}
    </div>
  );
}
