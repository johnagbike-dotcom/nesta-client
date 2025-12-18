// src/context/InboxContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

// local-storage helper (same spirit as InboxPage)
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

const InboxContext = createContext({
  threads: [],
  unreadCount: 0,
  loading: false,
});

export function InboxProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to chats where I'm a participant
  useEffect(() => {
    if (!uid) {
      setThreads([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // IMPORTANT: if some docs don't have updatedAt yet, the orderBy can fail.
    // Your current chats are writing updatedAt, so this is fine.
    const qRef = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            ...data,
            // normalize for safety
            updatedAt: data.updatedAt || data.createdAt || null,
          };
        });

        // keep it sorted even if some docs fall back to createdAt
        list.sort(
          (a, b) => (b?.updatedAt?.toMillis?.() ?? 0) - (a?.updatedAt?.toMillis?.() ?? 0)
        );

        setThreads(list);
        setLoading(false);
      },
      (err) => {
        console.error("[InboxProvider] onSnapshot:", err);
        setThreads([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // Compute unread count:
  // 1) If unreadFor[] contains uid => unread
  // 2) Else compare updatedAt vs lastReadAt (server) and localStorage fallback
  const unreadCount = useMemo(() => {
    if (!uid) return 0;

    return threads.reduce((acc, t) => {
      // 1) preferred: explicit unread array
      if (Array.isArray(t.unreadFor) && t.unreadFor.includes(uid)) {
        return acc + 1;
      }

      // 2) fallback: timestamps
      const docMs = t?.lastReadAt?.[uid]?.toMillis?.() ?? 0;
      const localMs = getLocalLastRead(uid, t.id);
      const lastMs = Math.max(docMs, localMs);

      const updMs = t?.updatedAt?.toMillis?.() ?? 0;
      return updMs > lastMs ? acc + 1 : acc;
    }, 0);
  }, [threads, uid]);

  const value = useMemo(
    () => ({
      threads,
      unreadCount,
      loading,
    }),
    [threads, unreadCount, loading]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  return useContext(InboxContext);
}
