// src/routes/ReservationsSwitch.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import GuestBookings from "../pages/GuestBookings";
// If/when you have dedicated screens, import them here:
// import PartnerReservations from "../pages/PartnerReservations";
// import HostReservations from "../pages/HostReservations";

export default function ReservationsSwitch() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const role = (profile?.role || "").toLowerCase();

  if (!user) return <Navigate to="/login" replace />;

  if (!role || role === "guest") {
    return <GuestBookings />;
  }

  // For now, send partners/hosts to their dashboards.
  if (role === "partner" || role === "verified_partner") {
    return <Navigate to="/partner" replace />;
    // return <PartnerReservations />; // when ready
  }

  if (role === "host") {
    return <Navigate to="/host" replace />;
    // return <HostReservations />; // when ready
  }

  // Admins don’t use this page
  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // Fallback: treat as guest
  return <GuestBookings />;
} 