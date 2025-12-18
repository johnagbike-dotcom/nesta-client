// src/pages/InboxPage.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";
import "../styles/motion.css";

/* ───────────────── helpers ───────────────── */

function toMillisSafe(ts) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function timeAgo(ts) {
  try {
    if (!ts) return "—";
    const t = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    const s = Math.max(1, Math.floor((Date.now() - t.getTime()) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return "—";
  }
}

/**
 * IMPORTANT: Standardize localStorage key:
 * nesta_chat_lastread_<uid>_chats:<chatId>
 */
function getLocalLastRead(uid, chatId) {
  try {
    if (!uid || !chatId) return 0;
    const key = `nesta_chat_lastread_${uid}_chats:${chatId}`;
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function setLocalLastRead(uid, chatId) {
  try {
    if (!uid || !chatId) return;
    const key = `nesta_chat_lastread_${uid}_chats:${chatId}`;
    localStorage.setItem(key, Date.now().toString());
  } catch {}
}

function lastMessageText(lastMessage) {
  if (!lastMessage) return "";
  if (typeof lastMessage === "string") return lastMessage; // tolerate legacy
  if (typeof lastMessage?.text === "string") return lastMessage.text;
  return "";
}

function initials(nameOrEmail = "") {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "N";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function playSoftBeep() {
  try {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    // only after user gesture; browsers will block otherwise
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 740;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();

    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    setTimeout(() => {
      try {
        o.stop();
        ctx.close();
      } catch {}
    }, 220);
  } catch {}
}

/* ───────────────── component ───────────────── */

export default function InboxPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const uid = user?.uid || null;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showArchived, setShowArchived] = useState(false);
  const [qtext, setQtext] = useState("");

  const [presenceMap, setPresenceMap] = useState({});
  const presenceUnsubsRef = useRef({});

  // users_public cache
  const [counterCache, setCounterCache] = useState({});
  const counterLoadingRef = useRef({});

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const lastUnreadSetRef = useRef(new Set());

  /* ───────────────── chats listener (ONLY chats collection, with fallback) ───────────────── */
  useEffect(() => {
    if (!uid) {
      setThreads([]);
      setLoading(false);
      return;
    }

    let unsub = null;
    let active = true;

    setLoading(true);

    const qSorted = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("updatedAt", "desc")
    );

    const qFallback = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid)
    );

    const attach = (qref, label) =>
      onSnapshot(
        qref,
        (snap) => {
          if (!active) return;

          const rows = snap.docs.map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              ...data,
              updatedAt: data.updatedAt || data.createdAt || null,
            };
          });

          // Always sort locally to avoid relying on Firestore ordering
          rows.sort((a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt));

          setThreads(rows);
          setLoading(false);
        },
        (err) => {
          console.error(`[Inbox] chats onSnapshot (${label}):`, err);

          // fallback once if sorted query fails
          if (label === "sorted") {
            try {
              unsub && unsub();
            } catch {}
            unsub = attach(qFallback, "fallback");
            return;
          }

          setThreads([]);
          setLoading(false);
        }
      );

    unsub = attach(qSorted, "sorted");

    return () => {
      active = false;

      try {
        unsub && unsub();
      } catch {}

      Object.values(presenceUnsubsRef.current).forEach((fn) => fn && fn());
      presenceUnsubsRef.current = {};

      clearTimeout(toastTimerRef.current);
    };
  }, [uid]);

  /* ───────────────── unread helper ───────────────── */
  const isUnread = useCallback(
    (t) => {
      if (!uid) return false;

      const lastDocMs = t?.lastReadAt?.[uid]?.toMillis?.() ?? 0;
      const localMs = getLocalLastRead(uid, t.id);
      const lastSeenMs = Math.max(lastDocMs, localMs);

      const updMs = toMillisSafe(t?.updatedAt);
      return updMs > lastSeenMs;
    },
    [uid]
  );

  /* ───────────────── presence per thread (chats/{chatId}/presence/{otherUid}) ───────────────── */
  useEffect(() => {
    if (!uid) return;

    const currentIds = new Set(threads.map((t) => t.id));

    // cleanup removed listeners
    for (const chatId of Object.keys(presenceUnsubsRef.current)) {
      if (!currentIds.has(chatId)) {
        presenceUnsubsRef.current[chatId]();
        delete presenceUnsubsRef.current[chatId];
      }
    }

    threads.forEach((t) => {
      const otherId = Array.isArray(t.participants) ? t.participants.find((p) => p !== uid) : null;
      if (!otherId) return;
      if (presenceUnsubsRef.current[t.id]) return;

      const presRef = doc(db, "chats", t.id, "presence", otherId);
      const unsub = onSnapshot(
        presRef,
        (snap) => {
          const data = snap.data();
          setPresenceMap((prev) => ({
            ...prev,
            [t.id]: { typing: !!data?.typing, online: !!data },
          }));
        },
        () => {
          setPresenceMap((prev) => ({
            ...prev,
            [t.id]: { typing: false, online: false },
          }));
        }
      );

      presenceUnsubsRef.current[t.id] = unsub;
    });
  }, [threads, uid]);

  /* ───────────────── counterparty profile fetch (users_public) ───────────────── */
  useEffect(() => {
    if (!uid) return;

    const needed = new Set();

    threads.forEach((t) => {
      const other = Array.isArray(t.participants) ? t.participants.find((p) => p !== uid) : null;
      if (other && !counterCache[other] && !counterLoadingRef.current[other]) needed.add(other);
    });

    if (needed.size === 0) return;

    needed.forEach(async (otherUid) => {
      counterLoadingRef.current[otherUid] = true;
      try {
        const snap = await getDoc(doc(db, "users_public", otherUid));
        const d = snap.exists() ? snap.data() : null;

        const displayName = d?.displayName || d?.name || d?.email || "User";
        const photoURL = d?.photoURL || d?.avatarUrl || d?.avatar || null;

        setCounterCache((prev) => ({
          ...prev,
          [otherUid]: { displayName, photoURL },
        }));
      } catch (e) {
        console.warn("users_public load failed:", otherUid, e);
        setCounterCache((prev) => ({
          ...prev,
          [otherUid]: { displayName: "User", photoURL: null },
        }));
      } finally {
        counterLoadingRef.current[otherUid] = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, uid]);

  /* ───────────────── filtered rows ───────────────── */
  const rows = useMemo(() => {
    if (!uid) return [];
    const mine = Array.isArray(threads) ? threads.slice() : [];

    const filtered = mine.filter((t) => {
  const archivedMap = t.archived || {};
  const isArchivedForMe = archivedMap[uid] === true;
  return showArchived ? isArchivedForMe : !isArchivedForMe;
});

    const kw = qtext.trim().toLowerCase();
    const filteredByText = kw
      ? filtered.filter((t) => {
          const title = (t.listingTitle || "").toLowerCase();
          const last = lastMessageText(t.lastMessage).toLowerCase();
          return title.includes(kw) || last.includes(kw) || (t.id || "").toLowerCase().includes(kw);
        })
      : filtered;

    filteredByText.sort((a, b) => {
      const aPin = a?.pinned?.[uid] ? 1 : 0;
      const bPin = b?.pinned?.[uid] ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt);
    });

    return filteredByText;
  }, [threads, showArchived, qtext, uid]);

  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows, isUnread]);

  /* ───────────────── toast + beep when new unread arrives ───────────────── */
  useEffect(() => {
    if (!uid) return;
    if (loading) return;

    const currentUnread = new Set(rows.filter(isUnread).map((t) => t.id));
    const prevUnread = lastUnreadSetRef.current;

    const newlyUnread = [];
    currentUnread.forEach((id) => {
      if (!prevUnread.has(id)) newlyUnread.push(id);
    });

    lastUnreadSetRef.current = currentUnread;

    if (newlyUnread.length > 0 && !showArchived) {
      // Beep can be blocked by browser; harmless if it fails
      playSoftBeep();
      setToast(newlyUnread.length === 1 ? "New message received" : `${newlyUnread.length} new messages received`);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2600);
    }
  }, [rows, uid, loading, showArchived, isUnread]);

  /* ───────────────── actions ───────────────── */

  async function toggleArchive(t) {
    if (!uid) return;
    const ref = doc(db, "chats", t.id);
    const curr = !!t?.archived?.[uid];
    try {
      await updateDoc(ref, { [`archived.${uid}`]: !curr, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("archive toggle failed:", e);
      alert("Could not update archive state.");
    }
  }

  async function togglePin(t) {
    if (!uid) return;
    const ref = doc(db, "chats", t.id);
    const curr = !!t?.pinned?.[uid];
    try {
      await updateDoc(ref, { [`pinned.${uid}`]: !curr, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("pin toggle failed:", e);
      alert("Could not update pin state.");
    }
  }

  async function openThread(t) {
    if (!uid) return;

    // mark read (server + local)
    try {
      const ref = doc(db, "chats", t.id);
      await updateDoc(ref, {
        [`lastReadAt.${uid}`]: serverTimestamp(),
        unreadFor: arrayRemove(uid),
      });
    } catch (e) {
      console.warn("mark read failed (non-blocking):", e);
    }

    setLocalLastRead(uid, t.id);

    const partnerUid = Array.isArray(t.participants) ? t.participants.find((p) => p !== uid) : null;
    const listing = t.listingId ? { id: t.listingId, title: t.listingTitle || "Listing" } : null;

    // IMPORTANT: pass chatId so ChatPage forcedChatId works
    nav("/chat", {
      state: { chatId: t.id, partnerUid, listing, from: "inbox" },
    });
  }

  async function markAllAsRead() {
    if (!uid) return;
    const unreadThreads = rows.filter(isUnread);
    if (unreadThreads.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadThreads.forEach((t) => {
        const ref = doc(db, "chats", t.id);
        batch.update(ref, {
          [`lastReadAt.${uid}`]: serverTimestamp(),
          unreadFor: arrayRemove(uid),
        });
      });
      await batch.commit();

      unreadThreads.forEach((t) => setLocalLastRead(uid, t.id));

      setToast("All messages marked as read");
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2200);
    } catch (e) {
      console.error("markAllAsRead failed:", e);
      alert("Could not mark all as read. Try again.");
    }
  }

  /* ───────────────── UI ───────────────── */

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0f1419] text-white px-4 py-8 motion-fade-in nesta-inbox">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h1 className="text-2xl font-extrabold">Inbox</h1>
          <p className="text-gray-300 mt-1">Please sign in to view your conversations.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-8 motion-fade-in nesta-inbox">
      <div className="max-w-5xl mx-auto">
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full border border-amber-400/30 bg-black/70 text-amber-200 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
            {toast}
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 motion-slide-up">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Inbox</h1>
              <p className="text-gray-300 mt-1">Messages with hosts &amp; verified partners</p>
            </div>

            {unreadCount > 0 && (
              <span
                className="ml-2 inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300"
                title={`${unreadCount} unread ${unreadCount === 1 ? "chat" : "chats"}`}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>

            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className={`px-3 py-1.5 rounded-xl border text-sm ${
                unreadCount === 0
                  ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                  : "bg-amber-500 text-black border-amber-400/40 hover:bg-amber-400 btn-amber"
              }`}
              title="Mark all conversations as read"
            >
              Mark all read
            </button>
          </div>
        </header>

        <div className="mb-4 flex items-center gap-2 motion-slide-up">
          <input
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            placeholder="Search conversations by title or last message…"
            className="w-full rounded-2xl bg-gray-900/60 border border-white/10 px-4 py-2 outline-none lux-focus"
          />
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
            Loading conversations…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
            <p className="font-semibold mb-1">{showArchived ? "No archived conversations." : "No conversations yet."}</p>
            <p className="text-gray-300">You’ll see your messages here after you contact a host/partner.</p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 motion-stagger">
            {rows.map((t) => {
              const partnerUid = Array.isArray(t.participants) ? t.participants.find((p) => p !== uid) : null;

              const unread = isUnread(t);
              const pinned = !!t?.pinned?.[uid];
              const archived = !!t?.archived?.[uid];

              const pres = presenceMap[t.id] || { typing: false, online: false };

              const counter = partnerUid ? counterCache[partnerUid] : null;
              const displayName = counter?.displayName || (partnerUid ? partnerUid.slice(0, 8) : "User");
              const avatar = counter?.photoURL || null;

              return (
                <li key={t.id} className={["nesta-chat-row card-glow", unread ? "nesta-chat-unread" : ""].join(" ")}>
                  <div className="p-4 flex items-start gap-3">
                    <div className="relative shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden grid place-items-center">
                      {avatar ? (
                        <img src={avatar} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-sm font-bold text-amber-200">{initials(displayName)}</span>
                      )}

                      {pres.online && (
                        <span
                          className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${
                            pres.typing ? "bg-amber-400" : "bg-emerald-400"
                          } shadow`}
                          title={pres.typing ? "Typing…" : "Online"}
                        />
                      )}

                      {unread && !pres.online && <span className="absolute -top-1 -right-1 nesta-unread-dot" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-left truncate font-semibold hover:underline"
                          onClick={() => openThread(t)}
                          title={t.listingTitle || "Conversation"}
                        >
                          {t.listingTitle || "Conversation"}
                        </button>

                        {unread && (
                          <span className="text-amber-300 text-[10px] border border-amber-400/40 px-1.5 py-0.5 rounded-md">
                            New
                          </span>
                        )}
                        {pinned && (
                          <span className="text-amber-300 text-[10px] border border-amber-400/40 px-1.5 py-0.5 rounded-md">
                            Pinned
                          </span>
                        )}
                        {archived && (
                          <span className="text-gray-300 text-[10px] border border-white/15 px-1.5 py-0.5 rounded-md">
                            Archived
                          </span>
                        )}

                        <span className="ml-auto text-xs text-gray-400">{timeAgo(t.updatedAt)}</span>
                      </div>

                      <div className="mt-0.5 text-gray-300 line-clamp-1">
                        {pres.typing ? (
                          <span className="text-amber-300 text-xs inline-flex items-center gap-2">
                            Typing
                            <span className="typing-dots" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                          </span>
                        ) : (
                          lastMessageText(t.lastMessage) || "—"
                        )}
                      </div>

                      <div className="mt-1 text-xs text-gray-400 truncate">
                        With: <span className="text-gray-200">{displayName}</span>
                      </div>
                    </div>

                    <div className="nesta-chat-actions shrink-0 flex flex-col md:flex-row items-stretch md:items-center gap-2">
                      <button
                        onClick={() => togglePin(t)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                        title={pinned ? "Unpin" : "Pin"}
                      >
                        {pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => toggleArchive(t)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                        title={archived ? "Unarchive" : "Archive"}
                      >
                        {archived ? "Unarchive" : "Archive"}
                      </button>
                      <button
                        onClick={() => openThread(t)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-sm text-black font-semibold btn-amber"
                        title="Open"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="text-xs text-gray-400 mt-5 motion-slide-up">
          Contact details stay hidden by policy; they reveal only when booking status and subscription permit.
        </div>
      </div>
    </main>
  );
}
