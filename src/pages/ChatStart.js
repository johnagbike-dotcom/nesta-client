import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Landing screen for chat from a listing card.
 * Expects (optionally) location.state = { listingId, listingTitle, hostId }
 * If present, we push these along to /chat/thread so the thread can be created/resolved there.
 */
export default function ChatStart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // If we already have needed info, send the user to the thread UI immediately.
  useEffect(() => {
    if (!user) return; // ProtectedRoute should block unauth, but extra guard is fine

    const state = location.state || {};
    // Always navigate to /chat/thread; that screen will resolve/create the thread
    navigate("/chat/thread", { replace: true, state });
  }, [user, location.state, navigate]);

  return (
    <main className="container" style={{ padding: 24 }}>
      <h2>Chat</h2>
      <p className="muted">Preparing your chat room…</p>
    </main>
  );
}
