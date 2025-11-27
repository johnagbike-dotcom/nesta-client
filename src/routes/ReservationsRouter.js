// src/routes/ReservationsRouter.jsx
import React from "react";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

// Pages you already have:
import GuestBookings from "../pages/GuestBookings";
import ReservationsPage from "../pages/ReservationsPage"; // host/partner dashboard reservations

export default function ReservationsRouter() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.uid);

  // While we don’t know the role yet, show a lightweight loader (don’t redirect).
  if (!user || loading) {
    return (
      <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">Loading…</div>
      </main>
    );
  }

  const role = (profile?.role || "").toLowerCase();

  // Guests: show their personal bookings.
  if (!role || role === "guest") {
    return <GuestBookings />;
  }

  // Hosts and Verified Partners: show the operational reservations dashboard you already built.
  if (role === "host" || role === "partner" || role === "verified_partner") {
    return <ReservationsPage />;
  }

  // Admins: choose what’s best for you. Default to host/partner view.
  if (role === "admin") {
    return <ReservationsPage />;
  }

  // Fallback: guest view
  return <GuestBookings />;
} 
