// src/pages/ReserveFailedPage.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ReserveFailedPage() {
  const nav = useNavigate();
  const { state } = useLocation();
  const bookingId = state?.bookingId || null;
  const listing = state?.listing || null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 pb-16">
      <div className="max-w-lg mx-auto rounded-3xl border border-red-400/30 bg-gradient-to-b from-red-500/10 via-black/30 to-black/70 p-8 text-center shadow-[0_35px_100px_rgba(0,0,0,0.65)] backdrop-blur-md">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/15 border border-red-400/50 grid place-items-center mb-6 shadow-[0_10px_35px_rgba(185,28,28,0.4)]">
          <span className="text-3xl font-bold text-red-300">!</span>
        </div>

        {/* Heading */}
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight"
          style={{
            fontFamily:
              'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
          }}
        >
          Payment not completed
        </h1>

        <p className="text-gray-300 mt-3 text-sm leading-relaxed">
          Your payment window was closed or not completed.  
          No confirmed booking was created and the host has not been notified.
        </p>

        {listing ? (
          <p className="mt-5 text-sm text-gray-200">
            Listing:{" "}
            <span className="font-semibold text-amber-300">
              {listing.title}
            </span>
          </p>
        ) : null}

        {bookingId ? (
          <p className="mt-1 text-xs text-gray-400">
            Reference:{" "}
            <span className="font-mono text-red-200">{bookingId}</span>
          </p>
        ) : null}

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          {listing?.id && (
            <button
              onClick={() => nav(`/listing/${listing.id}`)}
              className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-sm"
            >
              Back to listing
            </button>
          )}
          <button
            onClick={() => nav("/explore")}
            className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs md:text-sm"
          >
            Browse other stays
          </button>
        </div>

        <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
          If you believe you were charged, you can check your bookings and
          payment history inside Nesta or with your bank provider.
        </p>
      </div>
    </main>
  );
}
