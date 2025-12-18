// src/pages/ChatRoom.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/**
 * ChatRoom (legacy)
 * We now use ChatPage.js as the single chat UI.
 * This page only redirects legacy booking chat routes into /chat with bookingId state.
 */
export default function ChatRoom() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!user) return;
        if (!bookingId) {
          setErr("Missing booking id.");
          return;
        }

        // Optional: validate booking exists (prevents redirect loops)
        const snap = await getDoc(doc(db, "bookings", bookingId));
        if (!snap.exists()) {
          if (alive) setErr("Booking not found.");
          return;
        }

        nav("/chat", {
          replace: true,
          state: { bookingId, booking: { id: snap.id, ...snap.data() }, from: "chatroom_legacy" },
        });
      } catch (e) {
        console.error("ChatRoom redirect failed:", e);
        if (alive) setErr("Could not open chat.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, bookingId, nav]);

  if (!user) {
    return (
      <main className="min-h-[60vh] px-4 py-10 text-white bg-[#0f1419]">
        <div className="max-w-xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6">
          <h2 className="text-xl font-bold mb-2">Chat</h2>
          <p className="text-gray-300">Please sign in to continue.</p>
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-[60vh] px-4 py-10 text-white bg-[#0f1419]">
        <div className="max-w-xl mx-auto rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
          <h2 className="text-xl font-bold mb-2">Chat</h2>
          <p className="text-red-200">{err}</p>
          <button
            onClick={() => nav("/inbox")}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-black font-semibold"
          >
            Back to Inbox
          </button>
        </div>
      </main>
    );
  }

  return null;
}
