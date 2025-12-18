// src/pages/ChatStart.js
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * ChatStart
 * Supports legacy state shapes and routes users into the unified /chat page.
 * Expected (any of these):
 * location.state = { listingId, listingTitle, hostId }  (legacy)
 * location.state = { listing: {id,title}, partnerUid }  (new)
 */
export default function ChatStart() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const s = state || {};

    // legacy → normalize
    const listing =
      s.listing ||
      (s.listingId
        ? { id: s.listingId, title: s.listingTitle || "Listing" }
        : null);

    const partnerUid = s.partnerUid || s.hostId || s.uid || null;

    // Go to the unified chat page (ChatPage.js)
    nav("/chat", {
      replace: true,
      state: {
        ...(s || {}),
        listing,
        partnerUid,
        from: s.from || "chatstart",
      },
    });
  }, [user, state, nav]);

  return (
    <main className="min-h-[60vh] px-4 py-10 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d]">
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-xl font-bold mb-2">Chat</h2>
        <p className="text-gray-300">Preparing your conversation…</p>
      </div>
    </main>
  );
}
