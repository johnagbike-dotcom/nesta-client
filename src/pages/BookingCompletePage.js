// src/pages/BookingCompletePage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getBookingStatusAPI, notifyPaymentReceivedAPI } from "../api/bookings";

/* ---------- helpers ---------- */
const safeText = (v) => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);

  // Firestore Timestamp-like
  if (typeof v === "object" && typeof v.seconds === "number") {
    try {
      return new Date(v.seconds * 1000).toLocaleString();
    } catch {}
  }
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().toLocaleString();
    } catch {}
  }

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const toDateObj = (d) => {
  try {
    if (!d) return null;
    let x = d;
    if (typeof x === "object") {
      if (typeof x.toDate === "function") x = x.toDate();
      else if (typeof x.seconds === "number") x = new Date(x.seconds * 1000);
    }
    const dt = x instanceof Date ? x : new Date(x);
    return Number.isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
};

const fmtDate = (d, fallback = "—") => {
  const dt = toDateObj(d);
  if (!dt) return fallback;
  try {
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dt.toDateString();
  }
};

const ngn = (n) => {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₦${num.toLocaleString()}`;
  }
};

const diffNights = (checkIn, checkOut) => {
  const a = toDateObj(checkIn);
  const b = toDateObj(checkOut);
  if (!a || !b) return 0;

  const aa = new Date(a);
  const bb = new Date(b);

  // midday to avoid DST edge cases
  aa.setHours(12, 0, 0, 0);
  bb.setHours(12, 0, 0, 0);

  const ms = bb.getTime() - aa.getTime();
  return ms > 0 ? Math.round(ms / (1000 * 60 * 60 * 24)) : 0;
};

function normalizeProvider(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("flutter")) return "flutterwave";
  if (s.includes("paystack")) return "paystack";
  return s || "";
}

/**
 * Payment truth for UI:
 * - paymentStatus is the gateway truth
 * - status is your internal lifecycle truth
 *
 * Your webhook currently sets:
 *  - status: "paid_pending_release"
 *  - paymentStatus: "paid"
 */
function isPaidOrConfirmed(statusRaw, paymentStatusRaw) {
  const s = String(statusRaw || "").toLowerCase().trim();
  const p = String(paymentStatusRaw || "").toLowerCase().trim();

  const paidishStatus = new Set([
    "confirmed",
    "paid",
    "paid_pending_release",
    "paid-pending-release",
    "paid_pending_confirmation",
    "paid-pending-confirmation",
    "paid_needs_review",
    "paid-needs-review",
    "released",
    "completed",
  ]);

  const paidishPay = new Set(["paid", "successful", "completed"]);

  return paidishStatus.has(s) || paidishPay.has(p);
}

/**
 * Payout lifecycle (your current backend):
 * - booking.releaseStatus: "pending" | "released" | ...
 *
 * Backward compatible with any older "payoutStatus" field if present.
 */
function getReleaseStatus(b) {
  const s = String(
    b?.releaseStatus || b?.release_status || b?.payoutStatus || b?.payout_status || ""
  )
    .toLowerCase()
    .trim();
  return s || "—";
}

/**
 * Optional dispute lifecycle (if you add it later):
 * - disputeStatus: "open" | "resolved"
 */
function getDisputeStatus(b) {
  const s = String(b?.disputeStatus || b?.dispute_status || "").toLowerCase().trim();
  return s || "";
}

function resolveHostUidFromBooking(b) {
  if (!b || typeof b !== "object") return null;
  return (
    b.hostId ||
    b.hostUid ||
    b.partnerUid ||
    b.partnerId ||
    b.ownerId ||
    b.ownerUid ||
    b.payoutUid || // ✅ your webhook stores payoutUid
    b.listing?.hostId ||
    b.listing?.hostUid ||
    b.listing?.partnerUid ||
    b.listing?.partnerId ||
    b.listing?.ownerId ||
    null
  );
}

/* ---------- booking UI state chip ---------- */
function getUiState(booking) {
  const b = booking || {};
  const status = String(b.status || "").toLowerCase().trim();
  const payStatus = String(b.paymentStatus || "").toLowerCase().trim();
  const releaseStatus = getReleaseStatus(b);
  const disputeStatus = getDisputeStatus(b);

  // dispute takes precedence
  if (disputeStatus === "open") {
    return {
      icon: "⚠️",
      title: "Under review",
      subtitle: "A dispute has been opened. Our team will review and update you.",
      chip: "Under review",
      tone: "warning",
    };
  }

  if (status === "refunded") {
    return {
      icon: "↩️",
      title: "Refunded",
      subtitle: "This booking has been refunded. If you need help, contact support.",
      chip: "Refunded",
      tone: "neutral",
    };
  }

  if (status === "cancelled" || status === "canceled") {
    return {
      icon: "⛔",
      title: "Cancelled",
      subtitle: "This booking was cancelled.",
      chip: "Cancelled",
      tone: "neutral",
    };
  }

  const paidOrConfirmed = isPaidOrConfirmed(status, payStatus);

  if (!paidOrConfirmed) {
    return {
      icon: "⏳",
      title: "Payment processing",
      subtitle: "We’re confirming your payment. This can take a few seconds.",
      chip: "Processing",
      tone: "neutral",
    };
  }

  // Paid/confirmed — show release policy (your marketplace model)
  if (status.includes("paid_pending_release") || releaseStatus === "pending") {
    return {
      icon: "✅",
      title: "Booking confirmed",
      subtitle: "Payment verified. Host payout is released after check-in.",
      chip: "Confirmed · Pending release",
      tone: "success",
    };
  }

  if (releaseStatus === "released" || status === "released") {
    return {
      icon: "✅",
      title: "Booking confirmed",
      subtitle: "Enjoy your stay. You can message the host from your bookings.",
      chip: "Confirmed · Released",
      tone: "success",
    };
  }

  // Default paid state
  return {
    icon: "✅",
    title: "Booking confirmed",
    subtitle: "Your payment has been verified.",
    chip: "Confirmed",
    tone: "success",
  };
}

/* ---------- page ---------- */
export default function BookingCompletePage() {
  const location = useLocation();
  const nav = useNavigate();
  const state = location.state || {};

  const [snapshot, setSnapshot] = useState(null);
  const [serverBooking, setServerBooking] = useState(null);
  const [serverError, setServerError] = useState("");
  const [notifying, setNotifying] = useState(false);

  const pollRef = useRef(null);
  const nudgedRef = useRef(false);

  // Receipt mode (from My Bookings with full booking object)
  const routeBooking =
    state?.booking &&
    (state.booking.listingTitle || state.booking.total || state.booking.amountN || state.booking.id)
      ? state.booking
      : null;

  const entrySourceRibbon = routeBooking ? "My Bookings → Receipt" : "Post-checkout summary";

  // Support query params after redirect/callback (optional)
  const queryParams = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    return {
      provider: normalizeProvider(sp.get("provider")),
      bookingId: safeText(sp.get("bookingId")),
      reference: safeText(sp.get("reference")),
    };
  }, [location.search]);

  useEffect(() => {
    // Receipt mode: still poll server for freshest status
    if (routeBooking) {
      setSnapshot({
        mode: "receipt",
        bookingIdOrRef: safeText(routeBooking.id || routeBooking.reference || routeBooking.ref || ""),
        provider: normalizeProvider(routeBooking.provider || routeBooking.gateway || ""),
        when: new Date().toISOString(),
        pending: null,
        tx: null,
      });
      return;
    }

    // Snapshot mode: read from router state then sessionStorage
    const statePending = state?.booking || state?.pending || null;
    const stateTx = state?.tx || null;

    let pending = null;
    let tx = null;

    try {
      if (!statePending) {
        const raw = sessionStorage.getItem("booking_pending");
        pending = raw ? JSON.parse(raw) : null;
      } else {
        pending = statePending;
      }
    } catch {
      pending = null;
    }

    try {
      if (!stateTx) {
        const raw =
          sessionStorage.getItem("flutterwave_tx") || sessionStorage.getItem("paystack_tx");
        tx = raw ? JSON.parse(raw) : null;
      } else {
        tx = stateTx;
      }
    } catch {
      tx = null;
    }

    // Normalize tx (Paystack + Flutterwave)
    const normalizedTx =
      tx && typeof tx === "object"
        ? {
            provider: normalizeProvider(tx.provider || tx.gateway || tx.type || ""),
            status: safeText(tx.status || tx.message || tx.data?.status || ""),
            reference:
              safeText(
                tx.reference ||
                  tx.trxref ||
                  tx.data?.reference ||
                  tx.data?.txRef ||
                  tx.data?.tx_ref ||
                  tx.tx_ref ||
                  ""
              ) || "",
            transaction_id: safeText(tx.transaction_id || tx.data?.id || tx.id || ""),
            raw: tx,
          }
        : null;

    // Determine bookingIdOrRef (query can override)
    const bookingIdOrRef =
      safeText(queryParams.bookingId) ||
      safeText(pending?.bookingId) ||
      safeText(pending?.id) ||
      safeText(pending?.reference) ||
      safeText(queryParams.reference) ||
      safeText(normalizedTx?.reference) ||
      "";

    const provider = normalizeProvider(
      queryParams.provider || normalizedTx?.provider || pending?.provider || ""
    );

    setSnapshot({
      mode: "snapshot",
      pending: pending || null,
      tx: normalizedTx,
      bookingIdOrRef,
      provider,
      when: new Date().toISOString(),
    });

    // clear session copies
    try {
      sessionStorage.removeItem("booking_pending");
    } catch {}
    try {
      sessionStorage.removeItem("paystack_tx");
    } catch {}
    try {
      sessionStorage.removeItem("flutterwave_tx");
    } catch {}
  }, [state, routeBooking, queryParams]);

  // Compute display info from snapshot.pending (UI only; server remains truth)
  const info = useMemo(() => {
    const p = snapshot?.pending;
    if (!p) return null;

    const listing = p.listing || {};
    const nightly = Number(listing.pricePerNight ?? listing.price ?? p.pricePerNight ?? 0);

    const checkIn = p.checkIn ?? listing.checkIn ?? null;
    const checkOut = p.checkOut ?? listing.checkOut ?? null;
    const nights = diffNights(checkIn, checkOut);
    const guests = Number(p.guests ?? 1) || 1;

    // UI-only fee calc (server should lock amountLockedN / amountN)
    const feePct = Number(p.feePct ?? 5) || 0;
    const subtotal = nightly * nights;
    const fee = Math.round((feePct / 100) * subtotal);
    const total = subtotal + fee;

    return {
      listing: {
        id: safeText(listing.id),
        title: safeText(listing.title || "Listing"),
        city: safeText(listing.city),
        area: safeText(listing.area),
      },
      checkIn,
      checkOut,
      guests,
      nights,
      nightly,
      feePct,
      subtotal,
      fee,
      total,
    };
  }, [snapshot]);

  // ✅ Server-truth poller
  useEffect(() => {
    if (!snapshot?.bookingIdOrRef) return;

    let cancelled = false;
    setServerError("");
    setServerBooking(null);

    async function loadOnce() {
      try {
        const booking = await getBookingStatusAPI(snapshot.bookingIdOrRef);
        if (!cancelled) setServerBooking(booking || null);
      } catch (e) {
        if (!cancelled) setServerError(e?.message || "Could not load booking status.");
      }
    }

    loadOnce();

    const started = Date.now();
    const maxMs = 120_000; // 120s
    const intervalMs = 3000;

    pollRef.current = setInterval(async () => {
      if (Date.now() - started > maxMs) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      await loadOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [snapshot?.bookingIdOrRef]);

  // ✅ Optional UX nudge after redirect/callback (Paystack + Flutterwave)
  // Webhook remains the source of truth.
  useEffect(() => {
    if (!snapshot || routeBooking) return;
    if (nudgedRef.current) return;

    const bookingId =
      safeText(snapshot?.pending?.bookingId) ||
      safeText(queryParams.bookingId) ||
      safeText(snapshot?.bookingIdOrRef);

    const provider = normalizeProvider(snapshot?.provider || queryParams.provider || snapshot?.tx?.provider);
    const reference =
      safeText(queryParams.reference) ||
      safeText(snapshot?.pending?.reference) ||
      safeText(snapshot?.tx?.reference);

    if (!bookingId || !provider || !reference) return;

    nudgedRef.current = true;

    (async () => {
      setNotifying(true);
      try {
        await notifyPaymentReceivedAPI({ bookingId, provider, reference });
      } catch {
        // swallow; polling + webhook will still update
      } finally {
        setNotifying(false);
      }
    })();
  }, [snapshot, routeBooking, queryParams]);

  /* ---------- RECEIPT MODE ---------- */
  if (routeBooking) {
    const b = serverBooking || routeBooking;

    const listingTitle = b.listingTitle || b.listing?.title || b.title || "Listing";
    const locationLabel =
      b.listingLocation || [b.city || b.listingCity, b.area || b.listingArea].filter(Boolean).join(", ") || "";
    const ref = b.reference || b.ref || b.id || "";

    const nights =
      typeof b.nights === "number" && b.nights > 0 ? b.nights : diffNights(b.checkIn, b.checkOut);

    const nightly =
      Number(b.pricePerNight || b.listing?.pricePerNight || 0) ||
      (nights > 0 ? Number(b.total || b.amountN || 0) / nights : 0);

    const subtotal = b.subtotal ?? (nights > 0 ? nights * Number(nightly || 0) : 0);
    const fee = b.fee ?? (b.total != null ? Math.max(0, Number(b.total) - subtotal) : 0);
    const total = b.total != null ? Number(b.total) : subtotal + fee;

    const confirmed = isPaidOrConfirmed(b.status, b.paymentStatus);
    const hostUid = resolveHostUidFromBooking(b);
    const listingId = safeText(b.listingId || b.listing?.id || "");
    const canChat = !!(confirmed && hostUid && listingId);

    const ui = getUiState(b);
    const releaseStatus = getReleaseStatus(b);
    const disputeStatus = getDisputeStatus(b);

    return (
      <main className="dash-bg">
        <div className="container dash-wrap" style={{ paddingBottom: 64 }}>
          <div
            className="card"
            style={{
              maxWidth: 980,
              marginInline: "auto",
              borderRadius: 18,
              padding: 22,
              border: "1px solid rgba(255,255,255,0.10)",
              background:
                "linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(30,41,59,0.30) 100%)",
            }}
          >
            <div style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background:
                      ui.tone === "success"
                        ? "rgba(16,185,129,0.15)"
                        : ui.tone === "warning"
                        ? "rgba(245,158,11,0.15)"
                        : "rgba(148,163,184,0.12)",
                    display: "grid",
                    placeItems: "center",
                    border:
                      ui.tone === "success"
                        ? "1px solid rgba(16,185,129,0.35)"
                        : ui.tone === "warning"
                        ? "1px solid rgba(245,158,11,0.35)"
                        : "1px solid rgba(148,163,184,0.35)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{ui.icon}</span>
                </div>
                <div>
                  <h2 style={{ margin: "0 0 6px" }}>{ui.title}</h2>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Ref: {safeText(ref) || "—"}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {ui.subtitle}
                  </div>
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.7)",
                    background: "rgba(15,23,42,0.9)",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entrySourceRibbon}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)",
                gap: 20,
                marginTop: 20,
              }}
            >
              <section>
                <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{listingTitle}</h3>
                {locationLabel ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {locationLabel}
                  </p>
                ) : null}

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  }}
                >
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Check-in
                    </div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(b.checkIn)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Check-out
                    </div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(b.checkOut)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Nights
                    </div>
                    <div style={{ fontWeight: 600 }}>{nights || "—"}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Guests
                    </div>
                    <div style={{ fontWeight: 600 }}>{b.guests || 1}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, fontSize: 13 }}>
                  <div className="muted">
                    Status:{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.6)",
                        fontSize: 11,
                      }}
                    >
                      {b.status || "—"} / {b.paymentStatus || "—"}
                    </span>
                  </div>

                  <div className="muted" style={{ marginTop: 8 }}>
                    Release:{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.6)",
                        fontSize: 11,
                        marginRight: 6,
                      }}
                    >
                      {releaseStatus}
                    </span>

                    {disputeStatus ? (
                      <>
                        Dispute:{" "}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(245,158,11,0.55)",
                            fontSize: 11,
                          }}
                        >
                          {disputeStatus}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                {canChat ? (
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() =>
                        nav("/chat", {
                          state: { partnerUid: hostUid, listing: { id: listingId, title: listingTitle } },
                        })
                      }
                      className="btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      Message host
                    </button>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Chat is available for paid/confirmed bookings only.
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                style={{
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(148,163,184,0.4)",
                }}
              >
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Payment summary</h3>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="muted">Nightly rate × {nights || 1}</span>
                  <span style={{ fontWeight: 600 }}>{ngn(subtotal)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="muted">Service fee</span>
                  <span style={{ fontWeight: 600 }}>{ngn(fee)}</span>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(148,163,184,0.45)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                  }}
                >
                  <span>Total</span>
                  <span>{ngn(total)}</span>
                </div>

                {serverError ? (
                  <div style={{ marginTop: 10, fontSize: 12 }} className="muted">
                    Could not refresh status: {serverError}
                  </div>
                ) : null}
              </section>
            </div>

            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Link className="btn ghost" to="/bookings">
                My bookings
              </Link>
              <Link className="btn" to="/">
                Back home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- SNAPSHOT / CHECKOUT FLOW ---------- */
  if (!snapshot) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h2>Finishing up…</h2>
            <p className="muted">Please wait while we prepare your booking summary.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!info || !info.listing) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <div
            className="card"
            style={{
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Checkout</h2>
            <p>We couldn’t find your booking details. Please go back to Explore and select a listing again.</p>
            <div style={{ marginTop: 16 }}>
              <Link className="btn" to="/explore">
                Explore listings
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { listing, checkIn, checkOut, guests, nights, nightly, subtotal, fee, total, feePct } = info;

  const b = serverBooking;
  const confirmed = b ? isPaidOrConfirmed(b.status, b.paymentStatus) : false;
  const processing = !confirmed;

  const ui = getUiState(b || {});
  const releaseStatus = b ? getReleaseStatus(b) : "—";
  const disputeStatus = b ? getDisputeStatus(b) : "";

  // enable chat when server says paid/confirmed and we can resolve a target + listing id
  const hostUid = b ? resolveHostUidFromBooking(b) : null;
  const listingId = safeText(b?.listingId || b?.listing?.id || listing?.id || "");
  const canChat = !!(confirmed && hostUid && listingId);

  return (
    <main className="dash-bg">
      <div className="container dash-wrap" style={{ paddingBottom: 64 }}>
        <div
          className="card"
          style={{
            maxWidth: 980,
            marginInline: "auto",
            borderRadius: 18,
            padding: 22,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(30,41,59,0.30) 100%)",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background:
                    ui.tone === "success"
                      ? "rgba(16,185,129,0.15)"
                      : ui.tone === "warning"
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(148,163,184,0.12)",
                  display: "grid",
                  placeItems: "center",
                  border:
                    ui.tone === "success"
                      ? "1px solid rgba(16,185,129,0.35)"
                      : ui.tone === "warning"
                      ? "1px solid rgba(245,158,11,0.35)"
                      : "1px solid rgba(148,163,184,0.35)",
                }}
              >
                <span style={{ fontSize: 22 }}>{ui.icon}</span>
              </div>
              <div>
                <h2 style={{ margin: "0 0 6px" }}>{ui.title}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  {safeText(snapshot?.bookingIdOrRef) ? (
                    <>
                      Booking: <code>{safeText(snapshot.bookingIdOrRef)}</code>
                    </>
                  ) : (
                    <>Completed at {fmtDate(snapshot.when)}</>
                  )}
                </div>

                {notifying ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Notifying server…
                  </div>
                ) : processing ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    We’re confirming your payment. This can take a few seconds.
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Payment verified. Host payout releases after check-in.
                  </div>
                )}
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.7)",
                  background: "rgba(15,23,42,0.9)",
                  textTransform: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {entrySourceRibbon}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "minmax(260px,1fr) minmax(260px,1fr)",
              marginTop: 18,
            }}
          >
            <section
              className="card"
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <h3>Stay summary</h3>
              <div style={{ fontWeight: 600 }}>{safeText(listing.title)}</div>
              <div className="muted">
                {safeText(listing.city)} • {safeText(listing.area)}
              </div>

              <div className="muted" style={{ marginTop: 6 }}>
                Check-in: <strong>{fmtDate(checkIn)}</strong>
                <br />
                Check-out: <strong>{fmtDate(checkOut)}</strong>
                <br />
                Guests: <strong>{guests}</strong>
                <br />
                Nights: <strong>{nights}</strong>
              </div>

              {b ? (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Status:{" "}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      fontSize: 11,
                    }}
                  >
                    {b.status || "—"} / {b.paymentStatus || "—"}
                  </span>

                  <div style={{ marginTop: 8 }}>
                    Release:{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.6)",
                        fontSize: 11,
                        marginRight: 6,
                      }}
                    >
                      {releaseStatus}
                    </span>

                    {disputeStatus ? (
                      <>
                        Dispute:{" "}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(245,158,11,0.55)",
                            fontSize: 11,
                          }}
                        >
                          {disputeStatus}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : serverError ? (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Could not load booking status: {serverError}
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Fetching booking status…
                </div>
              )}

              {!confirmed ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Don’t worry — your booking will only be confirmed after payment is verified by the server.
                </div>
              ) : null}

              {canChat ? (
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() =>
                      nav("/chat", {
                        state: { partnerUid: hostUid, listing: { id: listingId, title: listing.title } },
                      })
                    }
                    className="btn"
                  >
                    Message host
                  </button>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Chat is available for paid/confirmed bookings only.
                  </div>
                </div>
              ) : null}
            </section>

            <section
              className="card"
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <h3>Charges</h3>
              <div className="muted">
                {ngn(nightly)} × {nights} nights
                <div style={{ float: "right" }}>{ngn(subtotal)}</div>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Service fee ({feePct}%)
                <div style={{ float: "right" }}>{ngn(fee)}</div>
              </div>
              <hr />
              <div style={{ fontWeight: 700 }}>
                Total
                <div style={{ float: "right" }}>{ngn(total)}</div>
              </div>

              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="btn" to="/bookings">
                  View bookings
                </Link>

                {safeText(listing.id) ? (
                  <Link className="btn ghost" to={`/listing/${safeText(listing.id)}`}>
                    Open listing
                  </Link>
                ) : null}

                <Link className="btn ghost" to="/explore">
                  Explore more
                </Link>

                {!confirmed ? (
                  <button type="button" className="btn ghost" onClick={() => nav("/bookings")}>
                    I’ll check later
                  </button>
                ) : null}
              </div>

              {processing ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  If you don’t see confirmation after a minute, go to <strong>My bookings</strong> and refresh.
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}