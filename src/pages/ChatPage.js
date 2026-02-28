// src/pages/ChatPage.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import "../styles/polish.css";
import "../styles/motion.css";

/**
 * ✅ Chat enabled default:
 * - If env is missing, chat is ON (prevents accidental production disable).
 * - Only OFF when REACT_APP_CHAT_ENABLED explicitly set to "false".
 */
const CHAT_ENABLED =
  String(process.env.REACT_APP_CHAT_ENABLED || "")
    .trim()
    .toLowerCase() !== "false";

const QUICK_GUEST = [
  "Hello 👋",
  "Is this place available on my dates?",
  "Can I get a flexible check-in?",
  "Please share house rules.",
];
const QUICK_HOST = [
  "Hi there 👋 How can I help?",
  "Your dates are available ✅",
  "Check-in is from 2pm; we can be flexible.",
  "Here are the house rules:",
];
const QUICK_PARTNER = [
  "Hello 👋 thanks for your interest.",
  "We manage similar properties if you’d like options.",
  "Corporate/long-stay rates are available.",
  "I’ll share the application/verification steps.",
];

const ONLINE_WINDOW_MS = 60 * 1000;

function stableChatId(listingId, a, b) {
  const [x, y] = [a, b].sort();
  return `l:${listingId}::u:${x}::v:${y}`;
}

function safeMillis(ts) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    const d = new Date(ts);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function safeStr(v) {
  return String(v ?? "").trim();
}
function safeLower(v) {
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

export default function ChatPage() {
  const nav = useNavigate();
  const params = useParams();
  const { state } = useLocation();

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const myRole = (profile?.role || "").toLowerCase();
  const QUICK =
    !myRole || myRole === "guest"
      ? QUICK_GUEST
      : myRole.includes("host")
      ? QUICK_HOST
      : QUICK_PARTNER;

  // Supports:
  // - /chat (expects state)
  // - /chat/:uid (paramUid)
  // - /booking/:bookingId/chat (bookingId)
  const forcedChatId = state?.chatId || state?.threadId || null;
  const paramUid = params?.uid || null;
  const bookingIdParam = params?.bookingId || null;

  const partnerUidFromState = state?.partnerUid || paramUid || null;
  const listingFromState = state?.listing || null; // { id, title }

  const [chatId, setChatId] = useState(forcedChatId || null);
  const [headerTitle, setHeaderTitle] = useState("Chat");

  // ✅ MUST be mutable (so booking/:bookingId/chat can hydrate)
  const [counterUid, setCounterUid] = useState(partnerUidFromState);
  const [listing, setListing] = useState(listingFromState);

  const [chatMeta, setChatMeta] = useState(null);
  const [counterProfile, setCounterProfile] = useState(null);
  const [counterPresence, setCounterPresence] = useState({
    typing: false,
    updatedAt: null,
  });

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");

  const listRef = useRef(null);
  const otherIdRef = useRef(null);
  const typingIdleRef = useRef(null);
  const myPresenceRef = useRef(null);
  const otherPresenceRef = useRef(null);

  // ✅ If opened via /booking/:bookingId/chat, hydrate listing + partnerUid from booking
  useEffect(() => {
    let alive = true;

    async function hydrateFromBooking() {
      if (!CHAT_ENABLED) return;
      if (!user?.uid) return;
      if (!bookingIdParam) return;

      // If we already have both, no need.
      if (counterUid && listing?.id) return;

      try {
        setPageError("");

        // Prefer API (so it matches your server truth), fallback to Firestore
        const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
        const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

        let booking = null;

        const token = await getBearerToken();
        if (token) {
          const res = await fetch(`${API}/bookings/${encodeURIComponent(bookingIdParam)}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => null);
          booking = json?.booking || json?.data || json || null;
        }

        if (!booking) {
          // Firestore fallback
          const snap = await getDoc(doc(db, "bookings", String(bookingIdParam)));
          booking = snap.exists() ? { id: snap.id, ...(snap.data() || {}) } : null;
        }

        if (!booking) throw new Error("booking_not_found");

        const listingId = booking.listingId || booking?.listing?.id || null;
        const listingTitle = booking.listingTitle || booking?.listing?.title || "Listing";

        // host vs partner resolution
        const ownership = safeLower(booking.ownershipType || "");
        const counterpartUid =
          ownership === "host"
            ? booking.ownerId || booking.hostId || booking.partnerUid || null
            : booking.partnerUid || booking.ownerId || booking.hostId || null;

        if (!listingId || !counterpartUid) throw new Error("booking_missing_chat_fields");

        if (!alive) return;
        setListing({ id: String(listingId), title: listingTitle });
        setCounterUid(String(counterpartUid));
      } catch (e) {
        console.error("[ChatPage] hydrateFromBooking failed:", e);
        if (!alive) return;
        setPageError("Couldn’t open messages for this booking. Please try again.");
      }
    }

    hydrateFromBooking();
    return () => {
      alive = false;
    };
  }, [bookingIdParam, user?.uid, counterUid, listing?.id]);

  const canRunChat = useMemo(() => {
    if (!CHAT_ENABLED) return false;
    if (!user?.uid) return false;
    if (forcedChatId) return true;
    return !!(counterUid && listing?.id);
  }, [user?.uid, forcedChatId, counterUid, listing?.id]);

  const scrollToBottom = useCallback(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const presenceLabel = useMemo(() => {
    if (counterPresence.typing) return "Typing…";
    const updatedAt = counterPresence.updatedAt;
    if (!updatedAt) return "Offline";
    const ts =
      typeof updatedAt?.toDate === "function"
        ? updatedAt.toDate().getTime()
        : typeof updatedAt === "number"
        ? updatedAt
        : 0;
    const now = Date.now();
    return ts && now - ts < ONLINE_WINDOW_MS ? "Online" : "Last seen recently";
  }, [counterPresence]);

  const lastMineMsg = useMemo(() => {
    const myId = user?.uid;
    if (!myId || !messages?.length) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.senderId === myId) return messages[i];
    }
    return null;
  }, [messages, user?.uid]);

  const otherIdForSeen = otherIdRef.current || null;
  const otherLastReadMs = otherIdForSeen
    ? safeMillis(chatMeta?.lastReadAt?.[otherIdForSeen])
    : 0;
  const lastMineCreatedMs = safeMillis(lastMineMsg?.createdAt);
  const showSeen =
    !!lastMineMsg &&
    otherLastReadMs > 0 &&
    lastMineCreatedMs > 0 &&
    otherLastReadMs >= lastMineCreatedMs;

  // ✅ Archive gate
  const isArchivedForMe = useMemo(() => {
    if (!user?.uid) return false;
    return !!chatMeta?.archived?.[user.uid];
  }, [chatMeta, user?.uid]);

  const inputDisabled = !chatId || busy || isArchivedForMe;

  // Resolve/create thread
  useEffect(() => {
    let cancelled = false;

    async function resolveThread() {
      if (!canRunChat) return;

      try {
        setPageError("");

        if (forcedChatId) {
          if (!cancelled) setChatId(forcedChatId);
          return;
        }

        const id = stableChatId(listing.id, user.uid, counterUid);
        const ref = doc(db, "chats", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            participants: [user.uid, counterUid],
            listingId: listing.id,
            listingTitle: listing.title || "Listing",
            archived: {},
            pinned: {},
            lastReadAt: {},
            unreadFor: [],
            lastMessage: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (!cancelled) {
          setChatId(id);
          setHeaderTitle(listing.title || "Chat");
        }
      } catch (e) {
        console.error("Resolve/create chat failed:", e);
        if (!cancelled) setPageError("Couldn’t open messages. Please try again.");
      }
    }

    resolveThread();
    return () => {
      cancelled = true;
    };
  }, [canRunChat, forcedChatId, user?.uid, counterUid, listing?.id, listing?.title, listing]);

  // Chat doc listener
  useEffect(() => {
    if (!canRunChat || !chatId) return;

    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(
      chatRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() || {};
        setChatMeta(d);
        setHeaderTitle(d.listingTitle || "Chat");

        const parts = Array.isArray(d.participants) ? d.participants : [];
        const otherId = parts.find((p) => p !== user.uid) || counterUid || null;
        otherIdRef.current = otherId;

        myPresenceRef.current = doc(db, "chats", chatId, "presence", user.uid);
        otherPresenceRef.current = otherId
          ? doc(db, "chats", chatId, "presence", otherId)
          : null;

        if (Array.isArray(d.unreadFor) && d.unreadFor.includes(user.uid)) {
          updateDoc(chatRef, { unreadFor: arrayRemove(user.uid) }).catch(() => {});
        }
      },
      (e) => {
        console.error("chat doc listen:", e);
        setPageError("Messages failed to load. Please try again.");
      }
    );

    return () => unsub();
  }, [canRunChat, chatId, user?.uid, counterUid]);

  // Other presence listener
  useEffect(() => {
    if (!canRunChat || !chatId) return;

    let unsubPresence = () => {};
    if (otherPresenceRef.current) {
      unsubPresence = onSnapshot(
        otherPresenceRef.current,
        (ps) => {
          const data = ps.data() || {};
          setCounterPresence({
            typing: !!data.typing,
            updatedAt: data.updatedAt || null,
          });
        },
        () => setCounterPresence({ typing: false, updatedAt: null })
      );
    }

    return () => {
      setCounterPresence({ typing: false, updatedAt: null });
      clearTimeout(typingIdleRef.current);
      unsubPresence();
    };
  }, [canRunChat, chatId]);

  // Load counter profile
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!canRunChat || !counterUid) return;
      try {
        const snap = await getDoc(doc(db, "users_public", counterUid));
        if (!alive) return;
        setCounterProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("loadCounterProfile:", e);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [canRunChat, counterUid]);

  // Messages listener
  useEffect(() => {
    if (!canRunChat || !chatId) return;

    const qRef = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTimeout(scrollToBottom, 0);
      },
      (err) => console.error(err)
    );

    return () => unsub();
  }, [canRunChat, chatId, scrollToBottom]);

  // Update lastReadAt (skip if archived)
  useEffect(() => {
    if (!canRunChat || !chatId || !user?.uid) return;

    const t = setInterval(() => {
      if (isArchivedForMe) return;
      updateDoc(doc(db, "chats", chatId), {
        [`lastReadAt.${user.uid}`]: serverTimestamp(),
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(t);
  }, [canRunChat, chatId, user?.uid, isArchivedForMe]);

  const onSend = useCallback(async () => {
    if (!canRunChat || !user?.uid || !chatId) return;

    if (isArchivedForMe) {
      setPageError(
        "This conversation is archived. Your stay has ended. For follow-ups, please contact support."
      );
      return;
    }

    const text = message.trim();
    if (!text) return;

    const otherId = otherIdRef.current || counterUid || null;

    try {
      setBusy(true);
      setPageError("");

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        threadId: chatId,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: { text, senderId: user.uid, createdAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
        [`lastReadAt.${user.uid}`]: serverTimestamp(),
        ...(otherId ? { unreadFor: arrayUnion(otherId) } : {}),
      });

      setMessage("");
      setTimeout(scrollToBottom, 0);
    } catch (e) {
      console.error(e);
      setPageError("Couldn’t send message. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [canRunChat, user?.uid, chatId, message, scrollToBottom, counterUid, isArchivedForMe]);

  const onChangeMessage = (e) => {
    const v = e.target.value;
    setMessage(v);

    if (isArchivedForMe) return;
    if (!canRunChat || !myPresenceRef.current || !user?.uid) return;

    setDoc(
      myPresenceRef.current,
      { typing: true, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});

    clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => {
      setDoc(
        myPresenceRef.current,
        { typing: false, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }, 1300);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const quick = (t) => {
    if (isArchivedForMe) {
      setPageError(
        "This conversation is archived. Your stay has ended. For follow-ups, please contact support."
      );
      return;
    }
    setMessage(t);
    setTimeout(onSend, 20);
  };

  // RENDER

  if (!CHAT_ENABLED) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 motion-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6 motion-pop">
          <h1 className="text-xl font-extrabold tracking-tight">Messaging</h1>
          <p className="text-white/70 mt-2 text-sm leading-relaxed">
            Messaging is currently unavailable.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => nav(-1)}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              ← Go back
            </button>
            <button
              onClick={() => nav("/explore")}
              className="px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
            >
              Explore stays
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Messages</h2>
          <p className="text-gray-300">Please sign in to view messages.</p>
        </div>
      </main>
    );
  }

  if (!forcedChatId && (!counterUid || !listing?.id)) {
    return (
      <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Messages</h2>
          <p className="text-gray-300">Open a conversation from your Bookings.</p>
          {pageError ? (
            <div className="mt-3 text-sm text-rose-200">{pageError}</div>
          ) : null}
        </div>
      </main>
    );
  }

  const counterDisplayName =
    counterProfile?.displayName ||
    counterProfile?.name ||
    counterProfile?.email ||
    "Host/Partner";
  const avatarUrl =
    counterProfile?.photoURL ||
    counterProfile?.avatarUrl ||
    counterProfile?.avatar ||
    null;

  return (
    <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3 motion-slide-up">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-3">
              <span className="truncate">{headerTitle || "Messages"}</span>
            </h1>

            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-black/30">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={counterDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-amber-200 font-bold">
                      {(counterDisplayName || "H").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      counterPresence.typing
                        ? "bg-amber-300"
                        : presenceLabel === "Online"
                        ? "bg-emerald-400"
                        : "bg-gray-500"
                    }`}
                  />
                  {presenceLabel}
                </span>
                <span className="opacity-80 truncate max-w-[160px]">
                  • {counterDisplayName}
                </span>
              </span>
              {showSeen ? <span className="text-amber-300/80">• Seen</span> : null}
            </div>
          </div>

          <button
            onClick={() => nav(-1)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
          >
            ← Back
          </button>
        </div>

        {pageError ? (
          <div className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {pageError}
          </div>
        ) : null}

        {isArchivedForMe ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 motion-pop">
            This conversation is archived. Your stay has ended. For follow-ups, please contact support.
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden motion-pop">
          <div
            ref={listRef}
            className="h-[460px] overflow-y-auto p-4 nesta-chat-scroll"
            style={{ scrollBehavior: "smooth" }}
          >
            {messages.length === 0 ? (
              <div className="text-gray-300 text-sm">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user.uid;
                return (
                  <div
                    key={m.id}
                    className={`mb-2 flex ${mine ? "justify-end" : "justify-start"} motion-stagger`}
                  >
                    <div className="max-w-[78%] group motion-pop">
                      <div className={`nesta-bubble ${mine ? "mine" : "theirs"}`}>
                        <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      </div>
                      <div className="nesta-stamp">
                        {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 p-3 bg-gray-900/70">
            {!isArchivedForMe && counterPresence.typing ? (
              <div className="mt-1 text-xs text-amber-300 animate-pulse">Typing…</div>
            ) : null}

            <div className="flex gap-2">
              <input
                value={message}
                onChange={onChangeMessage}
                onKeyDown={onKeyDown}
                placeholder={isArchivedForMe ? "Archived conversation (read-only)" : "Type a message…"}
                disabled={inputDisabled}
                className={`flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 outline-none lux-focus ${
                  inputDisabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />

              <button
                disabled={!message.trim() || inputDisabled}
                onClick={onSend}
                className={`px-4 py-2 rounded-xl border ${
                  !message.trim() || inputDisabled
                    ? "bg-gray-800/60 border-white/10 text-gray-500 cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700 border-amber-500 text-black font-semibold btn-amber"
                }`}
              >
                Send
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => quick(q)}
                  disabled={isArchivedForMe || busy || !chatId}
                  className={`text-xs px-2 py-1 rounded-full border motion-pop ${
                    isArchivedForMe || busy || !chatId
                      ? "bg-white/5 border-white/10 text-white/35 cursor-not-allowed"
                      : "bg-white/10 hover:bg-white/15 border-white/15"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 mt-3 motion-slide-up">
          Contact details stay hidden by policy; they reveal only when booking status and subscription permit.
        </div>
      </div>
    </main>
  );
}