// src/auth/AuthContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  // MFA:
  getMultiFactorResolver,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth as authInstance, db } from "../firebase";

const auth = authInstance ?? getAuth();
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase user
  const [profile, setProfile] = useState(null); // Firestore profile (users/{uid})
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Live profile listener
  const profileUnsubRef = useRef(null);

  // ---------------- MFA state ----------------
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaHints, setMfaHints] = useState([]); // enrolled phones masked
  const [mfaError, setMfaError] = useState("");
  const mfaResolverRef = useRef(null);

  // Enrolment flow
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaVerificationId, setMfaVerificationId] = useState(null);
  const recaptchaRef = useRef(null);

  // Ensure persistence across reloads
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  const stopProfileListener = useCallback(() => {
    try {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    } catch {}
  }, []);

  const ensureAndSubscribeProfile = useCallback(
    async (uid) => {
      if (!uid) {
        stopProfileListener();
        setProfile(null);
        return null;
      }

      stopProfileListener();

      const uref = doc(db, "users", uid);

      const snap = await getDoc(uref);
      if (!snap.exists()) {
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
      }

      profileUnsubRef.current = onSnapshot(
        uref,
        (docSnap) => {
          if (!docSnap.exists()) {
            setProfile(null);
            return;
          }
          setProfile({ id: uid, ...docSnap.data() });
        },
        (err) => {
          console.error("Profile snapshot error:", err);
          setProfile(null);
        }
      );

      const snap2 = await getDoc(uref);
      const next = snap2.exists() ? { id: uid, ...snap2.data() } : null;
      setProfile(next);
      return next;
    },
    [stopProfileListener]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        setLoading(true);
        setAuthError("");
        setUser(fbUser || null);

        if (!fbUser) {
          stopProfileListener();
          setProfile(null);
          return;
        }

        await ensureAndSubscribeProfile(fbUser.uid);
      } catch (e) {
        console.error("Auth state error:", e);
        setAuthError(e?.message || "Unable to load session.");
        stopProfileListener();
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      stopProfileListener();
    };
  }, [ensureAndSubscribeProfile, stopProfileListener]);

  const refreshProfile = useCallback(async (explicitUid) => {
    const uid = explicitUid || auth.currentUser?.uid;
    if (!uid) return null;
    try {
      const uref = doc(db, "users", uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) return null;
      const next = { id: uid, ...snap.data() };
      setProfile(next);
      return next;
    } catch (e) {
      console.error("refreshProfile error:", e);
      return null;
    }
  }, []);

  // ---------------- Basic login ----------------
  const login = useCallback(async (email, password) => {
    setAuthError("");
    await signInWithEmailAndPassword(
      auth,
      String(email || "").trim(),
      String(password || "").trim()
    );
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    setAuthError("");
    stopProfileListener();
    await signOut(auth);
  }, [stopProfileListener]);

  // ---------------- MFA: Sign-in challenge flow ----------------
  // Use this instead of login() in your LoginPage
  const beginLogin = useCallback(async (email, password) => {
    setAuthError("");
    setMfaError("");
    setMfaRequired(false);
    setMfaHints([]);
    mfaResolverRef.current = null;

    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        String(email || "").trim(),
        String(password || "").trim()
      );

      // ✅ IMPORTANT: refresh user state immediately after sign-in
      try {
        await cred.user.reload();
      } catch {}

      return { ok: true, mfaRequired: false, user: cred.user };
    } catch (e) {
      if (e?.code === "auth/multi-factor-auth-required") {
        try {
          const resolver = getMultiFactorResolver(auth, e);
          mfaResolverRef.current = resolver;

          const hints = resolver?.hints || [];
          setMfaHints(
            hints.map((h) => ({
              uid: h.uid,
              factorId: h.factorId,
              phoneNumber: h.phoneNumber || "",
            }))
          );
          setMfaRequired(true);

          return { ok: false, mfaRequired: true };
        } catch (e2) {
          console.error("MFA resolver error:", e2);
          setMfaError("MFA challenge could not be started. Try again.");
          return { ok: false, mfaRequired: false };
        }
      }

      throw e;
    }
  }, []);

  const sendMfaCode = useCallback(async ({ recaptchaContainerId, hintUid } = {}) => {
    setMfaError("");
    const resolver = mfaResolverRef.current;
    if (!resolver) {
      setMfaError("MFA session expired. Please sign in again.");
      return { ok: false };
    }

    const hint =
      resolver.hints?.find((h) => h.uid === hintUid) || resolver.hints?.[0];
    if (!hint) {
      setMfaError("No MFA method found on this account.");
      return { ok: false };
    }

    const containerId = recaptchaContainerId || "mfa-recaptcha";
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
      });
    }

    try {
      setMfaPending(true);

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        { multiFactorHint: hint, session: resolver.session },
        recaptchaRef.current
      );

      setMfaVerificationId(verificationId);
      return { ok: true };
    } catch (e) {
      console.error("sendMfaCode failed:", e);
      setMfaError(
        e?.message?.replace(/^Firebase:\s*/i, "") || "Could not send MFA code."
      );
      return { ok: false };
    } finally {
      setMfaPending(false);
    }
  }, []);

  const verifyMfa = useCallback(
    async (code) => {
      setMfaError("");
      const resolver = mfaResolverRef.current;
      if (!resolver || !mfaVerificationId) {
        setMfaError("MFA session expired. Please sign in again.");
        return { ok: false };
      }

      try {
        setMfaPending(true);

        const cred = PhoneAuthProvider.credential(
          mfaVerificationId,
          String(code || "").trim()
        );
        const assertion = PhoneMultiFactorGenerator.assertion(cred);

        await resolver.resolveSignIn(assertion);

        setMfaRequired(false);
        setMfaHints([]);
        setMfaVerificationId(null);
        mfaResolverRef.current = null;

        return { ok: true };
      } catch (e) {
        console.error("verifyMfa failed:", e);
        setMfaError(
          e?.message?.replace(/^Firebase:\s*/i, "") || "Invalid code. Try again."
        );
        return { ok: false };
      } finally {
        setMfaPending(false);
      }
    },
    [mfaVerificationId]
  );

  const clearMfaState = useCallback(() => {
    setMfaRequired(false);
    setMfaHints([]);
    setMfaError("");
    setMfaVerificationId(null);
    mfaResolverRef.current = null;
  }, []);

  // ---------------- MFA: Enrollment ----------------
  const startMfaEnrollment = useCallback(
    async (phoneNumber, recaptchaContainerId = "enroll-recaptcha") => {
      setMfaError("");
      if (!auth.currentUser) {
        setMfaError("You must be signed in to enable MFA.");
        return { ok: false };
      }

      try {
        setMfaPending(true);

        if (!recaptchaRef.current) {
          recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerId, {
            size: "invisible",
          });
        }

        const session = await multiFactor(auth.currentUser).getSession();
        const phoneAuthProvider = new PhoneAuthProvider(auth);

        const verificationId = await phoneAuthProvider.verifyPhoneNumber(
          { phoneNumber: String(phoneNumber || "").trim(), session },
          recaptchaRef.current
        );

        setMfaVerificationId(verificationId);
        return { ok: true };
      } catch (e) {
        console.error("startMfaEnrollment failed:", e);
        setMfaError(
          e?.message?.replace(/^Firebase:\s*/i, "") || "Could not start MFA enrollment."
        );
        return { ok: false };
      } finally {
        setMfaPending(false);
      }
    },
    []
  );

  const finishMfaEnrollment = useCallback(
    async (code, friendlyName = "My phone") => {
      setMfaError("");
      if (!auth.currentUser || !mfaVerificationId) {
        setMfaError("Enrollment session expired. Try again.");
        return { ok: false };
      }

      try {
        setMfaPending(true);

        const cred = PhoneAuthProvider.credential(
          mfaVerificationId,
          String(code || "").trim()
        );
        const assertion = PhoneMultiFactorGenerator.assertion(cred);

        await multiFactor(auth.currentUser).enroll(assertion, friendlyName);

        setMfaVerificationId(null);
        return { ok: true };
      } catch (e) {
        console.error("finishMfaEnrollment failed:", e);
        setMfaError(
          e?.message?.replace(/^Firebase:\s*/i, "") || "Could not enable MFA."
        );
        return { ok: false };
      } finally {
        setMfaPending(false);
      }
    },
    [mfaVerificationId]
  );

  const unenrollMfa = useCallback(async (factorUid) => {
    setMfaError("");
    if (!auth.currentUser) {
      setMfaError("You must be signed in.");
      return { ok: false };
    }
    try {
      setMfaPending(true);
      await multiFactor(auth.currentUser).unenroll(factorUid);
      return { ok: true };
    } catch (e) {
      console.error("unenrollMfa failed:", e);
      setMfaError(
        e?.message?.replace(/^Firebase:\s*/i, "") || "Could not disable MFA."
      );
      return { ok: false };
    } finally {
      setMfaPending(false);
    }
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

      beginLogin,
      mfaRequired,
      mfaHints,
      mfaError,
      mfaPending,
      sendMfaCode,
      verifyMfa,
      clearMfaState,

      startMfaEnrollment,
      finishMfaEnrollment,
      unenrollMfa,
    }),
    [
      user,
      profile,
      loading,
      authError,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
      beginLogin,
      mfaRequired,
      mfaHints,
      mfaError,
      mfaPending,
      sendMfaCode,
      verifyMfa,
      clearMfaState,
      startMfaEnrollment,
      finishMfaEnrollment,
      unenrollMfa,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
