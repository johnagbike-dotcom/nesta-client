// src/components/RequireVerified.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireVerified({ children }) {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null; // or spinner

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  if (profile?.kyc?.status !== "verified" && profile?.role !== "admin") {
    return <Navigate to="/verify/start" state={{ from: loc }} replace />;
  }

  return children;
} 
