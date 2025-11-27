// src/auth/AuthContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth as authInstance, db } from "../firebase";

const auth = authInstance ?? getAuth();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase user
  const [profile, setProfile] = useState(null); // Firestore profile (users/{uid})
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Ensure persistence across reloads (prevents “instantly logged out” feeling)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // non-fatal; just means persistence fallback
    });
  }, []);

  // Helper to (re)load the Firestore profile for a given uid
  const loadProfile = useCallback(
    async (uid) => {
      if (!uid) {
        setProfile(null);
        return null;
      }

      const uref = doc(db, "users", uid);
      const snap = await getDoc(uref);

      if (!snap.exists()) {
        // Create a minimal profile; role defaults to "guest"
        const seed = {
          id: uid,
          email: auth.currentUser?.email || "",
          displayName: auth.currentUser?.displayName || "",
          photoURL: auth.currentUser?.photoURL || "",
          role: "guest",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(uref, seed, { merge: true });
        setProfile(seed);
        return seed;
      }

      const next = { id: uid, ...snap.data() };
      setProfile(next);
      return next;
    },
    []
  );

  // Subscribe to auth change
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        setLoading(true);
        setAuthError("");
        setUser(fbUser || null);

        if (!fbUser) {
          setProfile(null);
          return;
        }

        await loadProfile(fbUser.uid);
      } catch (e) {
        console.error("Auth state error:", e);
        setAuthError(e?.message || "Unable to load session.");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [loadProfile]);

  // Public helper so UI can force a profile refresh (e.g. after admin approves KYC/role)
  const refreshProfile = useCallback(
    async (explicitUid) => {
      const uid = explicitUid || auth.currentUser?.uid;
      if (!uid) return null;
      try {
        return await loadProfile(uid);
      } catch (e) {
        console.error("refreshProfile error:", e);
        return null;
      }
    },
    [loadProfile]
  );

  // Email/password sign-in
  const login = useCallback(
    async (email, password) => {
      setAuthError("");
      await signInWithEmailAndPassword(
        auth,
        String(email || "").trim(),
        String(password || "").trim()
      );
    },
    []
  );

  // Optional Google sign-in
  const loginWithGoogle = useCallback(async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    setAuthError("");
    await signOut(auth);
    // user + profile will be cleared by onAuthStateChanged callback
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
    }),
    [user, profile, loading, authError, login, loginWithGoogle, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
