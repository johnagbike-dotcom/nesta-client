// src/components/CheckoutButtons.jsx
import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * CheckoutButtons (Guest CTA)
 * - SINGLE action only: Reserve / Book
 * - Paystack is handled inside ReservePage (step 3).
 *
 * Backward compatible with older props:
 *  - listing (object) + nights + email
 *
 * New preferred props:
 *  - listingId (string), title, amountN (number), city, area
 */
export default function CheckoutButtons({
  // NEW style
  listingId,
  title,
  amountN,
  city,
  area,

  // OLD style (backward compat)
  listing,
  nights = 1,
  email,
}) {
  const nav = useNavigate();
  const { user } = useAuth();

  // Resolve listing id from either prop style
  const resolvedId =
    listingId ||
    listing?.id ||
    listing?.listingId ||
    listing?._id ||
    null;

  // Resolve title/price from either prop style
  const resolvedTitle = title || listing?.title || "Listing";

  // If old style passed listing.price, treat as per-night
  const perNightFromListing =
    Number(listing?.pricePerNight || listing?.price || 0);

  const computedAmount = useMemo(() => {
    // if amountN explicitly provided, use it
    if (Number.isFinite(Number(amountN))) return Number(amountN);

    // else compute from listing price * nights (old behaviour)
    const qty = Math.max(1, Number(nights) || 1);
    return Math.max(perNightFromListing * qty, 0);
  }, [amountN, nights, perNightFromListing]);

  const resolvedCity = city || listing?.city || "";
  const resolvedArea = area || listing?.area || "";

  const goReserve = useCallback(() => {
    if (!resolvedId) {
      alert("Listing ID missing — cannot open reservation.");
      return;
    }

    const statePayload = {
      id: resolvedId,
      title: resolvedTitle,
      price: computedAmount, // ReservePage treats this as baseline price (it will refetch anyway if needed)
      city: resolvedCity,
      area: resolvedArea,
      hostId:
        listing?.partnerUid ||
        listing?.partnerId ||
        listing?.hostId ||
        listing?.hostUid ||
        listing?.ownerId ||
        listing?.ownerUid ||
        null,
      email: email || user?.email || null,
    };

    // If not logged in, go login first and return to reserve flow
    if (!user) {
      nav("/login", {
        state: {
          from: `/reserve/${resolvedId}`,
          intent: "reserve",
          listing: statePayload,
        },
      });
      return;
    }

    nav(`/reserve/${resolvedId}`, { state: statePayload });
  }, [
    resolvedId,
    resolvedTitle,
    computedAmount,
    resolvedCity,
    resolvedArea,
    listing,
    email,
    user,
    nav,
  ]);

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button
        onClick={goReserve}
        className="px-5 py-2 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500 transition shadow-[0_12px_40px_rgba(0,0,0,.65)] text-sm"
      >
        Reserve / Book
      </button>
    </div>
  );
}
