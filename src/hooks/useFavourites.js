// src/hooks/useFavourites.js
import { useEffect, useState, useCallback } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/**
* Stores favourites as a map doc at:
* users/{uid}/meta/favourites  => { [listingId]: true | false }
*/
export function useFavourites() {
  const { user } = useAuth() || {};
  const [ids, setIds] = useState(new Set());

  useEffect(() => {
    if (!user?.uid) {
      setIds(new Set());
      return;
    }
    const favDoc = doc(db, "users", user.uid, "meta", "favourites");
    const unsub = onSnapshot(favDoc, (snap) => {
      const data = snap.data() || {};
      const set = new Set(Object.keys(data).filter((k) => !!data[k]));
      setIds(set);
    });
    return () => unsub();
  }, [user?.uid]);

  const isFav = useCallback((listingId) => ids.has(listingId), [ids]);

  const toggle = useCallback(
    async (listingId) => {
      if (!user?.uid || !listingId) return;
      const favDoc = doc(db, "users", user.uid, "meta", "favourites");
      const next = !ids.has(listingId);
      await setDoc(favDoc, { [listingId]: next }, { merge: true });
    },
    [user?.uid, ids]
  );

  return { favIds: ids, isFav, toggle, hasUser: !!user?.uid };
}  