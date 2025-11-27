// src/routes/guards.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

/* ---------- helpers ---------- */

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_partner") return "partner";
  if (r === "verified_host") return "host";
  if (!r) return "guest";
  return r;
}

function kycOk(status) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "verified" || s === "complete";
}

/* ---------- base hook ---------- */

function useAuthPlus() {
  const { user, loading, profile: ctxProfile } = useAuth();

  // Only hit Firestore if we actually have a user id
  const fetched = useUserProfile(user?.uid);
  const profile = ctxProfile ?? (user ? fetched.profile : null);
  const profileLoading = user ? !!fetched.loading : false;

  return { user, loading: loading || profileLoading, profile };
}

/* ---------- guards ---------- */

// Must be signed in
export function RequireAuth({ children }) {
  const { user, loading } = useAuthPlus();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}

// If signed in already, bounce from login / signup
export function RedirectIfAuthed({ children, to = "/" }) {
  const { user, loading } = useAuthPlus();
  if (loading) return null;
  if (user) return <Navigate to={to} replace />;
  return children;
}

// Must have KYC approved
export function RequireKycApproved({ children }) {
  const { user, loading, profile } = useAuthPlus();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (!kycOk(profile?.kycStatus)) {
    // Always push them into the KYC wizard first
    return <Navigate to="/onboarding/kyc/start" replace />;
  }

  return children;
}

// Must have one of the roles
export function RequireRole({ roles = [], children }) {
  const { user, loading, profile } = useAuthPlus();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";
  const needed = roles.map(normalizeRole);

  if (isAdmin) return children;

  if (!needed.includes(role)) {
    // If they don’t yet have the role, send them into the right onboarding
    if (needed.includes("host")) return <Navigate to="/onboarding/host" replace />;
    if (needed.includes("partner")) return <Navigate to="/onboarding/partner" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

// Admin only
export function RequireAdmin({ children }) {
  const { user, loading, profile } = useAuthPlus();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  return isAdmin ? children : <Navigate to="/" replace />;
}

/**
 * Onboarding gate
 *
 * - If NOT signed in → send to login with `next=/onboarding/<role>`
 * - If wantRole is host/partner and KYC is NOT ok → send to KYC wizard
 * - If user already has that role (or admin) → send to `alreadyHasRoleTo`
 * - Otherwise → render onboarding component children
 */
export function OnboardingGate({ wantRole, alreadyHasRoleTo = "/", children }) {
  const { user, loading, profile } = useAuthPlus();
  const target = normalizeRole(wantRole);

  if (loading) return null;

  // 1. If not logged in → go to login with next
  if (!user) {
    const next = encodeURIComponent(`/onboarding/${target}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  // 2. Already has the role → redirect
  if (isAdmin || role === target) {
    return <Navigate to={alreadyHasRoleTo} replace />;
  }

  // 3. IMPORTANT CHANGE:
  // Allow host/partner application first. Do NOT force KYC yet.
  if (target === "host" || target === "partner") {
    return children; // show application form first
  }

  // 4. Only require KYC for actual KYC route
  if (target === "kyc") {
    return children;
  }

  return children;
}


export default {
  RequireAuth,
  RedirectIfAuthed,
  RequireKycApproved,
  RequireRole,
  RequireAdmin,
  OnboardingGate,
};
