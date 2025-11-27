// src/hooks/useUser.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { auth, db } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,   // <— use provider locally
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Create provider locally (no need to import from firebase.js)
const provider = new GoogleAuthProvider();

/** Helpers also exported for optional direct use */
export async function loginWithEmailFn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
export async function loginWithGoogleFn() {
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}
export async function logoutFn() {
  await signOut(auth);
}

export function useUser() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        } catch (e) {
          console.error("load profile failed:", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    const u = await loginWithEmailFn(email, password);
    return u;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const u = await loginWithGoogleFn();
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutFn();
  }, []);

  const isAdmin = useMemo(
    () => !!(profile && (profile.isAdmin === true || profile.role === "admin")),
    [profile]
  );

  return {
    user,
    profile,
    isAdmin,
    loading,
    loginWithEmail,
    loginWithGoogle,
    logout,
  };
}

export default useUser;