// src/lib/userProfile.js
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Persist role to Firestore + localStorage */
export async function setUserRole(uid, role) {
  await setDoc(doc(db, "users", uid), { role }, { merge: true });
  localStorage.setItem("nesta_role", role);
  localStorage.setItem("userRole", role);
}