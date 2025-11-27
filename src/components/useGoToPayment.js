// src/components/useGoToPayment.js
import { useNavigate } from "react-router-dom";

/**
 * Persist a complete checkout payload and navigate to /payment.
 * Works even after refresh because we also write to sessionStorage.
 */
export default function useGoToPayment() {
  const navigate = useNavigate();

  return (listing) => {
    if (!listing) return;

    // Safe, minimal payload
    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

    const checkout = {
      listingId: listing.id || listing.slug || listing.docId || null,
      title: listing.title || listing.name || "Listing",
      city: listing.city || "",
      area: listing.area || "",
      pricePerNight: Number(listing.pricePerNight || listing.price || 0),
      imageUrl: listing.imageUrl || listing.cover || null,
      checkIn: (listing.checkIn || today.toISOString().slice(0, 10)),
      checkOut: (listing.checkOut || tomorrow.toISOString().slice(0, 10)),
      guests: Number(listing.guests || 1),
    };

    // Persist for reload survival
    sessionStorage.setItem("checkout", JSON.stringify(checkout));

    // Navigate with state (nice handoff without reload)
    navigate("/payment", { state: { checkout } });
  };
}
