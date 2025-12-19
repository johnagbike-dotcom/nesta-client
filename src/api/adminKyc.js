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
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

/**
 * Pull from onboarding queue (recommended) because that’s what admin reviews.
 * Falls back to users.kyc.status if needed.
 */
export async function listPendingKyc(max = 200, status = "PENDING") {
  // 1) Try onboarding collection
  try {
    const col = collection(db, "onboarding");
    const q1 = query(
      col,
      where("status", "==", status),
      orderBy("submittedAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q1);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[adminKyc] onboarding query failed, fallback to users:", err?.message || err);
  }

  // 2) Fallback: users where kyc.status == submitted
  const col2 = collection(db, "users");
  try {
    const q2 = query(
      col2,
      where("kyc.status", "==", "submitted"),
      orderBy("updatedAt", "desc"),
      limit(max)
    );
    const snap2 = await getDocs(q2);
    return snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[adminKyc] users query fallback failed:", err?.message || err);
    return [];
  }
}

async function getKycRole(uid) {
  try {
    const snap = await getDoc(doc(db, "kycProfiles", uid));
    if (!snap.exists()) return "host";
    const role = String(snap.data()?.role || "host").toLowerCase();
    return role === "partner" ? "partner" : "host";
  } catch {
    return "host";
  }
}

/** Approve KYC for a given user id */
export async function approveKyc(userId) {
  if (!userId) throw new Error("Missing userId");

  const role = await getKycRole(userId);

  // users/{uid} -> role + kyc approved
  await setDoc(
    doc(db, "users", userId),
    {
      role,
      kycStatus: "approved",
      kyc: {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: "admin",
        reason: null,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // kycProfiles/{uid} -> status approved
  await setDoc(
    doc(db, "kycProfiles", userId),
    {
      status: "APPROVED",
      reviewedAt: serverTimestamp(),
      reviewedBy: "admin",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // onboarding/{uid} -> approved
  await setDoc(
    doc(db, "onboarding", userId),
    {
      status: "APPROVED",
      reviewedAt: serverTimestamp(),
      reviewedBy: "admin",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Reject KYC with a reason */
export async function rejectKyc(userId, reason = "") {
  if (!userId) throw new Error("Missing userId");

  const why = String(reason || "Not specified").trim();

  await updateDoc(doc(db, "users", userId), {
    kycStatus: "rejected",
    "kyc.status": "rejected",
    "kyc.reviewedAt": serverTimestamp(),
    "kyc.reviewedBy": "admin",
    "kyc.reason": why,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "kycProfiles", userId),
    {
      status: "REJECTED",
      reviewedAt: serverTimestamp(),
      reviewedBy: "admin",
      reason: why,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "onboarding", userId),
    {
      status: "REJECTED",
      reviewedAt: serverTimestamp(),
      reviewedBy: "admin",
      reason: why,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
