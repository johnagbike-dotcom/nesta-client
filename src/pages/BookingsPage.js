// src/pages/BookingsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const API_BASE =
  process.env.REACT_APP_API_BASE || "http://localhost:4000/api";
const PAGE_SIZE = 10;

/* ---------- helpers ---------- */
const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

// Accepts Firestore Timestamp, millis, ISO string, or Date
const fmtDate = (v, withTime = false) => {
  try {
    if (!v) return "—";
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : v instanceof Date
        ? v
        : new Date(v);
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
  } catch {
    return "—";
  }
};

const isPast = (checkOut) => {
  try {
    const d =
      typeof checkOut?.toDate === "function"
        ? checkOut.toDate()
        : new Date(checkOut);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
};

// Refund eligibility (to protect revenue)
// Rule: booking is confirmed, created ≤ 24h ago, check-in ≥ 7 days away,
// and canRequestRefund is not explicitly false.
const isRefundEligible = (b) => {
  try {
    const now = new Date();

    // createdAt
    const created =
      b.createdAt && typeof b.createdAt.toDate === "function"
        ? b.createdAt.toDate()
        : b.createdAt
        ? new Date(b.createdAt)
        : now;

    // checkIn
    const checkIn =
      b.checkIn && typeof b.checkIn.toDate === "function"
        ? b.checkIn.toDate()
        : b.checkIn
        ? new Date(b.checkIn)
        : null;

    const hoursSinceCreated = (now - created) / 36e5; // 1000*60*60
    const daysUntilCheckIn = checkIn ? (checkIn - now) / 864e5 : Infinity;

    if (b.canRequestRefund === false) return false; // manual lock (future use)

    // You can tune these numbers later (24h & 7 days)
    return (
      hoursSinceCreated <= 24 && // within 24 hours of booking
      daysUntilCheckIn >= 7 // at least 7 days before check-in
    );
  } catch {
    return false;
  }
};

// Resolve a Firestore booking doc id from an API booking row
const getFsId = (b) =>
  b.firestoreId || b.fsId || b.fireId || b.fs || b.firestore_id || null;

/* -------------------------------- */
export default function BookingsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); // all | upcoming | past
  const [refreshKey, setRefreshKey] = useState(0);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;

  // per-row cancelling state
  const [cancelling, setCancelling] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/bookings`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        // Normalize any timestamp-like fields into objects we can render safely
        const norm = (b) => ({
          ...b,
          // keep raw values; rendering will use fmtDate()
          checkIn: b.checkIn ?? b.checkin ?? b.startDate ?? b.from,
          checkOut: b.checkOut ?? b.checkout ?? b.endDate ?? b.to,
          createdAt: b.createdAt ?? b.created ?? b.created_on,
        });

        setItems(Array.isArray(data) ? data.map(norm) : []);
      } catch (e) {
        if (!alive) return;
        console.error("[Bookings] fetch failed:", e);
        setErr("Could not load bookings. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (tab === "upcoming") return items.filter((b) => !isPast(b.checkOut));
    if (tab === "past") return items.filter((b) => isPast(b.checkOut));
    return items;
  }, [items, tab]);

  useEffect(() => {
    setPage(1);
  }, [tab, items.length]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const visible = filtered.slice(sliceStart, sliceStart + pageSize);

  // --- Request cancellation (guest) + mirror to Firestore so host/partner sees it
  async function requestCancel(b) {
    const id = b.id || b._id;
    if (!id) return;

    const s = String(b.status || "").toLowerCase();
    if (
      isPast(b.checkOut) ||
      ["cancelled", "cancel_request", "refund_requested"].includes(s)
    ) {
      alert("This booking can’t be cancelled.");
      return;
    }

    if (
      !window.confirm(
        `Request cancellation for “${b.listingTitle || "Listing"}”?`
      )
    )
      return;

    // optimistic UI
    const prevItems = items;
    setItems((curr) =>
      curr.map((x) =>
        (x.id || x._id) === id ? { ...x, status: "cancel_request" } : x
      )
    );
    setCancelling((prev) => ({ ...prev, [id]: true }));

    try {
      // API request: mark as cancellation requested
      const res = await fetch(`${API_BASE}/bookings/${id}/request-cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Firestore mirror (enables partner "Needs attention")
      const fsId = getFsId(b);
      if (fsId) {
        try {
          await updateDoc(doc(db, "bookings", fsId), {
            status: "cancel_request",
            // keep both flags in sync for all pages
            cancelRequested: true,
            cancellationRequested: true,
            updatedAt: serverTimestamp(),
            request: {
              type: "cancel",
              state: "requested",
              at: serverTimestamp(),
            },
          });
        } catch (e) {
          // Mirror failing shouldn't block the user; log silently
          // eslint-disable-next-line no-console
          console.warn("[Bookings] Firestore mirror failed:", e);
        }
      }

      alert("Cancellation request sent to host/partner.");
    } catch (e) {
      console.error("[Request cancel] failed:", e);
      alert("Could not send request. Restoring state.");
      setItems(prevItems);
    } finally {
      setCancelling((prev) => ({ ...prev, [id]: false }));
    }
  }

  function rebook(b) {
    const listing = {
      id: b.listingId || b.listing?.id || b.id || "",
      title: b.listingTitle || b.listing?.title || "Listing",
      location: b.listingLocation || b.listing?.location || "",
      pricePerNight: b.pricePerNight || b.listing?.pricePerNight || 0,
      city: b.city,
      area: b.area,
    };
    nav("/payment", {
      state: {
        booking: {
          listing,
          listingId: listing.id,
          // ask user for new dates
          checkIn: "",
          checkOut: "",
          guests: b.guests || 1,
          // recompute in PaymentPage
          pricePerNight: listing.pricePerNight || 0,
          nights: 0,
          subtotal: 0,
          fee: 0,
          total: 0,
          userEmail: b.userEmail,
          userId: b.userId,
        },
        from: "rebook",
      },
    });
  }

  function openChatFromBooking(b) {
    const listingId = b.listingId || b.listing?.id;
    const title = b.listingTitle || b.title || b.listing?.title || "Listing";
    // decide who the counterpart is based on ownershipType
    const counterpartUid =
      (b.ownershipType || "").toLowerCase() === "host"
        ? b.ownerId || b.hostId || null
        : b.partnerUid || b.ownerId || null;
    if (!listingId || !counterpartUid) {
      alert("This booking is missing host/partner info.");
      return;
    }
    nav("/chat", {
      state: {
        partnerUid: counterpartUid, // hostId/ownerId or partnerUid
        listing: { id: listingId, title }, // minimal listing context
        bookingId: b.id || b._id, // optional but helpful
        from: "bookings",
      },
    });
  }

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Your Bookings
          </h1>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
          >
            Refresh
          </button>
        </header>

        <div className="flex gap-2 mb-6">
          {["all", "upcoming", "past"].map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 rounded-xl border ${
                tab === key
                  ? "bg-amber-500/15 border-amber-400 text-amber-300"
                  : "bg-gray-900/60 border-white/10 text-gray-200 hover:bg-gray-800"
              }`}
            >
              {key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
            Loading bookings…
          </div>
        )}
        {!loading && err && (
          <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}
        {!loading && !err && total === 0 && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
            <p className="mb-2 font-semibold">No bookings found.</p>
            <p className="text-gray-300">
              When you book a stay, it’ll appear here.
            </p>
          </div>
        )}

        {!loading && !err && total > 0 && (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visible.map((b) => {
                const id = b.id || b._id;
                const s = String(b.status || "").toLowerCase();

                const refundable = isRefundEligible(b);

                const canRequest =
                  refundable &&
                  !isPast(b.checkOut) &&
                  !["cancelled", "cancel_request", "refund_requested"].includes(
                    s
                  );

                const canChat = ["confirmed", "paid"].includes(s);
                const canCheckIn =
                  !isPast(b.checkOut) &&
                  ["confirmed", "paid"].includes(s);

                const hasCancelReq =
                  (b.cancellationRequested ||
                    b.cancelRequested ||
                    s === "cancel_request" ||
                    s === "refund_requested") &&
                  !["cancelled", "refunded"].includes(s);

                let subtitle = b.listingLocation || "";
                if (s === "refunded") {
                  subtitle = "Payment has been refunded.";
                } else if (hasCancelReq) {
                  subtitle =
                    "Cancellation requested — awaiting host/partner.";
                }

                const statusLabel = (() => {
                  switch (s) {
                    case "paid":
                    case "confirmed":
                      return "confirmed";
                    case "cancelled":
                      return "cancelled";
                    case "refunded":
                      return "refunded";
                    case "cancel_request":
                    case "refund_requested":
                      return "cancel requested";
                    case "pending":
                      return "pending";
                    default:
                      return s || "pending";
                  }
                })();

                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {b.listingTitle || "Listing"}
                          </h3>
                          {subtitle && (
                            <p className="text-sm text-gray-300">
                              {subtitle}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Booked: {fmtDate(b.createdAt, true)}
                          </p>
                          {!refundable && s === "confirmed" && !hasCancelReq && (
                            <p className="text-[11px] text-amber-200/80 mt-1">
                              Non-refundable based on booking policy.
                            </p>
                          )}
                        </div>

                        <span
                          className={`text-xs px-2 py-1 rounded-md border ${
                            s === "paid" || s === "confirmed"
                              ? "border-emerald-400 text-emerald-300 bg-emerald-400/10"
                              : s === "cancelled"
                              ? "border-red-400 text-red-300 bg-red-500/10"
                              : s === "refunded"
                              ? "border-amber-400 text-amber-200 bg-amber-500/10"
                              : s === "cancel_request" ||
                                s === "refund_requested"
                              ? "border-amber-400 text-amber-200 bg-amber-500/10"
                              : "border-slate-400 text-slate-200 bg-slate-500/10"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                          <div className="text-gray-400">Check-in</div>
                          <div className="font-medium">
                            {fmtDate(b.checkIn)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                          <div className="text-gray-400">Check-out</div>
                          <div className="font-medium">
                            {fmtDate(b.checkOut)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-gray-300">
                          Guests:{" "}
                          <span className="font-medium">
                            {b.guests || 1}
                          </span>
                        </div>
                        <div className="text-lg font-semibold">
                          {ngn(b.total ?? b.amountN ?? b.totalAmount ?? 0)}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => rebook(b)}
                          className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700"
                        >
                          Rebook
                        </button>

                        {canRequest && (
                          <button
                            disabled={!!cancelling[id]}
                            onClick={() => requestCancel(b)}
                            className={`px-3 py-2 rounded-xl border ${
                              cancelling[id]
                                ? "bg-amber-900/30 border-amber-400/50 text-amber-200 cursor-not-allowed"
                                : "bg-amber-900/30 border-amber-400/60 text-amber-200 hover:bg-amber-900/50"
                            }`}
                          >
                            {cancelling[id]
                              ? "Requesting…"
                              : "Request cancel"}
                          </button>
                        )}

                        {canChat && (
                          <button
                            onClick={() => openChatFromBooking(b)}
                            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-black font-semibold"
                          >
                            Chat with Host/Partner
                          </button>
                        )}

                        {/* ✅ Open guest receipt */}
                        <button
                          onClick={() =>
                            nav("/booking-complete", { state: { booking: b } })
                          }
                          className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10 text-sm"
                        >
                          Receipt
                        </button>

                        {/* ✅ Guest check-in guide (only for confirmed & upcoming) */}
                        {canCheckIn && (
                          <button
                            onClick={() =>
                              nav(`/checkin/${id}`, { state: { booking: b } })
                            }
                            className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10 text-sm"
                          >
                            Check-in guide
                          </button>
                        )}

                        <button
                          onClick={() => nav(`/booking/${id}`)}
                          className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={`px-3 py-2 rounded-xl border ${
                    pageSafe <= 1
                      ? "border-white/10 text-gray-500 cursor-not-allowed"
                      : "border-white/20 bg-gray-900/60 hover:bg-gray-800"
                  }`}
                >
                  ‹ Prev
                </button>
                <div className="text-sm text-gray-300">
                  Page <span className="font-semibold">{pageSafe}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>
                <button
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={`px-3 py-2 rounded-xl border ${
                    pageSafe >= totalPages
                      ? "border-white/10 text-gray-500 cursor-not-allowed"
                      : "border-white/20 bg-gray-900/60 hover:bg-gray-800"
                  }`}
                >
                  Next ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
