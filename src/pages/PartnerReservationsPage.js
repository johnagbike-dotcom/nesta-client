// src/pages/PartnerReservationsPage.js
import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HostReservationsPage from "./HostReservationsPage";
import { useAuth } from "../auth/AuthContext";

export default function PartnerReservationsPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const focus = useMemo(() => {
    // expected: "date_changes" | "cancellations" | "all"
    const f = location.state?.focus;
    return typeof f === "string" ? f : "all";
  }, [location.state]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] tracking-[0.25em] uppercase text-white/50">
              Partner
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Partner reservations
            </h1>
            <div className="mt-1 text-sm text-white/60">
              Manage confirmed bookings, date changes, cancellations, and guest ops.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => nav(-1)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
            >
              ← Back
            </button>

            <button
              onClick={() => nav("/partner")}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
            >
              Back to dashboard
            </button>
          </div>
        </div>

        {/* Actual reservations UI */}
        <HostReservationsPage
          ownerField="partnerUid"
          ownerUid={user.uid}
          pageTitle="Partner reservations"
          focus={focus}
        />
      </div>
    </main>
  );
}
