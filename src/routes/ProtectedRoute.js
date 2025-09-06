// src/routes/ProtectedRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
* Protects a route.
*
* Props:
*  - children: ReactNode (the page to render if allowed)
*  - requireVerified?: boolean (if true, user must have verified email)
*  - allowRoles?: string[] (e.g. ["host","partner","guest"])
*
* Behavior:
*  - While auth is loading, shows a lightweight placeholder (to avoid flashing /login).
*  - If no user -> redirects to /login and preserves "from" location.
*  - If allowRoles is set and user's role is missing or not allowed -> /role-selection.
*  - If requireVerified and email not verified -> /action-helper?reason=verify
*/
export default function ProtectedRoute({
  children,
  requireVerified = false,
  allowRoles,
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // 1) Still figuring out who the user is — avoid redirect loops
  if (loading) {
    return (
      <main className="min-h-[40vh] grid place-items-center text-white/80">
        <span>Checking access…</span>
      </main>
    );
  }

  // 2) Not signed in
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3) Role gating (when specified)
  if (Array.isArray(allowRoles)) {
    // role can still be null right after first login; send them to pick one
    if (!role || !allowRoles.includes(role)) {
      return <Navigate to="/role-selection" replace state={{ from: location }} />;
    }
  }

  // 4) Email verification gating (optional)
  if (requireVerified && user.providerData.some(p => p.providerId === "password")) {
    // For password provider, ensure emailVerified is true
    if (!user.emailVerified) {
      // Send user to your generic action helper / info page (you can change this)
      return (
        <Navigate
          to="/action"
          replace
          state={{
            reason: "verify",
            msg: "Please verify your email to continue.",
            from: location,
          }}
        />
      );
    }
  }

  // 5) All good
  return children;
}