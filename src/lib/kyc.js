// src/lib/kyc.js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../firebase";

/** Upload a KYC file to Firebase Storage and return its downloadURL + path */
export async function uploadKycFile(uid, file, key) {
  if (!file) return { url: null, path: null };
  const path = `users/${uid}/kyc/${Date.now()}-${key}-${file.name}`;
  const bucketRef = ref(storage, path);
  await uploadBytes(bucketRef, file);
  const url = await getDownloadURL(bucketRef);
  return { url, path };
}

/** Merge KYC payload on the user document (atomic). */
export async function saveKycSubmission(uid, payload) {
  const uRef = doc(db, "users", uid);
  const snap = await getDoc(uRef);
  const base = snap.exists() ? snap.data() : {};

  const next = {
    ...base,
    kycFiles: {
      ...(base.kycFiles || {}),
      ...(payload.kycFiles || {}),
    },
    kyc: {
      status: "submitted",
      submittedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reason: null,
      ...(base.kyc || {}),
    },
    updatedAt: serverTimestamp(),
  };
  await setDoc(uRef, next, { merge: true });
}

/** Admin-only: approve or reject KYC. */
export async function markKycStatus(uid, status, opts = {}) {
  const uRef = doc(db, "users", uid);
  const data = {
    "kyc.status": status,
    "kyc.reviewedAt": serverTimestamp(),
    "kyc.reviewedBy": opts.reviewerUid || null,
    "kyc.reason": opts.reason || null,
    updatedAt: serverTimestamp(),
  };

  // Optional: toggle partnerVerified when approved
  if (opts.setPartnerVerified) {
    data.partnerVerified = status === "approved";
  }

  await updateDoc(uRef, data);
} 
