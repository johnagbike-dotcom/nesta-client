import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(
    (message, type = "info", duration = 2800) => {
      const id = `${Date.now()}_${Math.random()}`;

      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Luxury Toast Stack */}
      <div className="fixed bottom-6 right-6 space-y-3 z-[999] w-[min(92vw,360px)]">
        {toasts.map((t) => {
          let tone =
            "bg-[#0f1419]/95 border-white/10 text-white/90";

          if (t.type === "success") {
            tone =
              "bg-emerald-600/15 border-emerald-400/40 text-emerald-100";
          } else if (t.type === "error") {
            tone =
              "bg-rose-600/15 border-rose-400/40 text-rose-100";
          } else if (t.type === "warning") {
            tone =
              "bg-amber-600/15 border-amber-400/40 text-amber-100";
          }

          return (
            <div
              key={t.id}
              className={`animate-[fadeSlideIn_0.25s_ease-out] backdrop-blur-md px-4 py-3 rounded-2xl border shadow-[0_20px_70px_rgba(0,0,0,0.55)] text-sm font-medium ${tone}`}
            >
              {t.message}
            </div>
          );
        })}
      </div>

      {/* Inline keyframes (no global CSS required) */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext); // returns { showToast }
}