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
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  // subscribe to chats where I'm a participant
  useEffect(() => {
    if (!user?.uid) {
      setThreads([]);
      setLoading(false);
      return;
    }

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
        console.error("[InboxProvider] onSnapshot:", err);
        setThreads([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // compute unread like InboxPage
  const unreadCount = useMemo(() => {
    if (!user?.uid) return 0;
    return threads.reduce((acc, t) => {
      const uid = user.uid;

      // 1) explicit unread array (preferred)
      if (Array.isArray(t.unreadFor) && t.unreadFor.includes(uid)) {
        return acc + 1;
      }

      // 2) fallback to timestamp comparison
      const docMs = t?.lastReadAt?.[uid]?.toMillis?.() ?? 0;
      const localMs = getLocalLastRead(uid, t.id);
      const lastMs = Math.max(docMs, localMs);
      const updMs = t?.updatedAt?.toMillis?.() ?? 0;
      if (updMs > lastMs) return acc + 1;

      return acc;
    }, 0);
  }, [threads, user?.uid]);

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
