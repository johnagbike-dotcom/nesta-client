// src/components/QuickReplies.js
import React from "react";

/**
* role: "guest" | "host" | "partner" | "admin"
* onPick: (text: string) => void
*/
export default function QuickReplies({ role = "guest", onPick }) {
  const isGuest = !role || role === "guest";
  const isHost = role === "host";
  const isPartner = role === "partner" || role === "verified_partner" || role === "partner_verified";
  const isAdmin = role === "admin";

  const GUEST = [
    "Is this place available on my dates?",
    "Can I get a flexible check-in?",
    "Please share house rules.",
    "Do you offer weekly/monthly discounts?",
  ];

  const HOST = [
    "Thanks for your message — those dates are available.",
    "Could you share your arrival time?",
    "Early check-in may be possible (fee applies).",
    "I’ll send access instructions a day before arrival.",
    "Please review the house rules above.",
  ];

  const PARTNER = [
    "Booking confirmed ✅",
    "Refund processed — expect credit in 3–7 business days.",
    "Dates not available — here are alternatives.",
    "Please share your arrival time for handover.",
    "Access details will be sent 24h before check-in.",
  ];

  const ADMIN = [
    "Thanks, our team will review and get back to you.",
    "We’ve logged this for follow-up.",
  ];

  const options = isGuest ? GUEST : isHost ? HOST : isPartner ? PARTNER : isAdmin ? ADMIN : GUEST;

  if (!options.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((t, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onPick?.(t)}
          className="px-3 py-1 rounded-full text-sm bg-[#1f2937] border border-white/10 hover:bg-[#374151] text-white"
          title={t}
        >
          {t}
        </button>
      ))}
    </div>
  );
} 