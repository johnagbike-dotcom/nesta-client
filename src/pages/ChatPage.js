// src/pages/ChatPage.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import "../styles/motion.css";

/* Quick replies per role */
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

// how long we consider a user "online" after last presence update
const ONLINE_WINDOW_MS = 60 * 1000;

export default function ChatPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const myRole = (profile?.role || "").toLowerCase();
  const isHost = myRole === "host" || myRole === "verified_host";
  const isPartner = myRole === "partner" || myRole === "verified_partner";
  const isGuest = !myRole || myRole === "guest";

  const QUICK = isGuest ? QUICK_GUEST : isHost ? QUICK_HOST : QUICK_PARTNER;

  const nav = useNavigate();
  const params = useParams();
  const { state } = useLocation();

  // Possible inputs
  const forcedChatId = state?.chatId || state?.threadId || null;
  // NOTE: earlier we allowed ":uid" in the route — we’ll still read it as a fallback
  const paramUid = params?.uid || null;
  const bookingFromState = state?.booking || null;
  const bookingIdFromState = state?.bookingId || null;
  const partnerUidFromState = state?.partnerUid || paramUid || null;
  const listingFromState = state?.listing || null; // { id, title }

  // Derivations
  const [chatId, setChatId] = useState(forcedChatId || null);
  const [headerTitle, setHeaderTitle] = useState("Chat with Host/Partner");
  const [counterUid, setCounterUid] = useState(null); // hostId / partnerUid
  const [counterRole, setCounterRole] = useState(null); // "host" | "partner" | "guest"
  const [listing, setListing] = useState(listingFromState || null); // { id, title }

  // NEW: counterparty profile
  const [counterProfile, setCounterProfile] = useState(null);
  const [counterPresence, setCounterPresence] = useState({
    typing: false,
    updatedAt: null,
  });

  // UI
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  // Refs
  const listRef = useRef(null);
  const otherIdRef = useRef(null);
  const typingIdleRef = useRef(null);
  const myPresenceRef = useRef(null);
  const otherPresenceRef = useRef(null);

  /* ---------------- helpers ---------------- */
  const scrollToBottom = useCallback(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const markLocalRead = useCallback(
    (id) => {
      try {
        if (!id || !user?.uid) return;
        const key = `nesta_chat_lastread_${user.uid}_${id}`;
        localStorage.setItem(key, Date.now().toString());
      } catch {}
    },
    [user?.uid]
  );

  const presenceLabel = useMemo(() => {
    // if typing, always show typing
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
    if (ts && now - ts < ONLINE_WINDOW_MS) {
      return "Online";
    }
    return "Last seen recently";
  }, [counterPresence]);

  /* -------- hydrate from booking / state (if no chatId) -------- */
  useEffect(() => {
    let alive = true;

    async function hydrateFromState() {
      try {
        if (forcedChatId) return;

        // CASE 1: user clicked "Chat host" from listing
        if (partnerUidFromState && listingFromState?.id) {
          if (alive) {
            setCounterUid(partnerUidFromState);
            setCounterRole("host"); // safe default; we can override later if profile says partner
            setListing(listingFromState);
            setHeaderTitle(listingFromState.title || "Chat with Host/Partner");
          }
          return;
        }

        // CASE 2: user clicked from booking
        let booking = bookingFromState || null;
        if (!booking && bookingIdFromState) {
          const snap = await getDoc(doc(db, "bookings", bookingIdFromState));
          if (snap.exists()) booking = { id: snap.id, ...snap.data() };
        }
        if (!booking) return;

        const ownership = (booking.ownershipType || "").toLowerCase();
        const nextCounterUid =
          ownership === "partner"
            ? booking.partnerUid || null
            : booking.ownerId || booking.hostId || null;

        const nextCounterRole = ownership === "partner" ? "partner" : "host";
        const nextListing = {
          id: booking.listingId || booking.listing?.id || null,
          title:
            booking.title ||
            booking.listingTitle ||
            booking.listing?.title ||
            "Listing",
        };

        if (!nextCounterUid || !nextListing.id) return;

        if (alive) {
          setCounterUid(nextCounterUid);
          setCounterRole(nextCounterRole);
          setListing(nextListing);
          setHeaderTitle(nextListing.title || "Chat with Host/Partner");
        }
      } catch (e) {
        console.error("hydrateFromState failed:", e);
      }
    }

    hydrateFromState();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    forcedChatId,
    bookingFromState,
    bookingIdFromState,
    partnerUidFromState,
    listingFromState,
  ]);

  /* ---------------- create/resolve thread ---------------- */
  const signature = useMemo(() => {
    if (!user?.uid || !counterUid) return null;
    const listingId = listing?.id || "";
    return `${user.uid}|${counterUid}|${listingId}`;
  }, [user?.uid, counterUid, listing?.id]);

  useEffect(() => {
    let cancelled = false;

    async function resolveThread() {
      try {
        // CASE: we were given a chat id directly from inbox
        if (forcedChatId) {
          if (!cancelled) setChatId(forcedChatId);
          return;
        }

        // if we still don't have the other party or listing, we cannot create yet
        if (!user?.uid || !counterUid || !listing?.id || !signature) return;

        // 1) try to find existing chat
        const q1 = query(
          collection(db, "chats"),
          where("signature", "==", signature)
        );
        const existing = await getDocs(q1);
        if (!existing.empty) {
          const found = existing.docs[0];
          if (!cancelled) {
            setChatId(found.id);
            setHeaderTitle(found.data()?.listingTitle || headerTitle);
          }
          return;
        }

        // 2) create a new thread
        const created = await addDoc(collection(db, "chats"), {
          participants: [user.uid, counterUid],
          listingId: listing.id,
          listingTitle: listing.title || "Listing",
          lastMessage: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          signature,
          counterpartRole: counterRole || "host",
          unreadFor: [],
        });

        if (!cancelled) {
          setChatId(created.id);
          setHeaderTitle(listing.title || "Chat with Host/Partner");
        }
      } catch (e) {
        console.error("Resolve/create chat failed:", e);
        alert("Couldn’t open chat. Please try again.");
      }
    }

    resolveThread();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    forcedChatId,
    user?.uid,
    counterUid,
    listing?.id,
    signature,
    counterRole,
  ]);

  /* -------- hydrate header + presence when we know chatId -------- */
  useEffect(() => {
    let alive = true;
    if (!chatId || !user?.uid) return;

    async function loadHeaderAndPresence() {
      try {
        const snap = await getDoc(doc(db, "chats", chatId));
        if (!alive || !snap.exists()) return;
        const d = snap.data() || {};
        setHeaderTitle(d?.listingTitle || "Chat with Host/Partner");

        const parts = Array.isArray(d.participants) ? d.participants : [];
        const otherId = parts.find((p) => p !== user.uid) || counterUid || null;
        otherIdRef.current = otherId;
        if (otherId && !counterUid) {
          setCounterUid(otherId);
        }

        // clear unread
        try {
          await updateDoc(doc(db, "chats", chatId), {
            unreadFor: arrayRemove(user.uid),
          });
        } catch (e) {
          console.warn("could not clear unread:", e);
        }

        // presence refs
        myPresenceRef.current = doc(
          db,
          "chats",
          chatId,
          "presence",
          user.uid
        );
        otherPresenceRef.current = otherId
          ? doc(db, "chats", chatId, "presence", otherId)
          : null;

        // subscribe to other presence
        let unsubPresence = () => {};
        if (otherPresenceRef.current) {
          unsubPresence = onSnapshot(
            otherPresenceRef.current,
            (ps) => {
              const data = ps.data() || {};
              setCounterPresence({
                typing: Boolean(data.typing),
                updatedAt: data.updatedAt || null,
              });
            },
            () => {
              setCounterPresence({ typing: false, updatedAt: null });
            }
          );
        }

        // keep unsub in outer scope
        return unsubPresence;
      } catch (e) {
        console.error(e);
      }
    }

    const maybeUnsubPromise = loadHeaderAndPresence();

    return () => {
      alive = false;
      setCounterPresence({ typing: false, updatedAt: null });
      if (myPresenceRef.current) {
        setDoc(
          myPresenceRef.current,
          { typing: false, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      clearTimeout(typingIdleRef.current);
      if (maybeUnsubPromise && typeof maybeUnsubPromise === "function") {
        maybeUnsubPromise();
      }
    };
  }, [chatId, user?.uid, counterUid]);

  /* -------- fetch counterparty profile once we know counterUid -------- */
  useEffect(() => {
    let alive = true;
    async function loadCounterProfile() {
      if (!counterUid) return;
      try {
        const snap = await getDoc(doc(db, "users", counterUid));
        if (!alive) return;
        if (snap.exists()) {
          setCounterProfile(snap.data());
        } else {
          setCounterProfile(null);
        }
      } catch (e) {
        console.error("loadCounterProfile:", e);
      }
    }
    loadCounterProfile();
    return () => {
      alive = false;
    };
  }, [counterUid]);

  /* ---------------- subscribe to messages ---------------- */
  useEffect(() => {
    if (!chatId) return;
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q2 = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q2,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(rows);
        setTimeout(scrollToBottom, 0);
        markLocalRead(chatId);
      },
      (err) => console.error(err)
    );
    return () => unsub();
  }, [chatId, scrollToBottom, markLocalRead]);

  /* ---------------- composer ---------------- */
  const onSend = useCallback(async () => {
    if (!user?.uid || !chatId) return;
    const text = message.trim();
    if (!text) return;

    try {
      setBusy(true);
      const msgsRef = collection(db, "chats", chatId, "messages");
      await addDoc(msgsRef, {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        threadId: chatId,
      });

      const otherId = otherIdRef.current;
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        ...(otherId ? { unreadFor: arrayUnion(otherId) } : {}),
      });

      setMessage("");
      setTimeout(scrollToBottom, 0);
      markLocalRead(chatId);
    } catch (e) {
      console.error(e);
      alert("Couldn’t send message. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [user?.uid, chatId, message, scrollToBottom, markLocalRead]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const onChangeMessage = (e) => {
    const v = e.target.value;
    setMessage(v);

    // typing presence
    if (!myPresenceRef.current) return;
    setDoc(
      myPresenceRef.current,
      { typing: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
    clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => {
      setDoc(
        myPresenceRef.current,
        { typing: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }, 1500);
  };

  const quick = async (t) => {
    setMessage(t);
    setTimeout(onSend, 20);
  };

  /* ---------------- guards ---------------- */
  if (!user) {
    return (
      <main className="min-h-[70vh] px-4 py-10 text-white bg-[#0f1419]">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Chat</h2>
          <p className="text-gray-300">Please sign in to start chatting.</p>
        </div>
      </main>
    );
  }

  // no context, no forced chat, no counterparty → show helper
  if (!forcedChatId && !counterUid && !listing?.id) {
    return (
      <main className="min-h-[70vh] px-4 py-10 text-white bg-[#0f1419]">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Chat with Host/Partner</h2>
          <p className="text-gray-300">
            Open a conversation from your{" "}
            <button
              className="underline decoration-dotted hover:text-amber-300"
              onClick={() => nav("/inbox")}
            >
              Inbox
            </button>{" "}
            or your{" "}
            <button
              className="underline decoration-dotted hover:text-amber-300"
              onClick={() => nav("/bookings")}
            >
              Bookings
            </button>
            .
          </p>
        </div>
      </main>
    );
  }

  /* ---------------- UI ---------------- */
  const counterDisplayName =
    counterProfile?.displayName ||
    counterProfile?.name ||
    counterProfile?.email ||
    "Host/Partner";

  const counterDisplayRole = (() => {
    const r = (counterProfile?.role || counterRole || "").toLowerCase();
    if (r.includes("partner")) return "Verified partner";
    if (r.includes("host")) return "Host";
    if (r.includes("admin")) return "Admin";
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : null;
  })();

  return (
    <main className="min-h-[70vh] px-4 py-6 text-white bg-[#0f1419] motion-fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 motion-slide-up">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              {headerTitle || "Chat with Host/Partner"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
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
              {counterDisplayName ? (
                <span className="opacity-80">• {counterDisplayName}</span>
              ) : null}
              {counterDisplayRole ? (
                <span className="opacity-50">({counterDisplayRole})</span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => nav(-1)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
          >
            ← Back
          </button>
        </div>

        {/* Context bubble */}
        {listing?.id ? (
          <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-sm flex items-center gap-3">
            <span className="text-amber-200 text-lg">🏡</span>
            <div className="flex-1">
              <div className="text-amber-100/90">
                This chat is about:{" "}
                <span className="font-semibold">{listing.title}</span>
              </div>
              <div className="text-amber-100/50 text-xs">
                Guests and hosts can keep all booking info in this thread.
              </div>
            </div>
            <button
              onClick={() => nav(`/listing/${listing.id}`)}
              className="px-3 py-1 rounded-lg bg-amber-500/90 text-black text-xs font-semibold hover:bg-amber-400"
            >
              View listing
            </button>
          </div>
        ) : null}

        {/* Thread */}
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden motion-pop">
          {/* Messages list */}
          <div
            ref={listRef}
            className="h-[460px] overflow-y-auto p-4"
            style={{ scrollBehavior: "smooth" }}
          >
            {messages.length === 0 ? (
              <div className="text-gray-300 text-sm">
                No messages yet. Say hello 👋
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user.uid;
                return (
                  <div
                    key={m.id}
                    className={`mb-2 flex ${
                      mine ? "justify-end" : "justify-start"
                    } motion-stagger`}
                  >
                    <div className="max-w-[75%] group motion-pop">
                      <div
                        className={
                          mine
                            ? "px-3 py-2 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-400/20 border border-amber-400/30 shadow-md"
                            : "px-3 py-2 rounded-2xl bg-white/5 border border-white/10 shadow"
                        }
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.text}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition text-[10px] text-gray-400 mt-0.5">
                        {m.createdAt?.toDate
                          ? m.createdAt.toDate().toLocaleString()
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 p-3 bg-gray-900/70">
            {counterPresence.typing && (
              <div className="mt-1 text-xs text-amber-300 animate-pulse">
                Typing…
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={onChangeMessage}
                onKeyDown={onKeyDown}
                onBlur={() => {
                  if (myPresenceRef.current) {
                    setDoc(
                      myPresenceRef.current,
                      { typing: false, updatedAt: serverTimestamp() },
                      { merge: true }
                    );
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-amber-400/50"
              />
              <button
                disabled={!message.trim() || busy || !chatId}
                onClick={onSend}
                className={`px-4 py-2 rounded-xl border ${
                  !message.trim() || busy || !chatId
                    ? "bg-gray-800/60 border-white/10 text-gray-500 cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700 border-amber-500 text-black font-semibold"
                }`}
              >
                Send
              </button>
            </div>

            {/* Quick replies (role-aware) */}
            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => quick(q)}
                  className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 motion-pop"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 mt-3 motion-slide-up">
          Contact details stay hidden by policy; they reveal only when your
          booking status and host/partner subscription permit.
        </div>
      </div>
    </main>
  );
}
