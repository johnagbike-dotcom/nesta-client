// src/routes/guards.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

/* ---------- helpers ---------- */

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();

  if (r === "verified_partner") return "partner";
  if (r === "verified_host") return "host";
  if (!r) return "guest";

  return r;
}

function kycOk(status) {
  const s = String(status || "").toLowerCase().trim();
  return s === "approved" || s === "verified" || s === "complete";
}

function buildNext(loc) {
  return encodeURIComponent((loc?.pathname || "/") + (loc?.search || ""));
}

function safeSetIntent(intent) {
  try {
    if (intent === "host" || intent === "partner") {
      localStorage.setItem("nesta_kyc_intent", intent);
    }
  } catch {
    // ignore storage issues
  }
}

function inferIntentFromPath(pathname = "") {
  const p = String(pathname || "").toLowerCase();

  if (
    p.startsWith("/partner") ||
    p.includes("/partner-") ||
    p.includes("/onboarding/partner")
  ) {
    return "partner";
  }

  if (
    p.startsWith("/host") ||
    p.includes("/host-") ||
    p.includes("/onboarding/host")
  ) {
    return "host";
  }

  return null;
}

/* ---------- base hook ---------- */

function useAuthPlus() {
  const { user, loading, profile: ctxProfile } = useAuth();

  // ✅ hook takes no args
  const fetched = useUserProfile();

  // Prefer AuthContext profile if present; fallback to fetched
  const profile = ctxProfile ?? (user ? fetched.profile : null);

  // Hold protected rendering until profile is ready
  const profileLoading = user ? !!fetched.loading : false;

  return {
    user,
    loading: loading || profileLoading,
    profile,
  };
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

// Must have KYC approved
export function RequireKycApproved({ children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to={`/login?next=${buildNext(loc)}`} replace />;
  }

  if (!kycOk(profile?.kycStatus)) {
    const next = buildNext(loc);

    // infer host/partner intent from the page user is trying to open
    const intent = inferIntentFromPath(loc?.pathname || "");
    if (intent) safeSetIntent(intent);

    const qs = new URLSearchParams();
    qs.set("next", next);
    if (intent) qs.set("intent", intent);

    return <Navigate to={`/onboarding/kyc/start?${qs.toString()}`} replace />;
  }

  return children;
}

// Must have one of the roles
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

    if (needed.includes("host")) {
      safeSetIntent("host");
      return <Navigate to={`/onboarding/host?next=${next}`} replace />;
    }

    if (needed.includes("partner")) {
      safeSetIntent("partner");
      return <Navigate to={`/onboarding/partner?next=${next}`} replace />;
    }

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
 */
export function OnboardingGate({ wantRole, alreadyHasRoleTo = "/", children }) {
  const { user, loading, profile } = useAuthPlus();
  const loc = useLocation();
  const target = normalizeRole(wantRole);

  if (loading) return null;

  if (!user) {
    safeSetIntent(target);

    const next = encodeURIComponent(`/onboarding/${target}?next=${buildNext(loc)}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  if (isAdmin || role === target) {
    return <Navigate to={alreadyHasRoleTo} replace />;
  }

  safeSetIntent(target);
  return children;
}