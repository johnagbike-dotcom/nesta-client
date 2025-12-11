// src/pages/ChatRoom.js
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  getOrCreateThreadForBooking,
  subscribeToMessages,
  sendMessage,
} from "../api/chats";

/**
 * ChatRoom
 * - 1:1 thread between guest and host/partner, tied to a booking
 * - Everyone can chat (guest doesn’t need subscription)
 * - Phone/email for both sides are ONLY revealed when:
 *    • booking.status is confirmed/completed
 *    • the host/partner has an active subscription
 */

// Helper: safe get field from booking with multiple possible keys
function pick(b, keys, fallback = null) {
  if (!b) return fallback;
  for (const k of keys) {
    if (b[k] != null && b[k] !== "") return b[k];
  }
  return fallback;
}

export default function ChatRoom() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [booking, setBooking] = useState(null);
  const [listing, setListing] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [guestProfile, setGuestProfile] = useState(null);

  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // ---------------------------------------------------------------------------
  // Load booking + related data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!bookingId) return;
    if (!user) {
      setError("You must be signed in to view this chat.");
      setLoading(false);
      return;
    }

    let unsubMessages = null;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) Fetch booking
        const bSnap = await getDoc(doc(db, "bookings", bookingId));
        if (!bSnap.exists()) {
          setError("Booking not found.");
          setLoading(false);
          return;
        }
        const bData = { id: bSnap.id, ...bSnap.data() };
        if (cancelled) return;

        setBooking(bData);

        // Resolve IDs
        const guestId =
          pick(bData, ["guestId", "userId", "guestUid"]) || null;
        const hostId =
          pick(bData, ["hostId", "ownerId", "hostUid", "listingOwnerId"]) ||
          null;
        const listingId = pick(bData, ["listingId"]) || null;

        if (!guestId || !hostId || !listingId) {
          setError("Chat is missing booking or participant information.");
          setLoading(false);
          return;
        }

        // 2) Authorisation: must be guest, host or admin
        const isGuest = user.uid === guestId;
        const isHost = user.uid === hostId;
        if (!isGuest && !isHost && !isAdmin) {
          setError("You do not have permission to view this chat.");
          setLoading(false);
          return;
        }

        // 3) Load listing (for title/city)
        try {
          const lSnap = await getDoc(doc(db, "listings", listingId));
          if (lSnap.exists()) {
            setListing({ id: lSnap.id, ...lSnap.data() });
          }
        } catch (e) {
          console.warn("Failed to load listing for chat:", e);
        }

        // 4) Load host + guest profiles (for names + contact gating)
        try {
          const [hSnap, gSnap] = await Promise.all([
            getDoc(doc(db, "users", hostId)),
            getDoc(doc(db, "users", guestId)),
          ]);
          if (hSnap.exists()) setHostProfile({ id: hSnap.id, ...hSnap.data() });
          if (gSnap.exists()) setGuestProfile({ id: gSnap.id, ...gSnap.data() });
        } catch (e) {
          console.warn("Failed to load participant profiles:", e);
        }

        // 5) Ensure we have a thread and subscribe to messages
        const tId = await getOrCreateThreadForBooking({
          bookingId,
          listingId,
          guestId,
          hostId,
          listingTitle: bData.listingTitle || bData.title || "Chat",
        });
        if (cancelled) return;
        setThreadId(tId);

        unsubMessages = subscribeToMessages(tId, (msgs) => {
          if (!cancelled) setMessages(msgs);
        });

        setLoading(false);
      } catch (e) {
        console.error("ChatRoom init error:", e);
        if (!cancelled) {
          setError("We couldn’t load this chat.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsubMessages === "function") unsubMessages();
    };
  }, [bookingId, user, isAdmin]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isGuest = useMemo(() => {
    if (!booking || !user) return false;
    const guestId =
      pick(booking, ["guestId", "userId", "guestUid"]) || null;
    return user.uid === guestId;
  }, [booking, user]);

  const isHost = useMemo(() => {
    if (!booking || !user) return false;
    const hostId =
      pick(booking, [
        "hostId",
        "ownerId",
        "hostUid",
        "listingOwnerId",
      ]) || null;
    return user.uid === hostId;
  }, [booking, user]);

  const bookingStatus = (booking?.status || "").toLowerCase();
  const isConfirmedBooking = ["confirmed", "completed", "paid"].includes(
    bookingStatus
  );

  // Host subscription is the switch that unlocks contacts for BOTH sides
  const hostSubscribed = !!hostProfile?.activeSubscription;
  const canSeeContacts = isConfirmedBooking && hostSubscribed;

  // Who is counterpart for current user?
  const counterpartProfile = isHost ? guestProfile : hostProfile;
  const counterpartLabel = isHost ? "Guest" : "Host";

  const counterpartEmail = useMemo(() => {
    if (!counterpartProfile) return null;
    return counterpartProfile.email || counterpartProfile.emailLower || null;
  }, [counterpartProfile]);

  const counterpartPhone = useMemo(() => {
    if (!counterpartProfile) return null;
    return counterpartProfile.phone || counterpartProfile.phoneNumber || null;
  }, [counterpartProfile]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const handleSend = async (e) => {
    e.preventDefault();
    if (!threadId || !user) return;
    if (!text.trim()) return;

    // Only guest, host, or admin may send
    if (!isGuest && !isHost && !isAdmin) {
      alert("You’re not allowed to send messages in this chat.");
      return;
    }

    try {
      setSending(true);
      await sendMessage({
        threadId,
        text,
        senderId: user.uid,
      });
      setText("");
    } catch (e) {
      console.error(e);
      alert("Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!user) {
    return (
      <main className="container mx-auto px-4 py-6 text-slate-200">
        <button
          className="mb-4 rounded-full px-3 py-1 bg-slate-800/80 border border-slate-700"
          onClick={() => nav("/login")}
        >
          Sign in to view chat
        </button>
        <p>You need to be signed in to access this conversation.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6 text-slate-200">
        <button
          className="mb-4 rounded-full px-3 py-1 bg-slate-800/80 border border-slate-700"
          onClick={() => nav(-1)}
        >
          ← Back
        </button>
        <div className="animate-pulse">Loading chat…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-6 text-slate-200">
        <button
          className="mb-4 rounded-full px-3 py-1 bg-slate-800/80 border border-slate-700"
          onClick={() => nav(-1)}
        >
          ← Back
        </button>
        <div className="rounded-xl bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      </main>
    );
  }

  const listingTitle =
    listing?.title ||
    booking?.listingTitle ||
    booking?.title ||
    "Nesta stay";

  return (
    <main className="container mx-auto px-4 py-6 text-slate-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          className="rounded-full px-3 py-1 bg-slate-800/80 border border-slate-700 hover:bg-slate-700"
          onClick={() => nav(-1)}
        >
          ← Back
        </button>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Booking chat
          </div>
          <div className="text-lg font-semibold text-slate-50">
            {listingTitle}
          </div>
          <div className="text-xs text-slate-400">
            Status:{" "}
            <span className="capitalize">
              {bookingStatus || "pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Top Info Row: Contact gating + booking summary */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1.3fr)] mb-4">
        {/* Contact access card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {counterpartLabel} contact access
            </h2>
            {hostSubscribed ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/50 text-emerald-200">
                Host subscription active
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-100">
                Contacts locked
              </span>
            )}
          </div>

          {canSeeContacts ? (
            <>
              <p className="text-xs text-slate-400 mb-2">
                Because this booking is{" "}
                <span className="font-semibold">confirmed</span> and the host
                has an active subscription, Nesta safely reveals verified
                contact details for smoother coordination.
              </p>
              <div className="grid gap-2 text-sm">
                {counterpartEmail && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-16">Email</span>
                    <span className="font-mono text-slate-100">
                      {counterpartEmail}
                    </span>
                  </div>
                )}
                {counterpartPhone && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-16">Phone</span>
                    <span className="font-mono text-slate-100">
                      {counterpartPhone}
                    </span>
                  </div>
                )}
                {!counterpartEmail && !counterpartPhone && (
                  <p className="text-xs text-slate-400">
                    No additional contact details are on file yet.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">
                For safety and fairness, Nesta hides phone numbers and emails
                until a booking is confirmed and the host has an active
                subscription.
              </p>
              <ul className="text-xs text-slate-400 list-disc ml-4 space-y-1">
                <li>Guests can still chat freely on Nesta.</li>
                <li>
                  Once payment is confirmed, subscribed hosts unlock contact
                  details for both sides.
                </li>
              </ul>
            </>
          )}
        </div>

        {/* Booking summary card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs md:text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Booking summary</span>
            <span className="text-slate-300 font-medium">
              #{booking?.id?.slice?.(0, 6) || "—"}
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            {booking?.checkIn && booking?.checkOut && (
              <div className="flex justify-between">
                <span className="text-slate-400">Stay</span>
                <span>
                  {String(booking.checkIn).slice(0, 10)} →{" "}
                  {String(booking.checkOut).slice(0, 10)}
                </span>
              </div>
            )}
            {booking?.nights != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Nights</span>
                <span>{booking.nights}</span>
              </div>
            )}
            {booking?.amountN != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Total</span>
                <span>₦{Number(booking.amountN).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat body */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 flex flex-col h-[60vh] max-h-[640px]">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500">
              Start the conversation. Keep all coordination on Nesta — we’ll
              reveal contacts at the right time.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.uid;
              return (
                <div
                  key={m.id}
                  className={`flex ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "bg-amber-500 text-slate-900 rounded-br-sm"
                        : "bg-slate-800 text-slate-100 rounded-bl-sm",
                    ].join(" ")}
                  >
                    <div>{m.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="border-t border-slate-800 p-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-full bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
