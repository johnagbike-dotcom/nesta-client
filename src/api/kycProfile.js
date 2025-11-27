// src/api/kycProfile.js
import { db, storage } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
} from "firebase/storage";

/**
 * Statuses that count as fully approved.
 */
export const OK_STATUSES = ["APPROVED", "VERIFIED", "COMPLETE"];

/**
 * Normalise KYC status from a user profile or kycProfile doc.
 */
export function getKycStatusFromProfile(profile, fallback) {
  const raw =
    profile?.kycStatus ||
    profile?.kyc?.status ||
    profile?.kyc?.state ||
    profile?.status ||
    fallback ||
    "";
  return String(raw || "").toUpperCase();
}

/**
 * Convenience helper – true if profile/status is approved.
 */
export function isKycApproved(profileOrStatus) {
  const status =
    typeof profileOrStatus === "string"
      ? String(profileOrStatus).toUpperCase()
      : getKycStatusFromProfile(profileOrStatus);
  return OK_STATUSES.includes(status);
}

/**
 * Create a bare KYC profile document if it does not exist.
 * Safe to call multiple times – merge = true.
 */
export async function createInitialKycProfile(uid, role = "host") {
  if (!uid) return;
  const refDoc = doc(db, "kycProfiles", uid);

  await setDoc(
    refDoc,
    {
      uid,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "DRAFT", // not yet submitted
      step: 1,
    },
    { merge: true }
  );
}

/**
 * Load the kycProfiles/{uid} doc.
 */
export async function loadKycProfile(uid) {
  if (!uid) return null;
  const refDoc = doc(db, "kycProfiles", uid);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Merge arbitrary data into the kycProfiles/{uid} doc.
 */
export async function saveKycProfile(uid, data) {
  if (!uid) throw new Error("Missing uid for saveKycProfile");
  const refDoc = doc(db, "kycProfiles", uid);

  await setDoc(
    refDoc,
    {
      ...data,
      uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Called on final submit – marks KYC as submitted / in review.
 */
export async function startKycFlow({ uid, role, email }) {
  if (!uid) return;

  const refDoc = doc(db, "kycProfiles", uid);
  await setDoc(
    refDoc,
    {
      uid,
      role: role || "host",
      email: email || "",
      status: "SUBMITTED", // your reviewer can later move to APPROVED / REJECTED
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * List all uploaded KYC files for a user.
 * Returns [{ name, url, fullPath }]
 */
export async function listKycFiles(uid) {
  if (!uid) return [];
  const baseRef = ref(storage, `kyc/${uid}`);
  const res = await listAll(baseRef);

  const items = await Promise.all(
    res.items.map(async (item) => ({
      name: item.name,
      fullPath: item.fullPath,
      url: await getDownloadURL(item),
    }))
  );

  return items;
}

/**
 * Upload a single KYC document.
 * onProgress(pct) is optional.
 * Returns { url, path, name }.
 */
export async function uploadKycDocument(uid, file, onProgress) {
  if (!uid) throw new Error("Missing uid for uploadKycDocument");
  if (!file) throw new Error("Missing file for uploadKycDocument");

  const safeName = file.name.replace(/\s+/g, "_");
  const objectRef = ref(storage, `kyc/${uid}/${Date.now()}_${safeName}`);

  const task = uploadBytesResumable(objectRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (!snap.totalBytes) return;
        const pct = Math.round(
          (snap.bytesTransferred / snap.totalBytes) * 100
        );
        if (onProgress) onProgress(pct);
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const url = await getDownloadURL(objectRef);
  return {
    url,
    path: objectRef.fullPath,
    name: file.name,
  };
}
