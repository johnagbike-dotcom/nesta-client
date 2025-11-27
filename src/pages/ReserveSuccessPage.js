// src/pages/ReserveSuccessPage.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ReserveSuccessPage() {
  const nav = useNavigate();
  const { state } = useLocation();
  const bookingId = state?.bookingId || null;
  const listing = state?.listing || null;

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white pt-20 px-4 pb-10">
      <div className="max-w-lg mx-auto rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-emerald-500/10 via-black/10 to-black/40 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-400/40 grid place-items-center mb-5">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Booking confirmed
        </h1>
        <p className="text-gray-200 mt-2">
          Your reservation has been received. A host/partner will review and
          share check-in details.
        </p>

        {listing ? (
          <p className="mt-4 text-sm text-gray-300">
            Listing: <span className="font-semibold">{listing.title}</span>
          </p>
        ) : null}
        {bookingId ? (
          <p className="mt-1 text-xs text-gray-400">
            Ref: <span className="font-mono">{bookingId}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => nav("/bookings")}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            View my bookings
          </button>
          <button
            onClick={() => nav("/explore")}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
          >
            Continue browsing
          </button>
        </div>

        <p className="mt-6 text-[11px] text-gray-500">
          Contact details stay hidden by policy — they reveal only when your
          booking status and host/partner subscription permit.
        </p>
      </div>
    </main>
  );
}
