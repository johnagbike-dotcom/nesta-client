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

export const app = initializeApp(firebaseConfig);

// IMPORTANT: create Firestore ONCE here
export const db = initializeFirestore(app, {
  localCache:
    process.env.NODE_ENV === "production"
      ? persistentLocalCache()
      : memoryLocalCache(),
});

export const auth = getAuth(app);
export const storage = getStorage(app);

export { signInWithEmailAndPassword };
