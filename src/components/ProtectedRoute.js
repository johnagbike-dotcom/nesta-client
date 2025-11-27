// src/components/ProtectedRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Guards a route.
 * - Shows a small "checking" message while Firebase boots (no blank screen).
 * - Redirects unauthenticated users to /login and preserves the intended URL in state.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth(); // your AuthContext should expose these
  const location = useLocation();

  // While Firebase restores the session, render something visible
  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontFamily: "'Playfair Display', serif",
        }}
      >
        Checking your session…
      </div>
    );
  }

  // Not signed in → go to login, keep where the user wanted to go
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ next: location.pathname + location.search }}
      />
    );
  }

  // Signed in → render the protected content
  return children;
}
