// src/hooks/useFavourites.js
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/**
 * Stores favourites as a map doc at:
 * users/{uid}/meta/favourites  => { [listingId]: true }
 *
 * - Uses deleteField() to remove keys when unfavouriting (keeps doc clean)
 * - Exposes `ready` so UI can avoid flicker on first load
 * - Safe even if doc doesn't exist yet
 */
export function useFavourites() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;

  const [favMap, setFavMap] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // logged out
    if (!uid) {
      setFavMap({});
      setReady(true);
      return;
    }

    setReady(false);

    const favDocRef = doc(db, "users", uid, "meta", "favourites");
    const unsub = onSnapshot(
      favDocRef,
      (snap) => {
        const data = snap.exists() ? snap.data() || {} : {};
        setFavMap(data);
        setReady(true);
      },
      (err) => {
        console.error("[useFavourites] snapshot error:", err);
        setFavMap({});
        setReady(true);
      }
    );

    return () => unsub();
  }, [uid]);

  const favIds = useMemo(() => {
    return new Set(Object.keys(favMap).filter((k) => favMap[k] === true));
  }, [favMap]);

  const count = favIds.size;

  const isFav = useCallback(
    (listingId) => {
      if (!listingId) return false;
      return favMap?.[listingId] === true;
    },
    [favMap]
  );

  const add = useCallback(
    async (listingId) => {
      if (!uid || !listingId) return;
      const favDocRef = doc(db, "users", uid, "meta", "favourites");
      await setDoc(favDocRef, { [listingId]: true }, { merge: true });
    },
    [uid]
  );

  const remove = useCallback(
    async (listingId) => {
      if (!uid || !listingId) return;
      const favDocRef = doc(db, "users", uid, "meta", "favourites");

      // ensure doc exists so updateDoc won't throw
      await setDoc(favDocRef, {}, { merge: true });
      await updateDoc(favDocRef, { [listingId]: deleteField() });
    },
    [uid]
  );

  /**
   * ✅ Stable, correct toggle:
   * - decides using current state (favMap)
   * - no weird deps hacks
   */
  const toggle = useCallback(
    async (listingId) => {
      if (!uid || !listingId) return;
      const next = !(favMap?.[listingId] === true);
      if (next) return add(listingId);
      return remove(listingId);
    },
    [uid, favMap, add, remove]
  );

  return {
    favIds,
    favMap,
    count,
    ready,
    isFav,
    add,
    remove,
    toggle,
    hasUser: !!uid,
  };
}
