import React from "react";

export default function Button({
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
  title,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold " +
    "transition-all duration-200 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 " +
    "shadow-[0_18px_60px_rgba(0,0,0,0.45)]";

  const enabled =
    "text-black bg-gradient-to-b from-[#ffd74a] to-[#ffad0c] " +
    "hover:from-[#ffe27a] hover:to-[#ffb730] " +
    "active:translate-y-[1px] active:shadow-[0_10px_30px_rgba(0,0,0,0.45)]";

  const disabledCls =
    "text-white/45 bg-white/10 border border-white/10 cursor-not-allowed shadow-none";

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${disabled ? disabledCls : enabled} ${className}`}
    >
      {children}
    </button>
  );
}