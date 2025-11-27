// src/components/CheckoutButtons.jsx
import React, { useMemo, useState, useCallback } from "react";

/** ENV + defaults */
const API_BASE =
  process.env.REACT_APP_API_BASE?.replace(/\/+$/, "") || "http://localhost:4000/api";
const PAYSTACK_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || "";
const FLW_KEY = process.env.REACT_APP_FLW_PUBLIC_KEY || "";
const SANDBOX = String(process.env.REACT_APP_SANDBOX || "1") === "1";

export default function CheckoutButtons({ listing, nights = 1, email }) {
  const [busy, setBusy] = useState(false);

  const safeEmail = email || "guest@example.com";
  const priceN = Number(listing?.price || 0);
  const qty = Math.max(1, Number(nights) || 1);
  const amountN = useMemo(() => priceN * qty, [priceN, qty]);

  /**
   * Save a booking to our API before opening any gateway.
   * NOTE: API_BASE is a module constant; it must NOT be a dependency.
   */
  const saveBooking = useCallback(
    async (provider, reference) => {
      const body = {
        email: safeEmail,
        title: listing?.title || "Unknown stay",
        nights: qty,
        amountN,
        provider,
        reference,
      };

      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Save booking failed: ${txt}`);
      }
      return res.json();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amountN, qty, safeEmail, listing?.title]
  );

  /** ---------------- PAYSTACK ---------------- */
  const onPaystack = useCallback(async () => {
    try {
      if (!amountN || amountN <= 0) {
        alert("Invalid amount — cannot start Paystack checkout.");
        return;
      }
      setBusy(true);

      const pendingRef = `PST_${Date.now()}`;
      await saveBooking("paystack", pendingRef);

      // sandbox or missing key -> simulate success
      if (!PAYSTACK_KEY || SANDBOX) {
        console.info("[Paystack] SANDBOX success for", pendingRef);
        alert("Paystack success — booking recorded.");
        setBusy(false);
        return;
      }

      if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
        setBusy(false);
        alert("Paystack library not loaded.");
        return;
      }

      const amountKobo = Math.round(amountN * 100);

      // Explicit functions so SDK never receives undefined
      const handleSuccess = (response) => {
        console.log("[Paystack] success:", response);
        alert("Paystack success — booking recorded.");
        setBusy(false);
      };
      const handleClose = () => {
        console.log("[Paystack] popup closed");
        setBusy(false);
      };

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: safeEmail,
        amount: amountKobo, // in kobo
        currency: "NGN",
        ref: pendingRef,
        callback: handleSuccess,
        onClose: handleClose,
        metadata: {
          custom_fields: [
            {
              display_name: "Stay",
              variable_name: "stay_title",
              value: listing?.title || "Unknown stay",
            },
            {
              display_name: "Nights",
              variable_name: "nights",
              value: String(qty),
            },
          ],
        },
      });

      if (handler && typeof handler.openIframe === "function") {
        handler.openIframe();
      } else {
        handleClose();
      }
    } catch (err) {
      console.error("[Paystack] error:", err);
      alert("Paystack error. Please try again.");
      setBusy(false);
    }
  }, [amountN, qty, saveBooking, safeEmail, listing?.title]);

 
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button
        onClick={onPaystack}
        disabled={busy}
        className="px-4 py-2 rounded bg-[#2563eb] disabled:opacity-60"
      >
        {busy ? "Please wait…" : "Pay with Paystack"}
      </button>
    </div>
  );
}