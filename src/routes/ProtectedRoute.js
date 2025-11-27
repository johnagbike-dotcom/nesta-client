// src/routes/ProtectedRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import NotAuthorized from "../pages/NotAuthorized";

export default function ProtectedRoute({
  children,
  allowedRoles,     // e.g. ["admin"] or ["host","partner","admin"]
  requireAuth = true,
  fallback = <NotAuthorized />,
}) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // While we don't yet know auth state
  if (loading) {
    return (
      <div className="container">
        <p className="muted" style={{ marginTop: 24 }}>Checking permission…</p>
      </div>
    );
  }

  // If login is required and we have no user -> send to login
  if (requireAuth && !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // If roles are provided, enforce them
  if (allowedRoles?.length) {
    const role = profile?.role || "guest";
    if (!allowedRoles.includes(role)) {
      return fallback;
    }
  }

  // All good
  return children;
}
