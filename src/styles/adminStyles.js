// src/styles/adminStyles.js
// Small class helpers so all admin pages use the same luxury buttons & chips.

export const cx = (...list) => list.filter(Boolean).join(" ");

export const btn = {
  base:
    "btn-lux text-[14px] leading-none",   // from lux.css
  sm: "btn-sm",
  lg: "btn-lg",

  // color variants (match lux.css gradients)
  sapphire: "btn-sapphire",
  emerald: "btn-emerald",
  ruby: "btn-ruby",
  amber: "btn-amber",
  ghost: "btn-ghost",
};

export const pill = {
  base: "pill",
  sapphire: "pill sapphire",
  emerald: "pill emerald",
  ruby: "pill ruby",
  amber: "pill amber",
};

export const panel = "lux-panel";
export const h1 = "lux-h1";
export const sub = "lux-sub";
export const toolbar = "lux-toolbar";
export const input = "lux-input";
export const table = "lux-table"; 