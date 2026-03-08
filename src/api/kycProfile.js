// src/api/kycProfile.js
import { db, storage } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteField,
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

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();
  if (r === "partner" || r === "verified_partner") return "partner";
  return "host";
}

function normalizeIntent(raw) {
  const s = String(raw || "").toLowerCase().trim();
  return s === "partner" ? "partner" : "host";
}

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
  return String(raw || "").toUpperCase().trim();
}

/**
 * Convenience helper – true if profile/status is approved.
 */
export function isKycApproved(profileOrStatus) {
  const status =
    typeof profileOrStatus === "string"
      ? String(profileOrStatus).toUpperCase().trim()
      : getKycStatusFromProfile(profileOrStatus);
  return OK_STATUSES.includes(status);
}

/**
 * Create a bare KYC profile document if it does not exist.
 * Safe to call multiple times – merge = true.
 */
export async function createInitialKycProfile(uid, role = "host", extras = {}) {
  if (!uid) return;

  const normalizedRole = normalizeRole(role);
  const normalizedIntent = normalizeIntent(extras?.intent || normalizedRole);
  const refDoc = doc(db, "kycProfiles", uid);

  await setDoc(
    refDoc,
    {
      uid,
      role: normalizedRole,
      intent: normalizedIntent,
      step: Number(extras?.step || 1),
      status: "DRAFT",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      // Canonical structure for uploads (map keyed by docType)
      uploads: {},

      // Optional tracking fields
      requiredDocTypes: [],
      declaration: {
        accepted: false,
        signature: "",
      },

      ...(extras?.email ? { email: extras.email } : {}),
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

  const data = snap.data() || {};
  return {
    id: snap.id,
    ...data,
    role: normalizeRole(data.role),
    intent: normalizeIntent(data.intent || data.role),
  };
}

/**
 * Merge arbitrary data into the kycProfiles/{uid} doc.
 */
export async function saveKycProfile(uid, data = {}) {
  if (!uid) throw new Error("Missing uid for saveKycProfile");

  const payload = { ...data };

  if ("role" in payload) payload.role = normalizeRole(payload.role);
  if ("intent" in payload) payload.intent = normalizeIntent(payload.intent);
  if (!("intent" in payload) && "role" in payload) payload.intent = normalizeIntent(payload.role);

  const refDoc = doc(db, "kycProfiles", uid);

  await setDoc(
    refDoc,
    {
      ...payload,
      uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * SAFEST way to store a file upload in Firestore.
 * Avoids serverTimestamp() inside arrays by:
 * - using uploads.<docType> map entries
 * - using uploadedAtMs: Date.now()
 */
export async function recordKycUpload(uid, docType, fileMeta) {
  if (!uid) throw new Error("Missing uid for recordKycUpload");
  if (!docType) throw new Error("Missing docType for recordKycUpload");
  if (!fileMeta?.url || !fileMeta?.path) {
    throw new Error("Missing fileMeta.url/path for recordKycUpload");
  }

  const refDoc = doc(db, "kycProfiles", uid);

  const patch = {
    status: "PENDING",
    [`uploads.${docType}`]: {
      docType,
      name: fileMeta.name || "",
      url: fileMeta.url,
      path: fileMeta.path,
      contentType: fileMeta.contentType || "",
      size: typeof fileMeta.size === "number" ? fileMeta.size : null,
      uploadedAtMs: Date.now(),
    },
    updatedAt: serverTimestamp(),
  };

  await setDoc(refDoc, patch, { merge: true });
}

/**
 * Optional helper: remove an upload entry from uploads map.
 */
export async function removeKycUpload(uid, docType) {
  if (!uid) throw new Error("Missing uid for removeKycUpload");
  if (!docType) throw new Error("Missing docType for removeKycUpload");

  const refDoc = doc(db, "kycProfiles", uid);
  await setDoc(
    refDoc,
    {
      [`uploads.${docType}`]: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Called on final submit – marks KYC as submitted / in review.
 */
export async function submitKycForReview({
  uid,
  role,
  intent,
  email,
  step = 3,
}) {
  if (!uid) throw new Error("Missing uid for submitKycForReview");

  const normalizedRole = normalizeRole(role || intent || "host");
  const normalizedIntent = normalizeIntent(intent || role || "host");

  const refDoc = doc(db, "kycProfiles", uid);

  await setDoc(
    refDoc,
    {
      uid,
      role: normalizedRole,
      intent: normalizedIntent,
      email: email || "",
      status: "SUBMITTED",
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      step: Number(step || 3),
    },
    { merge: true }
  );
}

/**
 * List all uploaded KYC files for a user from Storage.
 * Supports both:
 * - flat:   kyc/{uid}/file.pdf
 * - typed:  kyc/{uid}/{docType}/file.pdf
 *
 * Returns [{ name, url, fullPath }]
 */
export async function listKycFiles(uid) {
  if (!uid) return [];

  const rootRef = ref(storage, `kyc/${uid}`);
  const rootRes = await listAll(rootRef);

  const rootItems = await Promise.all(
    rootRes.items.map(async (item) => ({
      name: item.name,
      fullPath: item.fullPath,
      url: await getDownloadURL(item),
    }))
  );

  const folderItems = [];
  for (const prefix of rootRes.prefixes || []) {
    const subRes = await listAll(prefix);
    const subItems = await Promise.all(
      subRes.items.map(async (item) => ({
        name: item.name,
        fullPath: item.fullPath,
        url: await getDownloadURL(item),
      }))
    );
    folderItems.push(...subItems);
  }

  return [...rootItems, ...folderItems];
}

/**
 * Upload a single KYC document to Storage.
 *
 * Options:
 * - docType: if provided, stores under kyc/{uid}/{docType}/...
 * - onProgress(pct): optional
 *
 * Returns { url, path, name, contentType, size }.
 */
export async function uploadKycDocument(uid, file, onProgress, options = {}) {
  if (!uid) throw new Error("Missing uid for uploadKycDocument");
  if (!file) throw new Error("Missing file for uploadKycDocument");

  const safeName = String(file.name || "document").replace(/\s+/g, "_");
  const docType = options?.docType ? String(options.docType) : "";

  const storagePath = docType
    ? `kyc/${uid}/${docType}/${Date.now()}_${safeName}`
    : `kyc/${uid}/${Date.now()}_${safeName}`;

  const objectRef = ref(storage, storagePath);

  const task = uploadBytesResumable(objectRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (!snap.totalBytes) return;
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
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
    contentType: file.type || "",
    size: file.size || null,
  };
}