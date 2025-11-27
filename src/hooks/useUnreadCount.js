// src/hooks/useUnreadCount.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function useUnreadCount(uid) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) { setCount(0); return; }

    // Chats where I'm a participant AND I'm in unreadFor
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      where("unreadFor", "array-contains", uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0)
    );
    return () => unsub();
  }, [uid]);

  return count;
} 
