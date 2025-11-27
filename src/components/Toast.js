import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Minimal, dependency-free toast system.
 * Usage:
 *  const toast = useToast();
 *  toast.success("Saved!");
 *  toast.error("Something went wrong");
 *  toast.show({ title: "Heads up", description: "…" , variant: "info", duration: 3500 })
 */

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const show = ({ title, description, variant = "success", duration = 2500 }) => {
    const id = ++idRef.current;
    const t = { id, title, description, variant, duration, createdAt: Date.now() };
    setToasts((prev) => [...prev, t]);
    if (duration > 0) {
      // auto-dismiss
      window.setTimeout(() => remove(id), duration);
    }
    return id;
  };

  const api = useMemo(() => ({
    show,
    success: (msg, opts = {}) => show({ title: msg, variant: "success", ...opts }),
    info:    (msg, opts = {}) => show({ title: msg, variant: "info",    ...opts }),
    warn:    (msg, opts = {}) => show({ title: msg, variant: "warn",    ...opts }),
    error:   (msg, opts = {}) => show({ title: msg, variant: "error",   ...opts }),
    remove,
    clear: () => setToasts([]),
  }), []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastCtx.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};

/* ----------------------------- View / styling ---------------------------- */

function ToastViewport({ toasts, onClose }) {
  // Create a portal target so this works anywhere in the tree
  const rootRef = useRef(null);
  useEffect(() => {
    const n = document.createElement("div");
    n.setAttribute("id", "toast-root");
    document.body.appendChild(n);
    rootRef.current = n;
    return () => document.body.removeChild(n);
  }, []);

  if (!rootRef.current) return null;
  return createPortal(
    <div style={wrapStyle}>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>,
    rootRef.current
  );
}

const wrapStyle = {
  position: "fixed",
  top: 16,
  right: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  zIndex: 9999,
  pointerEvents: "none",
};

function ToastCard({ toast, onClose }) {
  const palette = getPalette(toast.variant);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minWidth: 260,
        maxWidth: 380,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        padding: 12,
        pointerEvents: "auto",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: palette.dot,
            boxShadow: `0 0 12px ${palette.dot}`,
            flex: "0 0 auto",
            marginTop: 2,
          }}
        />
        <div style={{ fontWeight: 800 }}>{toast.title}</div>
        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: palette.fgMuted,
            fontWeight: 800,
            cursor: "pointer",
            borderRadius: 8,
            padding: "4px 6px",
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {toast.description ? (
        <div style={{ fontSize: 13, color: palette.fgMuted, marginTop: 6 }}>{toast.description}</div>
      ) : null}
      {toast.duration > 0 ? (
        <Progress lifeMs={toast.duration} barColor={palette.dot} />
      ) : null}
    </div>
  );
}

function Progress({ lifeMs, barColor }) {
  const [width, setWidth] = useState(100);
  useEffect(() => {
    const started = Date.now();
    let raf;
    const tick = () => {
      const elapsed = Date.now() - started;
      const pct = Math.max(0, 100 - (elapsed / lifeMs) * 100);
      setWidth(pct);
      if (pct > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lifeMs]);

  return (
    <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 999, marginTop: 10 }}>
      <div style={{ width: `${width}%`, height: "100%", background: barColor, borderRadius: 999 }} />
    </div>
  );
}

function getPalette(variant) {
  // Lux palette tuned for your dark theme
  const gold = "#ffcc33";
  const map = {
    success: { bg: "rgba(16,185,129,.18)", border: "rgba(16,185,129,.4)", dot: "#34d399", fg: "#d1fae5", fgMuted: "#a7f3d0" },
    info:    { bg: "rgba(99,102,241,.16)", border: "rgba(99,102,241,.38)", dot: "#818cf8", fg: "#e0e7ff", fgMuted: "#c7d2fe" },
    warn:    { bg: "rgba(245,158,11,.18)", border: "rgba(245,158,11,.45)", dot: gold,   fg: "#fff7e6", fgMuted: "#fde68a" },
    error:   { bg: "rgba(239,68,68,.18)",  border: "rgba(239,68,68,.45)",  dot: "#f87171", fg: "#fee2e2", fgMuted: "#fecaca" },
  };
  return map[variant] || map.success;
}
