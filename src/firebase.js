// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
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

// ---- init ----
const app = initializeApp(firebaseConfig);
// Firestore with a dev-safe cache (avoids IndexedDB issues during local dev)
const db = initializeFirestore(app, {
  localCache:
    process.env.NODE_ENV === "production"
      ? persistentLocalCache() // use persistent cache in prod if you want offline
      : memoryLocalCache(),    // use memory cache in dev
});
// Auth & Storage
const auth = getAuth(app);
const storage = getStorage(app);

// ---- named exports (no default) ----
export { app, db, auth, storage, signInWithEmailAndPassword };
