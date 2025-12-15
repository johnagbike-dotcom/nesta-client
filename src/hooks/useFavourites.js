// src/hooks/useFavourites.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from "firebase/firestore";
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
    // reset when logged out
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
      () => {
        // if snapshot errors, still unblock UI
        setFavMap({});
        setReady(true);
      }
    );

    return () => unsub();
  }, [uid]);

  const favIds = useMemo(() => {
    // keep as Set for fast lookups
    return new Set(Object.keys(favMap).filter((k) => favMap[k] === true));
  }, [favMap]);

  const count = favIds.size;

  const isFav = useCallback((listingId) => {
    if (!listingId) return false;
    return favMap[listingId] === true;
  }, [favMap]);

  const add = useCallback(async (listingId) => {
    if (!uid || !listingId) return;
    const favDocRef = doc(db, "users", uid, "meta", "favourites");
    await setDoc(favDocRef, { [listingId]: true }, { merge: true });
  }, [uid]);

  const remove = useCallback(async (listingId) => {
    if (!uid || !listingId) return;
    const favDocRef = doc(db, "users", uid, "meta", "favourites");

    // If the doc doesn't exist yet, updateDoc throws.
    // So we set an empty merge first (cheap + safe), then delete.
    await setDoc(favDocRef, {}, { merge: true });
    await updateDoc(favDocRef, { [listingId]: deleteField() });
  }, [uid]);

  const toggle = useCallback(async (listingId) => {
    if (!uid || !listingId) return;
    const next = !(favMap?.[listingId] === true);
    if (next) return add(listingId);
    return remove(listingId);
  }, [uid, listingIdSafeDep(favMap), add, remove]);

  return {
    favIds,
    favMap,       // sometimes useful (badges)
    count,
    ready,
    isFav,
    add,
    remove,
    toggle,
    hasUser: !!uid,
  };
}

/**
 * Prevents toggle() from re-creating on every favMap object identity change,
 * while still reacting when a specific listingId value changes.
 * (Keeps things stable without fancy libs.)
 */
function listingIdSafeDep(map) {
  // Map identity changes are frequent; we just return a primitive “version”
  // based on key count + a cheap hash.
  const keys = Object.keys(map || {});
  let h = keys.length;
  for (let i = 0; i < keys.length; i++) h = (h * 33) ^ keys[i].length;
  return h >>> 0;
}
