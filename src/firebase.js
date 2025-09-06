// src/firebase.js
// Initializes Firebase and exports Auth/Firestore helpers.
// Includes Email/Password, Phone (invisible reCAPTCHA), and Google sign-in.

import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChSclnlmPvguNMgVs0VDQFqxxTNFV9dgg",
  authDomain: "nesta-e08aa.firebaseapp.com",
  projectId: "nesta-e08aa",
  storageBucket: "nesta-e08aa.firebasestorage.app",
  messagingSenderId: "598162550264",
  appId: "1:598162550264:web:608284b352be3bdbf0fa0d",
  measurementId: "G-PYS8BZYXFE"
};

// Init
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // ✅ properly exported now

// Persist sessions in localStorage
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* ───────────── Email/Password helpers ───────────── */
export async function signUpWithEmail({ email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user.uid, {
    email: cred.user.email ?? email,
    provider: "password",
  });
  return cred.user;
}

export function signInWithEmail({ email, password }) {
  return signInWithEmailAndPassword(auth, email, password).then((r) => r.user);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/* ───────────── Google Sign-in helper ───────────── */
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await ensureUserProfile(user.uid, {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    provider: "google",
  });
  return user;
}

/* ───────────── Phone sign-in helpers ───────────── */
let recaptchaVerifier = null;

export function setupRecaptcha(containerIdOrButton = "recaptcha-container") {
  recaptchaVerifier = new RecaptchaVerifier(auth, containerIdOrButton, {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export function signInWithPhone(phoneNumber) {
  if (!recaptchaVerifier) throw new Error("Call setupRecaptcha() first.");
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

/* ───────────── Ensure profile doc ───────────── */
export async function ensureUserProfile(uid, extra = {}) {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    await setDoc(uref, {
      uid,
      role: null,                  // "host" | "agent" after selection
      isSubscribed: false,         // guest subscription
      isHostSubscribed: false,     // optional host/agent entitlements
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    });
  } else if (Object.keys(extra).length) {
    await setDoc(
      uref,
      { updatedAt: serverTimestamp(), ...extra },
      { merge: true }
    );
  }
  return uref;
}