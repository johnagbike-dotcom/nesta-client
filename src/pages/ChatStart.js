// src/pages/ChatStart.js
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAuth } from "firebase/auth";

const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

function safeStr(v) {
  return String(v ?? "").trim();
}
function lower(v) {
  return safeStr(v).toLowerCase();
}

async function getBearerToken() {
  try {
    const auth = getAuth();
    return auth.currentUser ? await auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

export default function ChatStart() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { bookingId } = useParams();

  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setErr("");

      // If state already contains what ChatPage needs, forward immediately
      const s = state || {};
      const stateListing =
        s.listing ||
        (s.listingId ? { id: s.listingId, title: s.listingTitle || "Listing" } : null);

      const statePartnerUid = s.partnerUid || s.hostId || s.uid || null;

      if (stateListing?.id && statePartnerUid) {
        nav("/chat", {
          replace: true,
          state: {
            ...s,
            listing: stateListing,
            partnerUid: statePartnerUid,
            bookingId: s.bookingId || bookingId || null,
            from: s.from || "chatstart",
          },
        });
        return;
      }

      // Otherwise, load booking and derive partnerUid + listing
      const bid = safeStr(bookingId || s.bookingId || "");
      if (!bid) {
        if (alive) setErr("Missing bookingId.");
        return;
      }

      try {
        const token = await getBearerToken();
        const res = await fetch(`${API}/bookings/${encodeURIComponent(bid)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const b = json?.booking || json?.data || json || {};

        const listingId = safeStr(b.listingId || b.listing?.id || "");
        const title = safeStr(b.listingTitle || b.listing?.title || "Listing");

        const ownership = lower(b.ownershipType);
        const counterpartUid =
          ownership === "host"
            ? safeStr(b.ownerId || b.hostId || "")
            : safeStr(b.partnerUid || b.ownerId || b.hostId || "");

        if (!listingId || !counterpartUid) {
          if (alive) setErr("This booking is missing host/partner info.");
          return;
        }

        nav("/chat", {
          replace: true,
          state: {
            ...s,
            listing: { id: listingId, title },
            partnerUid: counterpartUid,
            bookingId: bid,
            from: "chatstart_booking",
          },
        });
      } catch {
        if (alive) setErr("Could not open messages for this booking.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav, state, bookingId]);

  return (
    <main className="min-h-[60vh] px-4 py-10 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d]">
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-xl font-bold mb-2">Chat</h2>
        {err ? (
          <p className="text-red-200 text-sm">{err}</p>
        ) : (
          <p className="text-gray-300">Preparing your conversation…</p>
        )}
      </div>
    </main>
  );
}