// src/hooks/useUserProfile.js
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
} from "firebase/firestore";

export default function useUserProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(
      auth,
      (fbUser) => {
        // Clean old listener
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }

        if (!fbUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(fbUser);

        const uref = doc(db, "users", fbUser.uid);
        unsubProfile = onSnapshot(
          uref,
          (snap) => {
            const data = snap.exists() ? snap.data() : null;
            setProfile(data ? { id: fbUser.uid, ...data } : null);
            setLoading(false);
          },
          (err) => {
            console.error("useUserProfile snapshot error", err);
            setError("profile_load_failed");
            setProfile(null);
            setLoading(false);
          }
        );
      },
      (err) => {
        console.error("useUserProfile auth error", err);
        setError("auth_failed");
        setLoading(false);
      }
    );

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return { user, profile, loading, error };
}
