// src/pages/ReserveSuccessPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

function safeStr(v) {
  return String(v ?? "").trim();
}
function safeLower(v) {
  return safeStr(v).toLowerCase();
}

function formatMoneyNGN(n) {
  const x = Math.round(Number(n || 0));
  return `₦${x.toLocaleString("en-NG")}`;
}

function normalizeBookingShape(raw) {
  const b = raw || {};
  return {
    id: b.id || b.bookingId || null,
    reference: b.reference || b.ref || null,
    status: safeLower(b.status || ""),
    paymentStatus: safeLower(b.paymentStatus || ""),
    paid: !!b.paid,
    gateway: safeLower(b.gateway || ""),
    provider: safeLower(b.provider || ""),
    paymentMismatch: !!b.paymentMismatch,
    amountN: Number(b.amountLockedN ?? b.amountPaidN ?? b.amountN ?? b.amount ?? b.total ?? 0),
    listingTitle: b.listingTitle || b.title || b.listing?.title || "",
    listingId: b.listingId || b.listing?.id || null,
    checkIn: b.checkIn || null,
    checkOut: b.checkOut || null,
  };
}

function deriveModeFromBooking(b) {
  const status = safeLower(b?.status || "");
  const payStatus = safeLower(b?.paymentStatus || "");
  const paid = !!b?.paid || payStatus === "paid" || status === "paid";
  const mismatch = !!b?.paymentMismatch || status === "paid-needs-review" || payStatus === "payment-review";

  // ✅ If mismatch/review flags are present, treat as review (don’t show success)
  if (mismatch) {
    return { mode: "review", message: "Payment received — reviewing details to confirm your booking." };
  }

  // ✅ Only show SUCCESS when booking is confirmed/completed
  if (status === "confirmed" || status === "completed") {
    return { mode: "success", message: "Booking confirmed ✅ Your reservation is secured." };
  }

  // Paid is not the final state (still settling / webhook)
  if (paid || b?.gateway === "success" || payStatus === "paid-pending-confirmation") {
    return { mode: "confirming", message: "Payment detected ✅ Finalising your booking…" };
  }

  // Otherwise still waiting
  return { mode: "confirming", message: "Confirming your booking…" };
}

/**
 * Luxury-state machine:
 * - verifying: verifying payment provider details (Flutterwave only)
 * - confirming: waiting for server booking to become confirmed/released
 * - success: confirmed/completed
 * - review: mismatch / attention
 * - failed: not found / verification hard-fail / timeout with unpaid
 */
export default function ReserveSuccessPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // API base normalization
  const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
  const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

  // ----- From Paystack (state navigation) -----
  const state = location.state || {};
  const stateBookingId = state?.bookingId || null;
  const stateListing = state?.listing || null;
  const stateProvider = safeLower(state?.provider || "");
  const stateReference = safeStr(state?.reference || "");

  // ----- From Flutterwave (query redirect) -----
  const flwStatus = safeLower(searchParams.get("status") || searchParams.get("payment_status") || "");
  const flwTxRef = safeStr(searchParams.get("tx_ref") || searchParams.get("reference") || "");
  const flwTransactionId = safeStr(
    searchParams.get("transaction_id") ||
      searchParams.get("transactionId") ||
      searchParams.get("id") ||
      ""
  );

  // Your redirectUrl also included these
  const qpBookingId = safeStr(searchParams.get("bookingId") || "");
  const qpListingId = safeStr(searchParams.get("listingId") || "");
  const qpReference = safeStr(searchParams.get("reference") || "");

  // Resolve bookingId priority
  const bookingId = stateBookingId || qpBookingId || null;

  const [listing, setListing] = useState(stateListing || null);

  // Booking snapshot (polled)
  const [booking, setBooking] = useState(null);

  // UI machine
  const [mode, setMode] = useState("verifying"); // verifying | confirming | success | review | failed
  const [message, setMessage] = useState("Preparing your confirmation…");

  const stopRef = useRef(false);
  const didVerifyFlwRef = useRef(false);

  // Determine provider this page is handling
  const provider = useMemo(() => {
    if (stateProvider) return stateProvider;
    if (flwTxRef || flwTransactionId || flwStatus) return "flutterwave";
    return "paystack";
  }, [stateProvider, flwTxRef, flwTransactionId, flwStatus]);

  // Display reference (for support / UX)
  const displayReference = useMemo(() => {
    if (provider === "flutterwave") return flwTxRef || qpReference || "";
    return stateReference || qpReference || "";
  }, [provider, flwTxRef, qpReference, stateReference]);

  // Load listing if missing but we have listingId
  useEffect(() => {
    let alive = true;
    (async () => {
      if (listing || !qpListingId) return;
      try {
        const snap = await getDoc(doc(db, "listings", qpListingId));
        if (!alive) return;
        if (snap.exists()) {
          const d = snap.data() || {};
          setListing({
            id: snap.id,
            title: d.title || d.name || "Listing",
            city: d.city || "",
            area: d.area || "",
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [listing, qpListingId]);

  async function getIdTokenOrNull(forceRefresh = false) {
    try {
      if (!user) return "";
      return await user.getIdToken(!!forceRefresh);
    } catch {
      return "";
    }
  }

  /**
   * Step 0:
   * - For Paystack: go straight to confirming (webhook/server is truth)
   * - For Flutterwave: if explicitly failed/cancelled => fail; otherwise verify-booking once then confirm
   */
  useEffect(() => {
    if (provider !== "flutterwave") {
      setMode("confirming");
      setMessage("Processing your payment… Confirming your booking.");
      return;
    }

    if (flwStatus && ["failed", "cancelled", "canceled", "error"].includes(flwStatus)) {
      setMode("failed");
      setMessage("Payment was not completed. If you were charged, contact support with your reference.");
      return;
    }

    // Flutterwave path: verify then confirm
    setMode("verifying");
    setMessage("Verifying your payment…");
  }, [provider, flwStatus]);

  /**
   * Step 0.5: Flutterwave strict verify (POST /api/flutterwave/verify-booking)
   * - Idempotent by design (server-side replay protections)
   * - Does NOT settle or confirm booking (Option A)
   * - Helps catch mismatch early and stamp paymentStatus=verified
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      if (provider !== "flutterwave") return;
      if (didVerifyFlwRef.current) return;

      // Need the 3 fields for strict verify
      if (!bookingId || !flwTxRef || !flwTransactionId) {
        // If we don’t have enough info, skip strict verify and just poll (safe fallback)
        setMode("confirming");
        setMessage("Confirming your booking…");
        return;
      }

      didVerifyFlwRef.current = true;

      try {
        const token = await getIdTokenOrNull(false);
        if (!token) {
          setMode("confirming");
          setMessage("Confirming your booking…");
          return;
        }

        let res = await fetch(`${API}/flutterwave/verify-booking`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            tx_ref: flwTxRef,
            transaction_id: flwTransactionId,
          }),
        });

        if (res.status === 401) {
          const token2 = await getIdTokenOrNull(true);
          if (token2) {
            res = await fetch(`${API}/flutterwave/verify-booking`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token2}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingId,
                tx_ref: flwTxRef,
                transaction_id: flwTransactionId,
              }),
            });
          }
        }

        const json = await res.json().catch(() => null);

        // If strict verify flags mismatch / replay, don’t claim success — go to review.
        if (!res.ok || !json?.ok) {
          const msg = safeStr(json?.message || "");
          const lowered = safeLower(msg);

          if (res.status === 409) {
            // replay protection triggered -> review
            if (!alive) return;
            setMode("review");
            setMessage("Payment received — verifying details. Please check My Bookings shortly.");
            return;
          }

          if (lowered.includes("mismatch") || lowered.includes("currency") || lowered.includes("amount")) {
            if (!alive) return;
            setMode("review");
            setMessage("Payment received — reviewing details to confirm your booking.");
            return;
          }

          // otherwise continue polling; webhook may still settle
        }

        if (!alive) return;
        setMode("confirming");
        setMessage("Payment detected ✅ Finalising your booking…");
      } catch {
        if (!alive) return;
        // Don’t block UX; proceed to polling
        setMode("confirming");
        setMessage("Confirming your booking…");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, bookingId, flwTxRef, flwTransactionId, API, user]);

  /**
   * Step 1: Poll booking until webhook settles it (server is source of truth)
   * Prefer API: GET /api/bookings/:idOrRef (auth)
   * Fallback to Firestore read if API fails
   */
  useEffect(() => {
    stopRef.current = false;

    const idOrRef = bookingId || displayReference || "";
    if (!idOrRef) {
      setMode("failed");
      setMessage("We could not locate your booking. Please contact support with your reference.");
      return () => {};
    }

    let alive = true;

    const POLL_MS = 2000;
    const MAX_WAIT_MS = 90_000;
    const start = Date.now();

    async function fetchViaApi() {
      const token = await getIdTokenOrNull(false);
      if (!token) return { ok: false, reason: "no_token" };

      let res = await fetch(`${API}/bookings/${encodeURIComponent(idOrRef)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        const token2 = await getIdTokenOrNull(true);
        if (!token2) return { ok: false, reason: "no_token_refresh" };
        res = await fetch(`${API}/bookings/${encodeURIComponent(idOrRef)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token2}`, "Content-Type": "application/json" },
        });
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.booking) return { ok: false, reason: "api_failed", json };

      return { ok: true, booking: normalizeBookingShape(json.booking) };
    }

    async function fetchViaFirestore() {
      if (!bookingId) return { ok: false, reason: "no_bookingId_firestore" };
      try {
        const snap = await getDoc(doc(db, "bookings", bookingId));
        if (!snap.exists()) return { ok: false, reason: "not_found" };
        return { ok: true, booking: normalizeBookingShape({ id: snap.id, ...(snap.data() || {}) }) };
      } catch (e) {
        return { ok: false, reason: "firestore_failed", error: e };
      }
    }

    async function poll() {
      if (!alive || stopRef.current) return;

      let result = await fetchViaApi();

      if (!result.ok) {
        const fb = await fetchViaFirestore();
        if (fb.ok) result = fb;
      }

      if (result.ok && result.booking) {
        setBooking(result.booking);

        const { mode: nextMode, message: nextMsg } = deriveModeFromBooking(result.booking);
        setMode(nextMode);
        setMessage(nextMsg);

        if (nextMode === "success" || nextMode === "review") {
          stopRef.current = true;
          return;
        }
      } else {
        if (Date.now() - start > 15_000) {
          setMode("failed");
          setMessage("We could not confirm your booking record. If you paid, contact support with your reference.");
          stopRef.current = true;
          return;
        }
      }

      if (Date.now() - start > MAX_WAIT_MS) {
        setMode("review");
        setMessage("We’re still confirming this booking. Please check My Bookings shortly.");
        stopRef.current = true;
        return;
      }

      setTimeout(poll, POLL_MS);
    }

    poll();

    return () => {
      alive = false;
      stopRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, displayReference, API, user]);

  const heading = useMemo(() => {
    if (mode === "failed") return "Payment Not Confirmed";
    if (mode === "review") return "Confirming Your Booking";
    if (mode === "confirming") return "Confirming Booking";
    if (mode === "verifying") return "Verifying Payment";
    return "Booking Confirmed";
  }, [mode]);

  const badgeTone = useMemo(() => {
    if (mode === "failed") return "red";
    if (mode === "review") return "amber";
    if (mode === "verifying" || mode === "confirming") return "amber";
    return "emerald";
  }, [mode]);

  const icon = useMemo(() => {
    if (mode === "failed") return "!";
    if (mode === "review") return "…";
    if (mode === "verifying" || mode === "confirming") return "…";
    return "✓";
  }, [mode]);

  const showPulse = mode === "verifying" || mode === "confirming" || mode === "review";

  const bookingStatus = safeLower(booking?.status || "");
  const bookingGross = Number(booking?.amountN || 0);

  const footerCopy =
    "Contact details stay hidden by policy — they reveal only when booking rules and verification windows permit.";

  const canGoBookings = mode !== "verifying";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 pb-16">
      <div className="max-w-lg mx-auto rounded-3xl border border-white/10 bg-gradient-to-b from-black/30 via-black/25 to-black/60 p-8 text-center shadow-[0_35px_100px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Icon */}
        <div
          className={`w-20 h-20 mx-auto rounded-full grid place-items-center mb-6 ${
            badgeTone === "red"
              ? "bg-red-500/15 border border-red-400/40"
              : badgeTone === "amber"
              ? "bg-amber-500/15 border border-amber-400/40"
              : "bg-emerald-500/20 border border-emerald-400/40"
          } ${showPulse ? "animate-pulse" : ""}`}
          style={{
            boxShadow:
              badgeTone === "red"
                ? "0 10px 35px rgba(255,0,0,0.18)"
                : badgeTone === "amber"
                ? "0 10px 35px rgba(255,170,0,0.18)"
                : "0 10px 35px rgba(0,128,0,0.22)",
          }}
        >
          <span
            className={`text-3xl font-bold ${
              badgeTone === "red"
                ? "text-red-300"
                : badgeTone === "amber"
                ? "text-amber-200"
                : "text-emerald-300"
            }`}
          >
            {icon}
          </span>
        </div>

        {/* Heading */}
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{
            fontFamily:
              'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
          }}
        >
          {heading}
        </h1>

        <p className="text-gray-300 mt-3 text-sm leading-relaxed">
          {message || "We’re confirming your booking. If you were charged, your payment is safe."}
        </p>

        {/* Listing */}
        {listing ? (
          <p className="mt-5 text-sm text-gray-200">
            Listing: <span className="font-semibold text-amber-300">{listing.title}</span>
            {listing.area || listing.city ? (
              <span className="text-gray-400">
                {" "}
                • {listing.area || "—"}
                {listing.city ? `, ${listing.city}` : ""}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* Amount */}
        {bookingGross > 0 ? (
          <p className="mt-2 text-xs text-gray-400">
            Amount: <span className="text-white/80 font-semibold">{formatMoneyNGN(bookingGross)}</span>
          </p>
        ) : null}

        {/* Booking ID */}
        {booking?.id || bookingId ? (
          <p className="mt-1 text-xs text-gray-400">
            Booking ID: <span className="font-mono text-emerald-300">{booking?.id || bookingId}</span>
          </p>
        ) : null}

        {/* Payment reference */}
        {displayReference ? (
          <p className="mt-1 text-[11px] text-gray-500">
            Reference: <span className="font-mono">{displayReference}</span>
          </p>
        ) : null}

        {/* Flutterwave details */}
        {provider === "flutterwave" && (flwTxRef || flwTransactionId) ? (
          <p className="mt-1 text-[11px] text-gray-500">
            Flutterwave: <span className="font-mono">{flwTxRef || "—"}</span> • Tx:{" "}
            <span className="font-mono">{flwTransactionId || "—"}</span>
          </p>
        ) : null}

        {/* Booking status hint (soft) */}
        {bookingStatus ? (
          <p className="mt-3 text-[11px] text-white/45">
            Status:{" "}
            <span className="text-white/70">
              {bookingStatus === "confirmed" || bookingStatus === "completed"
                ? "Confirmed"
                : bookingStatus === "paid-needs-review"
                ? "Reviewing"
                : bookingStatus === "paid"
                ? "Payment detected"
                : bookingStatus}
            </span>
          </p>
        ) : null}

        {/* Buttons */}
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => nav("/bookings")}
            disabled={!canGoBookings}
            className={`px-6 py-2.5 rounded-full font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
              canGoBookings
                ? "bg-amber-500 hover:bg-amber-400 text-black"
                : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
            }`}
            title={!canGoBookings ? "Just a moment…" : "View your bookings"}
          >
            View My Bookings
          </button>

          <button
            onClick={() => nav("/explore")}
            className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
          >
            Continue Browsing
          </button>
        </div>

        <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">{footerCopy}</p>

        {(mode === "review" || mode === "failed") ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
            <p className="text-xs text-white/80 font-semibold">Need help?</p>
            <p className="mt-1 text-[11px] text-white/60 leading-relaxed">
              If you were charged, you are protected. Please keep your{" "}
              <span className="font-mono text-white/75">Reference</span> and contact support.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}