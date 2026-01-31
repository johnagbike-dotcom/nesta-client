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

function toMillis(v) {
  if (!v) return 0;
  try {
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function formatMoneyNGN(n) {
  const x = Math.round(Number(n || 0));
  return `₦${x.toLocaleString("en-NG")}`;
}

/**
 * Luxury-state machine (truthful):
 * - verifying: validating payment (Flutterwave verify endpoint) OR loading
 * - confirming: payment ok, waiting for webhook to set booking confirmed
 * - success: booking confirmed
 * - review: paid-needs-review / mismatch / requires attention
 * - failed: not successful / cannot verify / booking missing
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
  // Typical Flutterwave return: status, tx_ref, transaction_id
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
  const [verified, setVerified] = useState(false);

  const stopRef = useRef(false);

  // Determine provider this page is handling
  const provider = useMemo(() => {
    if (stateProvider) return stateProvider;
    if (flwTxRef || flwTransactionId || flwStatus) return "flutterwave";
    return "paystack";
  }, [stateProvider, flwTxRef, flwTransactionId, flwStatus]);

  // A “display reference” for UI
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

  // Step 1: Flutterwave verify (server-side) — only to confirm payment was successful.
  // We DO NOT mark booking as paid from client (webhook does settlement + commission).
  useEffect(() => {
    let alive = true;

    (async () => {
      // If Paystack, we assume payment succeeded because we navigated here after callback.
      // Still we wait for webhook to confirm the booking.
      if (provider !== "flutterwave") {
        setVerified(true);
        setMode("confirming");
        setMessage("Payment received ✅ Confirming your booking…");
        return;
      }

      // Flutterwave path
      // If flutterwave says not successful, show failed state.
      if (flwStatus && flwStatus !== "successful") {
        setMode("failed");
        setMessage(
          "Payment was not successful. If you were charged, contact support with your reference."
        );
        return;
      }

      // Need a transaction id to verify reliably
      if (!flwTransactionId) {
        setMode("failed");
        setMessage(
          "We could not verify this payment (missing transaction id). Please contact support."
        );
        return;
      }

      setMode("verifying");
      setMessage("Verifying payment…");

      try {
        // Need auth to call verify endpoint
        let token = await getIdTokenOrNull(false);
        if (!token) {
          setMode("failed");
          setMessage("Please log in again to confirm this payment.");
          return;
        }

        // Verify via server
        let res = await fetch(
          `${API}/flutterwave/verify?transactionId=${encodeURIComponent(flwTransactionId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 401) {
          token = await getIdTokenOrNull(true);
          res = await fetch(
            `${API}/flutterwave/verify?transactionId=${encodeURIComponent(flwTransactionId)}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        }

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setMode("failed");
          setMessage(data?.message || "Payment verification failed.");
          return;
        }

        // Confirm it matches our tx_ref where possible
        const verifiedRef = safeStr(data?.tx_ref || data?.reference || "");
        if (flwTxRef && verifiedRef && flwTxRef !== verifiedRef) {
          setMode("failed");
          setMessage("Payment reference mismatch. Please contact support.");
          return;
        }

        if (!alive) return;
        setVerified(true);
        setMode("confirming");
        setMessage("Payment verified ✅ Confirming your booking…");
      } catch (e) {
        console.error("[ReserveSuccess] verify failed:", e);
        if (!alive) return;
        setMode("failed");
        setMessage(
          "We could not verify this payment right now. Please contact support if you were charged."
        );
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, flwStatus, flwTransactionId, flwTxRef]);

  // Step 2: Poll booking doc until webhook settles it to confirmed (or review)
  useEffect(() => {
    stopRef.current = false;

    if (!bookingId) {
      // If we can't resolve bookingId, we can’t poll — show graceful state
      setMode("failed");
      setMessage("We could not locate your booking. Please contact support with your reference.");
      return () => {};
    }

    let alive = true;

    const POLL_MS = 2000;
    const MAX_WAIT_MS = 60_000; // 60s luxury window
    const start = Date.now();

    async function poll() {
      if (!alive || stopRef.current) return;

      try {
        const snap = await getDoc(doc(db, "bookings", bookingId));
        if (!alive || stopRef.current) return;

        if (!snap.exists()) {
          // Booking missing (rare) — keep calm, but stop soon
          setMode("failed");
          setMessage("Booking record not found. If you paid, contact support.");
          stopRef.current = true;
          return;
        }

        const d = snap.data() || {};
        setBooking({ id: snap.id, ...d });

        const status = safeLower(d.status || "");
        const paid = !!d.paid || safeLower(d.paymentStatus || "") === "paid";
        const mismatch = !!d.paymentMismatch || safeLower(d.status || "") === "paid-needs-review";
        const gateway = safeLower(d.gateway || "");
        const providerOnBooking = safeLower(d.provider || "");

        // Review / attention
        if (mismatch) {
          setMode("review");
          setMessage(
            "Payment received — we’re reviewing the details to confirm your booking. You will not be charged twice."
          );
          stopRef.current = true;
          return;
        }

        // Success target: confirmed (or completed)
        if (status === "confirmed" || status === "completed") {
          setMode("success");
          setMessage("Booking confirmed ✅ Your reservation is secured.");
          stopRef.current = true;
          return;
        }

        // Accept “paid” as an interim (but keep waiting for confirmed)
        if (paid || status === "paid" || gateway === "success") {
          // if someone accidentally sets paid, still wait for confirmed
          setMode("confirming");
          setMessage("Payment received ✅ Finalising your booking…");
        } else {
          // Still pending
          // Keep the messaging calm, don’t alarm
          setMode((m) => (m === "verifying" ? "verifying" : "confirming"));
          setMessage("Confirming your booking…");
        }

        // Guard: if provider mismatches (rare), move to review
        if (provider && providerOnBooking && providerOnBooking !== provider && status !== "confirmed") {
          setMode("review");
          setMessage(
            "We’re reviewing your payment provider details to confirm your booking. If you were charged, you're protected."
          );
          stopRef.current = true;
          return;
        }

        // timeout
        if (Date.now() - start > MAX_WAIT_MS) {
          setMode("review");
          setMessage(
            "We’re still confirming this booking. If you were charged, your payment is safe — please check your bookings in a minute."
          );
          stopRef.current = true;
          return;
        }
      } catch (e) {
        console.warn("[ReserveSuccess] booking poll failed:", e?.message || e);
        // Don’t fail hard on transient errors. Let it keep trying a bit.
      }

      setTimeout(poll, POLL_MS);
    }

    poll();

    return () => {
      alive = false;
      stopRef.current = true;
    };
  }, [bookingId, provider]);

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
  const bookingGross = Number(
    booking?.amountLockedN ?? booking?.amountPaidN ?? booking?.amountN ?? booking?.amount ?? 0
  );

  // Luxury copy: do not expose internal statuses too harshly; show “secured / confirming / reviewing”.
  const footerCopy =
    "Contact details stay hidden by policy — they reveal only when booking rules and verification windows permit.";

  const canGoBookings = mode !== "verifying"; // once we’ve progressed a bit

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
          {message ||
            "Your reservation has been secured. Your host/partner will share check-in instructions shortly."}
        </p>

        {/* Listing */}
        {listing ? (
          <p className="mt-5 text-sm text-gray-200">
            Listing:{" "}
            <span className="font-semibold text-amber-300">{listing.title}</span>
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

        {/* Booking ID (internal reference) */}
        {bookingId ? (
          <p className="mt-1 text-xs text-gray-400">
            Booking ID: <span className="font-mono text-emerald-300">{bookingId}</span>
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

        {/* Booking status hint (soft, luxury) */}
        {bookingStatus ? (
          <p className="mt-3 text-[11px] text-white/45">
            Status:{" "}
            <span className="text-white/70">
              {bookingStatus === "confirmed" || bookingStatus === "completed"
                ? "Confirmed"
                : bookingStatus === "paid-needs-review"
                ? "Reviewing"
                : bookingStatus === "paid"
                ? "Payment received"
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

        <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
          {footerCopy}
        </p>

        {/* Verified footer */}
        {provider === "flutterwave" && verified && mode !== "failed" ? (
          <p className="mt-2 text-[11px] text-emerald-200/80">
            Payment verified server-side ✅
          </p>
        ) : null}

        {/* Support hint for review/failed */}
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
