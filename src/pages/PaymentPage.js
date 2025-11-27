// src/pages/PaymentPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  createPendingBookingFS,
  markBookingConfirmedFS,
  markBookingFailedFS,
  getHoldFS,
  convertHoldFS,
} from "../api/bookings";

export default function PaymentPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();

  // From ReservePage
  const listing = state?.listing || null;
  const initialHold = state?.hold || null;
  const guests = state?.guests || 1;
  const nights = state?.nights || 1;
  const totalNaira = state?.totalNaira || (listing?.pricePerNight ? Number(listing.pricePerNight) * nights : 0);

  const [hold, setHold] = useState(initialHold);
  const [idType, setIdType] = useState("passport");
  const [idLast4, setIdLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  // Pull latest hold from Firestore (single read) to avoid clock skew
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!initialHold?.id) return;
      const fresh = await getHoldFS(initialHold.id);
      if (!alive) return;
      if (fresh) {
        setHold(fresh);
        const isExpired = Number(fresh.expiresAt || 0) <= Date.now() || fresh.status !== "active";
        setExpired(isExpired);
      } else {
        setExpired(true);
      }
    })();
    return () => { alive = false; };
  }, [initialHold?.id]);

  const timeLeft = useMemo(() => {
    if (!hold?.expiresAt) return 0;
    return Math.max(0, Math.floor((Number(hold.expiresAt) - Date.now()) / 1000));
  }, [hold?.expiresAt]);

  useEffect(() => {
    if (!timeLeft) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((Number(hold?.expiresAt || 0) - Date.now()) / 1000));
      if (left <= 0) {
        setExpired(true);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [hold?.expiresAt, timeLeft]);

  function validateQuickId() {
    if (!consent) return "Please consent to ID submission.";
    if (!idLast4 || idLast4.length < 4) return "Enter last 4 digits.";
    return null;
  }

  async function handlePaystack() {
    if (expired) { alert("This hold has expired. Please start a new reservation."); return; }
    const err = validateQuickId();
    if (err) { alert(err); return; }
    if (!user) { alert("Please log in first."); return; }

    try {
      setBusy(true);

      // 1. Create pending booking
      const bookingId = await createPendingBookingFS({
        listing,
        user,
        nights,
        amountN: totalNaira,
        idType,
        idLast4,
        consent,
      });

      // 2. Open Paystack
      const handler =
        window.PaystackPop &&
        window.PaystackPop.setup({
          key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
          email: user.email || "guest@example.com",
          amount: Math.round(Number(totalNaira) * 100),
          ref: `NESTA_${bookingId}_${Date.now()}`,
          onClose: async () => {
            await markBookingFailedFS(bookingId, "cancelled");
            setBusy(false);
          },
          callback: async (response) => {
            await markBookingConfirmedFS(bookingId, {
              provider: "paystack",
              reference: response?.reference || "",
            });
            // mark hold converted (non-blocking)
            if (hold?.id) await convertHoldFS(hold.id);
            setBusy(false);
            alert("Payment complete! 🎉");
            nav("/bookings", { replace: true });
          },
        });

      if (handler && handler.openIframe) {
        handler.openIframe();
      } else {
        await markBookingFailedFS(bookingId, "gateway_unavailable");
        setBusy(false);
        alert("Could not open Paystack. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setBusy(false);
      alert("Could not start payment. Please try again.");
    }
  }

  if (!user) {
    return (
      <main className="p-6 text-white">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6">
          Please sign in to pay.
        </div>
      </main>
    );
  }
  if (!listing || !hold) {
    return (
      <main className="p-6 text-white">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6">
          Reservation not found. Please start again.
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Checkout</h2>

        {expired && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            This 90-minute hold has expired. Please create a new reservation.
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-white/10 bg-gray-900/60 p-4">
          <div className="font-semibold">{listing.title || "Listing"}</div>
          <div className="text-gray-300">
            Nights: <b>{nights}</b> • Total: <b>₦{Number(totalNaira).toLocaleString()}</b>
          </div>
          {!expired && (
            <div className="mt-1 text-sm text-gray-400">
              Hold expires in ~ <b>{Math.floor(timeLeft / 60)}</b>m <b>{timeLeft % 60}</b>s
            </div>
          )}
        </div>

        <div className="mb-4">
          <h3 className="font-semibold">Quick ID Check</h3>
          <label className="block mb-2">
            ID Type
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="ml-2 text-black"
            >
              <option value="passport">Passport</option>
              <option value="nin">NIN</option>
              <option value="bvn">BVN</option>
            </select>
          </label>

          <label className="block mb-2">
            Last 4 digits
            <input
              type="text"
              maxLength={4}
              value={idLast4}
              onChange={(e) => setIdLast4(e.target.value)}
              className="ml-2 text-black"
            />
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            I consent to submit this ID
          </label>
        </div>

        <button
          onClick={handlePaystack}
          disabled={busy || expired}
          className="bg-green-600 px-4 py-2 rounded disabled:opacity-60"
        >
          {busy ? "Processing..." : "Pay with Paystack"}
        </button>
      </div>
    </main>
  );
} 
