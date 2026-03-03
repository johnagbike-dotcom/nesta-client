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

function buildNext(loc) {
  return encodeURIComponent((loc?.pathname || "/") + (loc?.search || ""));
}

/* ---------- base hook ---------- */

function useAuthPlus() {
  const { user, loading, profile: ctxProfile } = useAuth();

  // ✅ Your hook takes NO args and listens to auth itself
  const fetched = useUserProfile();

  // Prefer AuthContext profile if present; fallback to fetched
  const profile = ctxProfile ?? (user ? fetched.profile : null);

  // Avoid rendering protected pages while profile is loading
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
    const next = buildNext(loc);
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

// Must have KYC approved (preserve return path)
export function RequireKycApproved({ children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to={`/login?next=${buildNext(loc)}`} replace />;
  }

  if (!kycOk(profile?.kycStatus)) {
    const next = buildNext(loc);
    return <Navigate to={`/onboarding/kyc/start?next=${next}`} replace />;
  }

  return children;
}

// Must have one of the roles (preserve return path)
export function RequireRole({ roles = [], children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to={`/login?next=${buildNext(loc)}`} replace />;
  }

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";
  const needed = roles.map(normalizeRole);

  if (isAdmin) return children;

  if (!needed.includes(role)) {
    const next = buildNext(loc);

    if (needed.includes("host")) return <Navigate to={`/onboarding/host?next=${next}`} replace />;
    if (needed.includes("partner")) return <Navigate to={`/onboarding/partner?next=${next}`} replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

// Admin only
export function RequireAdmin({ children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to={`/login?next=${buildNext(loc)}`} replace />;
  }

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  return isAdmin ? children : <Navigate to="/" replace />;
}

/**
 * Onboarding gate
 *
 * - If NOT signed in → send to login with next
 * - If user already has that role (or admin) → send to alreadyHasRoleTo
 * - Otherwise → render onboarding component
 *
 * NOTE:
 * We allow host/partner application first (no forced KYC here).
 * KYC gating happens at RequireKycApproved for protected routes.
 */
export function OnboardingGate({ wantRole, alreadyHasRoleTo = "/", children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();
  const target = normalizeRole(wantRole);

  if (loading) return null;

  if (!user) {
    const next = encodeURIComponent(`/onboarding/${target}?next=${buildNext(loc)}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  if (isAdmin || role === target) {
    return <Navigate to={alreadyHasRoleTo} replace />;
  }

  return children;
}