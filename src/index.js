// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./context/ToastContext"; // <-- add this
import "./index.css";
import "./styles/lux.css";
import "./styles/polish.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);