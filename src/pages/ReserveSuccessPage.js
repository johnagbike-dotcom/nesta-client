// src/pages/ReserveSuccessPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

function safeStr(v) {
  return String(v ?? "").trim();
}
function safeLower(v) {
  return safeStr(v).toLowerCase();
}

export default function ReserveSuccessPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // API base (same normalization style you used)
  const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
  const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

  // ----- From Paystack (state) -----
  const state = location.state || {};
  const stateBookingId = state?.bookingId || null;
  const stateListing = state?.listing || null;
  const stateProvider = safeLower(state?.provider || "");

  // ----- From Flutterwave (query) -----
  // Flutterwave typically returns: status, tx_ref, transaction_id
  const flwStatus = safeLower(searchParams.get("status") || searchParams.get("payment_status") || "");
  const flwTxRef = safeStr(searchParams.get("tx_ref") || searchParams.get("reference") || "");
  const flwTransactionId = safeStr(
    searchParams.get("transaction_id") ||
      searchParams.get("transactionId") ||
      searchParams.get("id") ||
      ""
  );

  // You built redirectUrl with these too (nice!)
  const qpBookingId = safeStr(searchParams.get("bookingId") || "");
  const qpListingId = safeStr(searchParams.get("listingId") || "");

  // Resolve bookingId in priority order
  const bookingId = stateBookingId || qpBookingId || null;

  const [listing, setListing] = useState(stateListing || null);

  // UI states
  const [mode, setMode] = useState("success"); // success | verifying | failed
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);

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

  // Determine which provider this success page is handling
  const provider = useMemo(() => {
    if (stateProvider) return stateProvider;
    if (flwTxRef || flwTransactionId || flwStatus) return "flutterwave";
    return "paystack";
  }, [stateProvider, flwTxRef, flwTransactionId, flwStatus]);

  async function getIdTokenOrNull() {
    try {
      if (!user) return "";
      return await user.getIdToken();
    } catch {
      return "";
    }
  }

  // Verify Flutterwave if needed (so success page is truthful)
  useEffect(() => {
    let alive = true;

    (async () => {
      // Paystack path (your Paystack flow already confirms in-app before navigating here)
      if (provider !== "flutterwave") {
        setMode("success");
        setMessage("Your reservation has been successfully secured.");
        return;
      }

      // Flutterwave path:
      // If flutterwave says not successful, show failed state.
      if (flwStatus && flwStatus !== "successful") {
        setMode("failed");
        setMessage("Payment was not successful. If you were charged, contact support with your reference.");
        return;
      }

      // Need a transaction id to verify reliably
      if (!flwTransactionId) {
        setMode("verifying");
        setMessage("Verifying payment…");
        // We can still try to continue but warn if missing
        setMode("failed");
        setMessage("We could not verify this payment (missing transaction id). Please contact support.");
        return;
      }

      setMode("verifying");
      setMessage("Verifying payment…");

      try {
        const token = await getIdTokenOrNull();
        if (!token) {
          setMode("failed");
          setMessage("Please log in again to confirm this payment.");
          return;
        }

        // Call your server verify endpoint (we'll add it below)
        const res = await fetch(`${API}/flutterwave/verify?transactionId=${encodeURIComponent(flwTransactionId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setMode("failed");
          setMessage(data?.message || "Payment verification failed.");
          return;
        }

        // Confirm it matches our tx_ref (prevents mismatched confirmations)
        const verifiedRef = safeStr(data?.tx_ref || data?.reference || "");
        if (flwTxRef && verifiedRef && flwTxRef !== verifiedRef) {
          setMode("failed");
          setMessage("Payment reference mismatch. Please contact support.");
          return;
        }

        // Mark booking as paid/confirmed in Firestore (recommended)
        if (bookingId) {
          try {
            await updateDoc(doc(db, "bookings", bookingId), {
              status: "paid",
              provider: "flutterwave",
              gateway: "flutterwave",
              paymentStatus: "paid",
              reference: flwTxRef || verifiedRef || null,
              flw: {
                transactionId: flwTransactionId,
                tx_ref: verifiedRef || flwTxRef || null,
              },
              updatedAt: serverTimestamp(),
              paidAt: serverTimestamp(),
            });
          } catch (e) {
            // non-blocking
            console.warn("[ReserveSuccess] booking update failed:", e);
          }
        }

        if (!alive) return;
        setVerified(true);
        setMode("success");
        setMessage("Payment verified ✅ Your reservation has been successfully secured.");
      } catch (e) {
        console.error("[ReserveSuccess] verify failed:", e);
        if (!alive) return;
        setMode("failed");
        setMessage("We could not verify this payment right now. Please contact support if you were charged.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [provider, flwStatus, flwTransactionId, flwTxRef, bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const heading = mode === "failed" ? "Payment Not Confirmed" : mode === "verifying" ? "Verifying Payment" : "Booking Confirmed";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 pb-16">
      <div className="max-w-lg mx-auto rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-emerald-500/10 via-black/20 to-black/60 p-8 text-center shadow-[0_35px_100px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Icon */}
        <div
          className={`w-20 h-20 mx-auto rounded-full grid place-items-center mb-6 shadow-[0_10px_35px_rgba(0,128,0,0.3)] ${
            mode === "failed"
              ? "bg-red-500/15 border border-red-400/40"
              : mode === "verifying"
              ? "bg-amber-500/15 border border-amber-400/40 animate-pulse"
              : "bg-emerald-500/20 border border-emerald-400/40"
          }`}
        >
          <span className={`text-3xl font-bold ${mode === "failed" ? "text-red-300" : mode === "verifying" ? "text-amber-200" : "text-emerald-300"}`}>
            {mode === "failed" ? "!" : mode === "verifying" ? "…" : "✓"}
          </span>
        </div>

        {/* Heading */}
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{
            fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
          }}
        >
          {heading}
        </h1>

        <p className="text-gray-300 mt-3 text-sm leading-relaxed">
          {message || "Your reservation has been successfully secured. Your host/partner will share check-in instructions shortly."}
        </p>

        {/* Listing */}
        {listing ? (
          <p className="mt-5 text-sm text-gray-200">
            Listing: <span className="font-semibold text-amber-300">{listing.title}</span>
          </p>
        ) : null}

        {/* Booking ref */}
        {bookingId ? (
          <p className="mt-1 text-xs text-gray-400">
            Reference: <span className="font-mono text-emerald-300">{bookingId}</span>
          </p>
        ) : null}

        {/* Flutterwave tx ref */}
        {provider === "flutterwave" && (flwTxRef || flwTransactionId) ? (
          <p className="mt-1 text-[11px] text-gray-500">
            Flutterwave: <span className="font-mono">{flwTxRef || "—"}</span> • Tx:{" "}
            <span className="font-mono">{flwTransactionId || "—"}</span>
          </p>
        ) : null}

        {/* Buttons */}
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => nav("/bookings")}
            className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            View My Bookings
          </button>

          {mode === "failed" ? (
            <button
              onClick={() => nav("/explore")}
              className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
            >
              Try another listing
            </button>
          ) : (
            <button
              onClick={() => nav("/explore")}
              className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
            >
              Continue Browsing
            </button>
          )}
        </div>

        <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
          Contact details stay hidden by policy — they reveal only when your booking status and host/partner subscription permit.
        </p>

        {provider === "flutterwave" && mode === "success" && verified && (
          <p className="mt-2 text-[11px] text-emerald-200/80">
            Payment verified server-side ✅
          </p>
        )}
      </div>
    </main>
  );
}
