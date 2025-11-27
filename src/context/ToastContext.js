import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 2500) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Simple toast UI */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "px-4 py-2 rounded-lg shadow-md border text-sm " +
              (t.type === "success"
                ? "bg-green-600/90 border-green-400 text-white"
                : t.type === "error"
                ? "bg-red-600/90 border-red-400 text-white"
                : "bg-gray-800/90 border-gray-600 text-gray-100")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext); // returns { showToast }
} 
