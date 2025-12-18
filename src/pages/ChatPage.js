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
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import "../styles/polish.css";
import "../styles/motion.css";

const QUICK_GUEST = ["Hello 👋", "Is this place available on my dates?", "Can I get a flexible check-in?", "Please share house rules."];
const QUICK_HOST = ["Hi there 👋 How can I help?", "Your dates are available ✅", "Check-in is from 2pm; we can be flexible.", "Here are the house rules:"];
const QUICK_PARTNER = ["Hello 👋 thanks for your interest.", "We manage similar properties if you’d like options.", "Corporate/long-stay rates are available.", "I’ll share the application/verification steps."];

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

export default function ChatPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const myRole = (profile?.role || "").toLowerCase();
  const QUICK =
    !myRole || myRole === "guest"
      ? QUICK_GUEST
      : myRole.includes("host")
      ? QUICK_HOST
      : QUICK_PARTNER;

  const nav = useNavigate();
  const params = useParams();
  const { state } = useLocation();

  const forcedChatId = state?.chatId || state?.threadId || null;
  const paramUid = params?.uid || null;

  const partnerUidFromState = state?.partnerUid || paramUid || null;
  const listingFromState = state?.listing || null; // { id, title }

  const [chatId, setChatId] = useState(forcedChatId || null);
  const [headerTitle, setHeaderTitle] = useState("Chat with Host/Partner");
  const [counterUid, setCounterUid] = useState(partnerUidFromState);
  const [listing, setListing] = useState(listingFromState);

  const [chatMeta, setChatMeta] = useState(null);
  const [counterProfile, setCounterProfile] = useState(null);
  const [counterPresence, setCounterPresence] = useState({ typing: false, updatedAt: null });

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const listRef = useRef(null);
  const otherIdRef = useRef(null);
  const typingIdleRef = useRef(null);
  const myPresenceRef = useRef(null);
  const otherPresenceRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
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
  const otherLastReadMs = otherIdForSeen ? safeMillis(chatMeta?.lastReadAt?.[otherIdForSeen]) : 0;
  const lastMineCreatedMs = safeMillis(lastMineMsg?.createdAt);
  const showSeen = !!lastMineMsg && otherLastReadMs > 0 && lastMineCreatedMs > 0 && otherLastReadMs >= lastMineCreatedMs;

  // Resolve/create chat thread
  useEffect(() => {
    let cancelled = false;

    async function resolveThread() {
      try {
        if (forcedChatId) {
          if (!cancelled) setChatId(forcedChatId);
          return;
        }
        if (!user?.uid || !counterUid || !listing?.id) return;

        const id = stableChatId(listing.id, user.uid, counterUid);
        const ref = doc(db, "chats", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            participants: [user.uid, counterUid],
            listingId: listing.id,
            listingTitle: listing.title || "Listing",
            // keep optional; UI doesn’t depend on it
            counterpartRole: "host",

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
  }, [forcedChatId, user?.uid, counterUid, listing?.id, listing?.title]);

  // Chat doc listener + presence refs + remove me from unreadFor (only if needed)
  useEffect(() => {
    if (!chatId || !user?.uid) return;

    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(
      chatRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() || {};
        setChatMeta(d);
        setHeaderTitle(d.listingTitle || "Chat with Host/Partner");

        const parts = Array.isArray(d.participants) ? d.participants : [];
        const otherId = parts.find((p) => p !== user.uid) || counterUid || null;
        otherIdRef.current = otherId;

        myPresenceRef.current = doc(db, "chats", chatId, "presence", user.uid);
        otherPresenceRef.current = otherId ? doc(db, "chats", chatId, "presence", otherId) : null;

        // Only update if I'm actually in unreadFor (avoids noisy writes)
        if (Array.isArray(d.unreadFor) && d.unreadFor.includes(user.uid)) {
          updateDoc(chatRef, { unreadFor: arrayRemove(user.uid) }).catch(() => {});
        }
      },
      (e) => console.error("chat doc listen:", e)
    );

    return () => unsub();
  }, [chatId, user?.uid, counterUid]);

  // Other presence listener
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    let unsubPresence = () => {};

    if (otherPresenceRef.current) {
      unsubPresence = onSnapshot(
        otherPresenceRef.current,
        (ps) => {
          const data = ps.data() || {};
          setCounterPresence({ typing: !!data.typing, updatedAt: data.updatedAt || null });
        },
        () => setCounterPresence({ typing: false, updatedAt: null })
      );
    }

    return () => {
      setCounterPresence({ typing: false, updatedAt: null });
      clearTimeout(typingIdleRef.current);
      unsubPresence();
    };
  }, [chatId, user?.uid]);

  // Load counter profile
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!counterUid) return;
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
  }, [counterUid]);

  // Messages listener
  useEffect(() => {
    if (!chatId) return;
    const qRef = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTimeout(scrollToBottom, 0);
      },
      (err) => console.error(err)
    );
    return () => unsub();
  }, [chatId, scrollToBottom]);

  // Update lastReadAt periodically
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const t = setInterval(() => {
      updateDoc(doc(db, "chats", chatId), {
        [`lastReadAt.${user.uid}`]: serverTimestamp(),
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [chatId, user?.uid]);

  // SEND
  const onSend = useCallback(async () => {
    if (!user?.uid || !chatId) return;
    const text = message.trim();
    if (!text) return;

    const otherId = otherIdRef.current || counterUid || null;

    try {
      setBusy(true);

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
      alert("Couldn’t send message. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [user?.uid, chatId, message, scrollToBottom, counterUid]);

  // Typing (presence) — self-only writes (matches rules)
  const onChangeMessage = (e) => {
    const v = e.target.value;
    setMessage(v);

    if (!myPresenceRef.current || !user?.uid) return;

    setDoc(myPresenceRef.current, { typing: true, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => {
      setDoc(myPresenceRef.current, { typing: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    }, 1300);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const quick = (t) => {
    setMessage(t);
    setTimeout(onSend, 20);
  };

  // Guards
  if (!user) {
    return (
      <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Chat</h2>
          <p className="text-gray-300">Please sign in to start chatting.</p>
        </div>
      </main>
    );
  }

  if (!forcedChatId && (!counterUid || !listing?.id)) {
    return (
      <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Chat with Host/Partner</h2>
          <p className="text-gray-300">Open a conversation from your Inbox or Bookings.</p>
        </div>
      </main>
    );
  }

  const counterDisplayName = counterProfile?.displayName || counterProfile?.name || counterProfile?.email || "Host/Partner";
  const avatarUrl = counterProfile?.photoURL || counterProfile?.avatarUrl || counterProfile?.avatar || null;

  return (
    <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3 motion-slide-up">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-3">
              <span className="truncate">{headerTitle || "Chat with Host/Partner"}</span>
            </h1>

            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-black/30">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={counterDisplayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-amber-200 font-bold">
                      {(counterDisplayName || "H").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      counterPresence.typing ? "bg-amber-300" : presenceLabel === "Online" ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  />
                  {presenceLabel}
                </span>
                <span className="opacity-80 truncate max-w-[160px]">• {counterDisplayName}</span>
              </span>
              {showSeen ? <span className="text-amber-300/80">• Seen</span> : null}
            </div>
          </div>

          <button onClick={() => nav(-1)} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm">
            ← Back
          </button>
        </div>

        {listing?.id ? (
          <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-sm flex items-center gap-3">
            <span className="text-amber-200 text-lg">🏡</span>
            <div className="flex-1 min-w-0">
              <div className="text-amber-100/90 truncate">
                This chat is about: <span className="font-semibold">{listing.title}</span>
              </div>
              <div className="text-amber-100/50 text-xs">Keep all booking info in this thread.</div>
            </div>
            <button
              onClick={() => nav(`/listing/${listing.id}`)}
              className="px-3 py-1 rounded-lg bg-amber-500/90 text-black text-xs font-semibold hover:bg-amber-400"
            >
              View listing
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden motion-pop">
          <div ref={listRef} className="h-[460px] overflow-y-auto p-4 nesta-chat-scroll" style={{ scrollBehavior: "smooth" }}>
            {messages.length === 0 ? (
              <div className="text-gray-300 text-sm">No messages yet. Say hello 👋</div>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user.uid;
                return (
                  <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"} motion-stagger`}>
                    <div className="max-w-[78%] group motion-pop">
                      <div className={`nesta-bubble ${mine ? "mine" : "theirs"}`}>
                        <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      </div>
                      <div className="nesta-stamp">{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ""}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 p-3 bg-gray-900/70">
            {counterPresence.typing && <div className="mt-1 text-xs text-amber-300 animate-pulse">Typing…</div>}

            <div className="flex gap-2">
              <input
                value={message}
                onChange={onChangeMessage}
                onKeyDown={onKeyDown}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 outline-none lux-focus"
              />

              <button
                disabled={!message.trim() || busy || !chatId}
                onClick={onSend}
                className={`px-4 py-2 rounded-xl border ${
                  !message.trim() || busy || !chatId
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
                  className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 motion-pop"
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
