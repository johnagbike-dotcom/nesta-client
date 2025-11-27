// src/api/adminKyc.js
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
* Load users with KYC status "submitted".
* Tries a proper indexed query; if Firestore asks for an index,
* we fall back to scanning a limited set and filtering client-side.
*/
export async function listPendingKyc(max = 200) {
  const col = collection(db, "users");
  try {
    const q = query(
      col,
      where("kyc.status", "==", "submitted"),
      orderBy("updatedAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback: scan a capped set and filter client-side (less efficient)
    console.warn("[adminKyc] Index likely missing, falling back. Err:", err?.message || err);
    const q2 = query(col, orderBy("updatedAt", "desc"), limit(max));
    const snap2 = await getDocs(q2);
    return snap2.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u?.kyc?.status === "submitted");
  }
}

/** Approve KYC for a given user id */
export async function approveKyc(userId) {
  if (!userId) throw new Error("Missing userId");
  const ref = doc(db, "users", userId);
  await updateDoc(ref, {
    "kyc.status": "approved",
    "kyc.reviewedAt": serverTimestamp(),
    "kyc.reviewedBy": "admin", // optional: replace with current admin uid if you store it in context
    "kyc.reason": null,
    updatedAt: serverTimestamp(),
  });
}

/** Reject KYC with a reason (short text) */
export async function rejectKyc(userId, reason = "") {
  if (!userId) throw new Error("Missing userId");
  const ref = doc(db, "users", userId);
  await updateDoc(ref, {
    "kyc.status": "rejected",
    "kyc.reviewedAt": serverTimestamp(),
    "kyc.reviewedBy": "admin", // optional: replace with admin uid
    "kyc.reason": reason || "Not specified",
    updatedAt: serverTimestamp(),
  });
} 