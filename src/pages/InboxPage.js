// src/pages/InboxPage.js
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";
import "../styles/motion.css";

// ---- helpers ----
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

function getLocalLastRead(uid, chatId) {
  try {
    if (!uid || !chatId) return 0;
    const key = `nesta_chat_lastread_${uid}_${chatId}`;
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export default function InboxPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [qtext, setQtext] = useState("");

  // presence: { [chatId]: { typing: bool, online: bool } }
  const [presenceMap, setPresenceMap] = useState({});
  const presenceUnsubsRef = useRef({});

  // ---- main chats listener ----
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const qRef = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setThreads(list);
        setLoading(false);
      },
      (err) => {
        console.error("[Inbox] onSnapshot:", err);
        setThreads([]);
        setLoading(false);
      }
    );
    return () => {
      unsub();
      // clean all presence subs too
      Object.values(presenceUnsubsRef.current).forEach((fn) => fn && fn());
      presenceUnsubsRef.current = {};
    };
  }, [user?.uid]);

  // unread helper
  const isUnread = (t) => {
    const uid = user?.uid;
    if (!uid) return false;
    const lastDoc = t?.lastReadAt?.[uid]?.toMillis?.() ?? 0;
    const localMs = getLocalLastRead(uid, t.id);
    const lastMs = Math.max(lastDoc, localMs);
    const updMs = t?.updatedAt?.toMillis?.() ?? 0;
    return updMs > lastMs;
  };

  // ---- presence per thread ----
  useEffect(() => {
    if (!user?.uid) return;

    // remove listeners for threads that disappeared
    const currentIds = new Set(threads.map((t) => t.id));
    for (const chatId of Object.keys(presenceUnsubsRef.current)) {
      if (!currentIds.has(chatId)) {
        presenceUnsubsRef.current[chatId]();
        delete presenceUnsubsRef.current[chatId];
      }
    }

    // add listeners for new threads
    threads.forEach((t) => {
      const myId = user.uid;
      const others = Array.isArray(t.participants)
        ? t.participants.filter((p) => p !== myId)
        : [];
      const otherId = others[0];
      if (!otherId) return;
      if (presenceUnsubsRef.current[t.id]) return;

      const presRef = doc(db, "chats", t.id, "presence", otherId);
      const unsub = onSnapshot(
        presRef,
        (snap) => {
          const data = snap.data();
          setPresenceMap((prev) => ({
            ...prev,
            [t.id]: {
              typing: !!data?.typing,
              online: !!data,
            },
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
  }, [threads, user?.uid]);

  // filtered + sorted rows
  const rows = useMemo(() => {
    const mine = Array.isArray(threads) ? threads.slice() : [];
    const uid = user?.uid;

    const filtered = mine.filter((t) => {
      const archivedMap = t.archived || {};
      const isArch =
        archivedMap && typeof archivedMap === "object"
          ? archivedMap[uid] === true
          : false;
      return showArchived ? isArch : !isArch;
    });

    const kw = qtext.trim().toLowerCase();
    const filteredByText = kw
      ? filtered.filter((t) => {
          const title = (t.listingTitle || "").toLowerCase();
          const last = (t.lastMessage || "").toLowerCase();
          return (
            title.includes(kw) ||
            last.includes(kw) ||
            (t.id || "").toLowerCase().includes(kw)
          );
        })
      : filtered;

    const out = filteredByText.sort((a, b) => {
      const aPin = a?.pinned?.[uid] ? 1 : 0;
      const bPin = b?.pinned?.[uid] ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const au = a?.updatedAt?.toMillis?.() ?? 0;
      const bu = b?.updatedAt?.toMillis?.() ?? 0;
      return bu - au;
    });

    return out;
  }, [threads, showArchived, qtext, user?.uid]);

  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  async function toggleArchive(t) {
    if (!user?.uid) return;
    const ref = doc(db, "chats", t.id);
    const curr = !!t?.archived?.[user.uid];
    try {
      await updateDoc(ref, {
        [`archived.${user.uid}`]: !curr,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("archive toggle failed:", e);
      alert("Could not update archive state.");
    }
  }

  async function togglePin(t) {
    if (!user?.uid) return;
    const ref = doc(db, "chats", t.id);
    const curr = !!t?.pinned?.[user.uid];
    try {
      await updateDoc(ref, {
        [`pinned.${user.uid}`]: !curr,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("pin toggle failed:", e);
      alert("Could not update pin state.");
    }
  }

  async function openThread(t) {
    if (!user?.uid) return;
    try {
      const ref = doc(db, "chats", t.id);
      await updateDoc(ref, { [`lastReadAt.${user.uid}`]: serverTimestamp() });
    } catch (e) {
      console.warn("lastReadAt update failed (non-blocking):", e);
    }

    const partnerUid =
      (t.participants || []).find((p) => p !== user.uid) || null;
    const listing = t.listingId
      ? { id: t.listingId, title: t.listingTitle || "Listing" }
      : null;

    nav("/chat", {
      state: { threadId: t.id, partnerUid, listing, from: "inbox" },
    });
  }

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-8 motion-fade-in">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <header className="flex items-center justify-between mb-6 motion-slide-up">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Inbox
              </h1>
              <p className="text-gray-300 mt-1">
                Messages with hosts &amp; verified partners
              </p>
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

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>
        </header>

        {/* search */}
        <div className="mb-4 flex items-center gap-2 motion-slide-up">
          <input
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            placeholder="Search conversations by title or last message…"
            className="w-full rounded-2xl bg-gray-900/60 border border-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>

        {/* states */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
            Loading conversations…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
            <p className="font-semibold mb-1">
              {showArchived
                ? "No archived conversations."
                : "No conversations yet."}
            </p>
            <p className="text-gray-300">
              You’ll see your messages here after you contact a host/partner.
            </p>
          </div>
        )}

        {/* list */}
        {!loading && rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 motion-stagger">
            {rows.map((t) => {
              const partnerUid =
                (t.participants || []).find((p) => p !== user?.uid) || "—";
              const unread = isUnread(t);
              const pinned = !!t?.pinned?.[user?.uid];
              const archived = !!t?.archived?.[user?.uid];
              const pres = presenceMap[t.id] || {
                typing: false,
                online: false,
              };

              return (
                <li
                  key={t.id}
                  className="group rounded-2xl border border-white/10 bg-gray-900/60 hover:bg-gray-900/80 transition-colors"
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* avatar */}
                    <div className="relative shrink-0 w-11 h-11 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
                      <span className="text-lg">💬</span>
                      {pres.online && (
                        <span
                          className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${
                            pres.typing ? "bg-amber-400" : "bg-emerald-400"
                          } shadow`}
                          title={pres.typing ? "Typing…" : "Online"}
                        />
                      )}
                      {unread && !pres.online && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 shadow" />
                      )}
                    </div>

                    {/* content */}
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

                        <span className="ml-auto text-xs text-gray-400">
                          {timeAgo(t.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 text-gray-300 line-clamp-1">
                        {pres.typing ? (
                          <span className="text-amber-300 text-xs">
                            Typing…
                          </span>
                        ) : (
                          t.lastMessage || "—"
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        With: <span className="text-gray-200">{partnerUid}</span>
                      </div>
                    </div>

                    {/* actions */}
                    <div className="shrink-0 flex items-center gap-2">
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
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-sm"
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
      </div>
    </main>
  );
}
