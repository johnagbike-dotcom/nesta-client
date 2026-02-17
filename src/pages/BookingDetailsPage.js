// src/pages/BookingDetailsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "firebase/auth";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

/* ---------- helpers ---------- */
function ngn(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function fmt(d) {
  if (!d) return "-";
  try {
    if (typeof d === "object") {
      if (typeof d.toDate === "function") d = d.toDate();
      else if (typeof d.seconds === "number") d = new Date(d.seconds * 1000);
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toLocaleString();
  } catch {
    return "-";
  }
}

function justDate(d) {
  if (!d) return "-";
  try {
    if (typeof d === "object") {
      if (typeof d.toDate === "function") d = d.toDate();
      else if (typeof d.seconds === "number") d = new Date(d.seconds * 1000);
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toDateString();
  } catch {
    return "-";
  }
}

function isPast(checkOut) {
  try {
    let co = checkOut;
    if (co && typeof co === "object") {
      if (typeof co.toDate === "function") co = co.toDate();
      else if (typeof co.seconds === "number") co = new Date(co.seconds * 1000);
    }
    const d = co instanceof Date ? co : new Date(co);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
}

async function getBearerToken() {
  try {
    const auth = getAuth();
    return auth.currentUser ? await auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

function lower(v) {
  return String(v || "").toLowerCase().trim();
}

/**
 * ✅ Only treat as confirmed if payment is actually paid (server truth).
 * This prevents “payment error but booking looks confirmed” on the UI.
 */
function isPaymentActuallyPaid(booking) {
  if (!booking) return false;
  const pay = lower(booking.paymentStatus);
  const st = lower(booking.status);
  const paidFlag = booking.paid === true;

  // Pay status wins
  if (pay === "paid") return true;

  // Some legacy data may only set status
  // Keep conservative: only accept "confirmed/paid" if paidFlag is true too
  if ((st === "confirmed" || st === "paid") && paidFlag) return true;

  return false;
}

/* ---------- component ---------- */
export default function BookingDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const token = await getBearerToken();
        const res = await fetch(`${API_BASE}/bookings/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Your API returns { ok:true, booking: {...} } (based on bookings.js)
        const booking = json?.booking || json?.data || json || null;

        if (alive) setData(booking);
      } catch (e) {
        if (alive) setErr("Could not load this booking. Please go back and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const status = useMemo(() => lower(data?.status), [data]);
  const paymentStatus = useMemo(() => lower(data?.paymentStatus), [data]);

  const paidOrConfirmed = useMemo(() => isPaymentActuallyPaid(data), [data]);

  const hasCancelReq =
    (data?.cancellationRequested ||
      data?.cancelRequested ||
      status === "cancel_request" ||
      status === "refund_requested") &&
    !["cancelled", "refunded"].includes(status);

  // ✅ Only allow cancel/chat/checkin if payment is truly paid/confirmed
  const canCancel =
    !!data &&
    paidOrConfirmed &&
    !isPast(data.checkOut) &&
    !["cancelled", "refunded", "cancel_request", "refund_requested"].includes(status) &&
    !hasCancelReq;

  const canChat = !!data && paidOrConfirmed;
  const canCheckInGuide = !!data && paidOrConfirmed && !isPast(data.checkOut);

  async function handleCancel() {
    if (!data) return;

    if (!canCancel) {
      alert("This booking can’t be cancelled.");
      return;
    }
    if (!window.confirm("Request cancellation for this booking?")) return;

    setCancelling(true);

    // optimistic UI
    const prev = data;
    setData((d) => ({ ...d, status: "cancel_request", cancellationRequested: true, cancelRequested: true }));

    try {
      const token = await getBearerToken();
      const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("Cancellation request sent to host/partner.");
    } catch (e) {
      alert("Could not send request. Restoring previous state.");
      setData(prev);
    } finally {
      setCancelling(false);
    }
  }

  function rebook() {
    if (!data) return;

    const listingId = data.listingId || data.listing?.id;
    if (!listingId) {
      alert("Listing ID missing for this booking.");
      return;
    }

    nav(`/reserve/${listingId}`, {
      state: {
        id: listingId,
        title: data.listingTitle || data.listing?.title || "Listing",
        price: data.pricePerNight || data.listing?.pricePerNight || 0,
        hostId: data.ownerId || data.hostId || data.partnerUid || null,
        city: data.city || "",
        area: data.area || "",
      },
    });
  }

  function openChat() {
    if (!data) return;

    if (!canChat) {
      alert("Chat is available after payment is verified and the booking is confirmed.");
      return;
    }

    const bookingId = data.id || id;
    const listingId = data.listingId || data.listing?.id || null;
    const title = data.listingTitle || data.listing?.title || "Listing";

    const ownership = lower(data.ownershipType);
    const counterpartUid =
      ownership === "host"
        ? data.ownerId || data.hostId || null
        : data.partnerUid || data.ownerId || data.hostId || null;

    if (!listingId || !counterpartUid) {
      alert("This booking is missing host/partner info.");
      return;
    }

    nav("/chat", {
      state: {
        partnerUid: counterpartUid,
        listing: { id: listingId, title },
        bookingId,
        from: "bookingDetail",
      },
    });
  }

  const statusTone = (() => {
    // ✅ Prefer paymentStatus for tone
    if (paymentStatus === "paid" || paidOrConfirmed)
      return "border-emerald-400 text-emerald-300 bg-emerald-400/10";

    if (status === "cancelled") return "border-red-400 text-red-300 bg-red-400/10";
    if (status === "refunded") return "border-amber-400 text-amber-200 bg-amber-500/10";
    if (status === "cancel_request" || status === "refund_requested")
      return "border-amber-400 text-amber-200 bg-amber-500/10";

    if (status === "payment-review" || paymentStatus === "payment-review")
      return "border-amber-400 text-amber-200 bg-amber-500/10";

    return "border-slate-400 text-slate-200 bg-slate-500/10";
  })();

  const statusLabel = (() => {
    // ✅ More accurate labels across your lifecycle
    if (status === "cancelled") return "cancelled";
    if (status === "refunded") return "refunded";
    if (status === "cancel_request" || status === "refund_requested") return "cancel requested";

    if (paymentStatus === "paid" && (status === "paid-pending-confirmation" || status === "pending_payment"))
      return "payment received";

    if (paidOrConfirmed) return "confirmed";

    if (status === "pending_payment") return "pending payment";
    if (status === "payment-review" || paymentStatus === "payment-review") return "payment review";

    if (status === "pending") return "pending";
    return status || "pending";
  })();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 py-10">
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
            Loading booking…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && !data && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Booking not found.
          </div>
        )}

        {!loading && data && (
          <div className="rounded-3xl border border-white/10 bg-[#05070b]/90 p-6 md:p-7 shadow-[0_35px_100px_rgba(0,0,0,0.7)] backdrop-blur-md">
            <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1
                  className="text-2xl md:text-3xl font-semibold tracking-tight"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  {data.listingTitle || "Listing"}
                </h1>
                <p className="text-sm text-gray-300 mt-1">{data.listingLocation || ""}</p>
                <p className="mt-2 text-xs text-gray-400">Created: {fmt(data.createdAt)}</p>

                <p className="mt-1 text-[11px] text-gray-500 font-mono">
                  Ref: {data.reference || data.id || id}
                </p>

                <p className="mt-1 text-[11px] text-gray-500">
                  Payment:{" "}
                  <span className="font-mono">
                    {data.paymentStatus || "unpaid"} {data.provider ? `(${data.provider})` : ""}
                  </span>
                </p>
              </div>

              <span className={`self-start text-xs px-2.5 py-1 rounded-full border ${statusTone}`}>
                {statusLabel}
              </span>
            </header>

            <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/40 border border-white/12 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Check-in</div>
                <div className="mt-1 font-semibold">{justDate(data.checkIn)}</div>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/12 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Check-out</div>
                <div className="mt-1 font-semibold">{justDate(data.checkOut)}</div>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/12 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Guests</div>
                <div className="mt-1 font-semibold">{data.guests || 1}</div>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/12 p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Nights</div>
                <div className="mt-1 font-semibold">{data.nights ?? "-"}</div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl bg-black/45 border border-white/12 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Subtotal</span>
                <span className="font-medium">{ngn(data.subtotal ?? data.amountN ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-300">Service fee</span>
                <span className="font-medium">{ngn(data.fee ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-sm">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-amber-300">{ngn(data.total ?? data.amountN ?? 0)}</span>
              </div>
            </section>

            {!paidOrConfirmed && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-gray-300">
                Payment has not been verified yet. Your booking will only be confirmed after Flutterwave confirms the charge.
              </div>
            )}

            <section className="mt-7 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={openChat}
                disabled={!canChat}
                className={`px-4 py-2 rounded-full text-sm font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
                  canChat
                    ? "bg-amber-500 hover:bg-amber-400 text-black"
                    : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                Message host
              </button>

              <button
                onClick={rebook}
                className="px-4 py-2 rounded-full bg-amber-500/15 border border-amber-400/60 text-amber-100 text-sm font-semibold hover:bg-amber-500/25"
              >
                Rebook
              </button>

              {canCheckInGuide && (
                <button
                  onClick={() => nav(`/checkin/${data.id || id}`, { state: { booking: data } })}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/12 text-xs md:text-sm hover:bg-white/10"
                >
                  Check-in guide
                </button>
              )}

              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className={`px-4 py-2 rounded-full border text-xs md:text-sm ${
                    cancelling
                      ? "bg-amber-900/30 border-amber-400/50 text-amber-200 cursor-not-allowed"
                      : "bg-amber-900/30 border-amber-400/60 text-amber-200 hover:bg-amber-900/50"
                  }`}
                >
                  {cancelling ? "Requesting…" : "Request cancellation"}
                </button>
              )}
            </section>

            <p className="mt-5 text-[11px] text-gray-500">
              All communication and check-in details stay securely in Nesta.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}