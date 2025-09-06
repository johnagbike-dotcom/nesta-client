// src/pages/CheckoutPage.js
import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

const CheckoutPage = () => {
  const { id } = useParams();

  // --- Form state ---
  const [email, setEmail] = useState("");
  const [nights, setNights] = useState(1);
  const [saving, setSaving] = useState(false);

  // --- Env vars (.env.local) ---
  const paystackKey = process.env.REACT_APP_PAYSTACK_PK;     // pk_test_...
  const flutterwaveKey = process.env.REACT_APP_FLW_PK || "";  // optional for now
  const apiBase = process.env.REACT_APP_API_BASE || "http://localhost:4000";

  // --- Mock listing (replace with Firestore fetch later) ---
  const listing = useMemo(
    () => ({ id, title: "Room in Ikeja GRA", pricePerNight: 20000 }),
    [id]
  );

  const total = useMemo(
    () => Number(listing.pricePerNight) * Number(nights || 0),
    [listing.pricePerNight, nights]
  );

  const emailValid =
    email.length > 3 && email.includes("@") && email.includes(".");

  // --- Helpers ---
  const saveBooking = async ({ provider, reference, n, amt }) => {
    try {
      setSaving(true);
      const res = await fetch(`${apiBase}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          title: listing.title,
          nights: n,
          total: amt,
          email,
          reference,
          provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        alert(`Booking saved! id: ${data.id}`);
      } else {
        alert("Payment ok, but saving the booking failed. Check server logs.");
        console.error("Booking save error:", data);
      }
    } catch (err) {
      console.error(err);
      alert("Payment ok, but a network error occurred while saving the booking.");
    } finally {
      setSaving(false);
    }
  };

  // --- Paystack flow ---
  const openPaystack = () => {
    if (!paystackKey) {
      alert("Paystack key missing. Add REACT_APP_PAYSTACK_PK to .env.local and restart.");
      return;
    }
    if (!emailValid) {
      alert("Please enter a valid email for the receipt.");
      return;
    }
    const n = Number(nights);
    if (!Number.isFinite(n) || n < 1) {
      alert("Nights must be at least 1.");
      return;
    }
    const amt = Number(listing.pricePerNight) * n;
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Amount is invalid.");
      return;
    }
    if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
      alert("Paystack script not loaded. Ensure the script tag is in public/index.html.");
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email,
      amount: amt * 100, // kobo
      currency: "NGN",
      ref: `${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: "Listing", variable_name: "listing", value: listing.title },
          { display_name: "Nights", variable_name: "nights", value: String(n) },
        ],
      },
      // ✅ The callback must be a valid function directly in the setup config
      callback: async (response) => {
        const reference = response?.reference || "";
        await saveBooking({ provider: "paystack", reference, n, amt });
      },
      onClose: () => {
        alert("Transaction was not completed, window closed.");
      },
    });

    handler.openIframe();
  };

  // --- Flutterwave flow (optional for now) ---
  const openFlutterwave = () => {
    if (!flutterwaveKey.startsWith("FLWPUBK")) {
      alert("Flutterwave isn’t configured yet. We’ll enable this later.");
      return;
    }
    if (!emailValid) {
      alert("Please enter a valid email for the receipt.");
      return;
    }
    const n = Number(nights);
    const amt = Number(listing.pricePerNight) * n;

    // eslint-disable-next-line no-undef
    window.FlutterwaveCheckout({
      public_key: flutterwaveKey,
      tx_ref: `flw_${Date.now()}`,
      amount: amt,
      currency: "NGN",
      payment_options: "card,ussd,banktransfer",
      customer: { email },
      callback: async (flwResponse) => {
        const reference = flwResponse?.transaction_id || "";
        await saveBooking({ provider: "flutterwave", reference, n, amt });
      },
      onclose: () => {},
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Link to={`/listing/${id}`} className="text-purple-400 underline block mb-4">
        ← Back to {listing.title}
      </Link>

      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      <p className="mb-2">
        You’re booking: <span className="font-semibold">{listing.title}</span>
      </p>
      <p className="mb-2">Price per night: ₦{listing.pricePerNight.toLocaleString()}</p>

      <label className="block mt-4">
        Email (for receipt):
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full p-2 mt-1 bg-gray-800 border border-gray-600 rounded"
          placeholder="you@example.com"
        />
      </label>

      <label className="block mt-4">
        Nights:
        <input
          type="number"
          value={nights}
          min="1"
          onChange={(e) => setNights(Number(e.target.value))}
          className="block w-24 p-2 mt-1 bg-gray-800 border border-gray-600 rounded"
        />
      </label>

      <p className="mt-4 text-lg">
        <strong>Total:</strong> ₦{(isFinite(total) ? total : 0).toLocaleString()}
      </p>

      <div className="mt-6 flex gap-4 items-center">
        {paystackKey ? (
          <button
            onClick={openPaystack}
            disabled={!emailValid || !nights || nights < 1 || saving}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Saving…" : "Pay with Paystack"}
          </button>
        ) : (
          <p className="text-sm text-red-400">⚠️ Paystack not configured.</p>
        )}

        {flutterwaveKey && flutterwaveKey.startsWith("FLWPUBK") ? (
          <button
            onClick={openFlutterwave}
            disabled={!emailValid || !nights || nights < 1 || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Pay with Flutterwave
          </button>
        ) : (
          <p className="text-sm text-yellow-400">⚠️ Flutterwave placeholder (not yet active).</p>
        )}
      </div>

      <p className="mt-8 text-sm text-gray-400">
        Sandbox mode. In production you must verify the transaction server-side before confirming a booking.
      </p>
    </div>
  );
};

export default CheckoutPage;