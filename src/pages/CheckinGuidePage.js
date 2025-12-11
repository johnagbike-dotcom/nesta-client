// src/pages/CheckinGuidePage.js
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000/api";

function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (v instanceof Date) return v;
    return new Date(v);
  } catch {
    return null;
  }
}

function fmt(v) {
  const d = toDate(v);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CheckinGuidePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const bookingFromState = state?.booking || null;

  const [data, setData] = useState(bookingFromState);
  const [loading, setLoading] = useState(!bookingFromState);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (bookingFromState) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`${API_BASE}/bookings/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setData(json || null);
      } catch (e) {
        if (alive) setErr("Could not load check-in details.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, bookingFromState]);

  const b = data;

  const hostName =
    b?.hostName ||
    b?.ownerName ||
    b?.partnerName ||
    "Your Nesta host / partner";

  const arrivalWindow =
    b?.checkInWindow ||
    b?.checkInTime ||
    "Standard check-in from 2:00 pm (host can adjust if needed).";

  const instructions =
    b?.checkInInstructions ||
    b?.instructions ||
    "Your exact check-in code and arrival notes will be shared via Nesta chat once your host confirms everything for your stay.";

  const doorCode =
    b?.doorCode || b?.gateCode || b?.pinCode || null;

  const status = String(b?.status || "").toLowerCase();
  const isConfirmed = status === "paid" || status === "confirmed";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#030509] via-[#05070d] to-[#020308] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Loading your check-in guide…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && !b && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Booking not found.
          </div>
        )}

        {!loading && b && (
          <div className="rounded-3xl border border-white/10 bg-[#05070b]/95 p-6 md:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            {/* Top summary */}
            <header className="mb-6">
              <p className="text-xs tracking-[0.25em] uppercase text-amber-300/80">
                Check-in guide
              </p>
              <h1
                className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight"
                style={{
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                {b.listingTitle || b.listing?.title || "Your stay"}
              </h1>
              <p className="text-sm text-gray-300 mt-1">
                {b.listingLocation || b.listing?.location || ""}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Check-in: <span className="font-medium">{fmt(b.checkIn)}</span>{" "}
                • Check-out:{" "}
                <span className="font-medium">{fmt(b.checkOut)}</span>
              </p>
            </header>

            {/* Key blocks */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Host / partner
                </h2>
                <p className="mt-1 text-sm text-white/90">{hostName}</p>
                <p className="mt-1 text-xs text-gray-400">
                  All final details and changes will come through Nesta chat.
                  Personal numbers are kept private by policy.
                </p>
                <button
                  onClick={() =>
                    nav("/bookings", {
                      state: { focus: b.id || id },
                    })
                  }
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/90 text-black text-xs font-semibold hover:bg-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
                >
                  Open booking & chat
                </button>
              </div>

              <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Arrival window
                </h2>
                <p className="mt-1 text-sm text-white/90">
                  {arrivalWindow}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  If you expect to arrive significantly earlier or later, send a
                  quick message in chat so your host can plan support.
                </p>
              </div>
            </section>

            {/* Instructions */}
            <section className="rounded-2xl bg-black/35 border border-white/10 p-4 mb-6">
              <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                How to check in
              </h2>
              <p className="mt-2 text-sm text-gray-100 leading-relaxed">
                {instructions}
              </p>

              {doorCode ? (
                <div className="mt-4 inline-flex flex-col gap-1 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-300/50">
                  <span className="text-[11px] text-emerald-200 uppercase tracking-wide">
                    Access code
                  </span>
                  <span className="text-lg font-mono text-emerald-100">
                    {doorCode}
                  </span>
                  <span className="text-[10px] text-emerald-200/80">
                    Keep this code private. It should only be used by guests on
                    this booking.
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-amber-200/80">
                  Your exact door / gate code will be shared closer to arrival
                  once your host has fully prepared the space. Watch your Nesta
                  chat for a secure message.
                </p>
              )}
            </section>

            {/* Status note */}
            {!isConfirmed && (
              <section className="rounded-2xl bg-amber-500/10 border border-amber-300/50 p-4 mb-4 text-xs text-amber-100">
                This booking is not fully confirmed yet. Some check-in details
                may change until your payment and reservation are marked{" "}
                <span className="font-semibold">confirmed</span>.
              </section>
            )}

            <div className="flex flex-wrap justify-between items-center gap-3">
              <p className="text-[11px] text-gray-500">
                Nesta keeps all addresses, codes, and timing details in one
                place so you don’t have to search emails the night before your
                trip.
              </p>
              <button
                onClick={() => nav("/bookings")}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm hover:bg-white/10"
              >
                Back to my bookings
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
