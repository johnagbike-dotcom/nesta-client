// src/pages/BookingReceiptPage.js
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000/api";

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

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

function fmt(v, withTime = false) {
  const d = toDate(v);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return withTime
    ? d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function BookingReceiptPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const bookingFromState = state?.booking || null;

  const [data, setData] = useState(bookingFromState);
  const [loading, setLoading] = useState(!bookingFromState);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (bookingFromState) return; // already hydrated
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
        if (alive) setErr("Could not load this receipt.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, bookingFromState]);

  const booking = data;

  const nights = useMemo(() => {
    if (!booking) return 0;
    const inD = toDate(booking.checkIn);
    const outD = toDate(booking.checkOut);
    if (!inD || !outD) return 0;
    const diff = Math.ceil((outD - inD) / 86400000);
    return Math.max(diff, 0);
  }, [booking]);

  const statusLabel = useMemo(() => {
    const s = String(booking?.status || "").toLowerCase();
    switch (s) {
      case "paid":
      case "confirmed":
        return "Paid / Confirmed";
      case "cancelled":
        return "Cancelled";
      case "refunded":
        return "Refunded";
      default:
        return s ? s[0].toUpperCase() + s.slice(1) : "Pending";
    }
  }, [booking]);

  const statusTone = useMemo(() => {
    const s = String(booking?.status || "").toLowerCase();
    if (s === "paid" || s === "confirmed")
      return "border-emerald-400 text-emerald-200 bg-emerald-500/10";
    if (s === "refunded")
      return "border-amber-400 text-amber-200 bg-amber-500/10";
    if (s === "cancelled")
      return "border-red-400 text-red-200 bg-red-500/10";
    return "border-slate-400 text-slate-200 bg-slate-500/10";
  }, [booking]);

  const provider = booking?.provider || booking?.gateway || "Paystack";
  const reference = booking?.reference || booking?.paymentRef || booking?.id || id;

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
            Generating receipt…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && !booking && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Receipt not found.
          </div>
        )}

        {!loading && booking && (
          <div className="rounded-3xl border border-white/10 bg-[#05070b]/95 p-6 md:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            {/* Brand bar */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10 pb-4 mb-5">
              <div>
                <div className="text-xs tracking-[0.3em] uppercase text-amber-300/80">
                  NESTA
                </div>
                <h1
                  className="text-2xl md:text-3xl font-semibold tracking-tight mt-1"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  Booking receipt
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Issued on {fmt(booking.createdAt, true)}
                </p>
              </div>

              <div className="text-right space-y-2">
                <span
                  className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-[11px] ${statusTone}`}
                >
                  {statusLabel}
                </span>
                <div className="text-[11px] text-gray-400 font-mono">
                  Receipt ref: {booking.id || id}
                </div>
              </div>
            </header>

            {/* Guest / stay summary */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Guest
                </h2>
                <p className="mt-1 text-sm text-white/90">
                  {booking.guestName || booking.userName || "Guest"}
                </p>
                <p className="text-xs text-gray-400">
                  {booking.userEmail || "Email on file"}
                </p>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Stay
                </h2>
                <p className="mt-1 text-sm text-white/90">
                  {booking.listingTitle || booking.listing?.title || "Listing"}
                </p>
                <p className="text-xs text-gray-400">
                  {booking.listingLocation || booking.listing?.location || ""}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Check-in: <span className="font-medium">{fmt(booking.checkIn)}</span>
                  {" • "}
                  Check-out:{" "}
                  <span className="font-medium">{fmt(booking.checkOut)}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Nights: <span className="font-medium">{nights || "—"}</span>{" "}
                  • Guests:{" "}
                  <span className="font-medium">{booking.guests || 1}</span>
                </p>
              </div>
            </section>

            {/* Line items */}
            <section className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  Charge breakdown
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">
                    Stay ({nights || "—"} night(s))
                  </span>
                  <span className="font-medium">
                    {ngn(booking.subtotal ?? booking.total ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Service fee</span>
                  <span className="font-medium">
                    {ngn(booking.fee ?? booking.serviceFee ?? 0)}
                  </span>
                </div>
                {booking.taxes ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Taxes</span>
                    <span className="font-medium">{ngn(booking.taxes)}</span>
                  </div>
                ) : null}
                <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-100">
                    Total charged
                  </span>
                  <span className="font-semibold text-amber-300">
                    {ngn(
                      booking.total ??
                        booking.amountN ??
                        booking.totalAmount ??
                        0
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* Payment info */}
            <section className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-6 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  Payment
                </span>
                <span className="text-[11px] text-gray-400">
                  Processed securely via Nesta checkout
                </span>
              </div>
              <p className="text-gray-200">
                Method:{" "}
                <span className="font-medium">
                  {provider.toString().toUpperCase()}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                Gateway reference: {reference}
              </p>
              {booking.cardLast4 ? (
                <p className="text-xs text-gray-400 mt-1">
                  Card ending in •••• {booking.cardLast4}
                </p>
              ) : null}
            </section>

            {/* Footer actions */}
            <div className="flex flex-wrap justify-between items-center gap-3">
              <p className="text-[11px] text-gray-500">
                This receipt confirms your payment for a Nesta stay. For
                support on this booking, chat with your host/partner from{" "}
                <button
                  className="underline decoration-dotted hover:text-amber-300"
                  onClick={() => nav("/bookings")}
                >
                  Your bookings
                </button>
                .
              </p>
              <button
                onClick={() => nav("/bookings")}
                className="px-4 py-2 rounded-full bg-amber-500 text-black text-xs md:text-sm font-semibold hover:bg-amber-400 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
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
