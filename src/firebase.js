// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyChSclnlmPvguNMgVs0VDQFqxxTNFV9dgg",
  authDomain: "nesta-e08aa.firebaseapp.com",
  projectId: "nesta-e08aa",

  // ✅ RESTORE: this is the bucket your project is using
  storageBucket: "nesta-e08aa.firebasestorage.app",

  messagingSenderId: "598162550264",
  appId: "1:598162550264:web:608284b352be3bdbf0fa0d",
  measurementId: "G-PYS8BZYXFE",
};

export const app = initializeApp(firebaseConfig);

// Firestore ONCE
export const db = initializeFirestore(app, {
  localCache:
    process.env.NODE_ENV === "production"
      ? persistentLocalCache()
      : memoryLocalCache(),
});

export const auth = getAuth(app);

// ✅ IMPORTANT: do NOT force a different bucket here.
// Let Firebase use the bucket from firebaseConfig.
export const storage = getStorage(app);

export { signInWithEmailAndPassword };

// dev helper (safe)
if (typeof window !== "undefined") {
  window.__nesta = window.__nesta || {};
  window.__nesta.auth = auth;
  window.__nesta.db = db;
  window.__nesta.storage = storage;
}
