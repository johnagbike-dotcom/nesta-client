// src/api/bookings.js

// ---------------- FIRESTORE ----------------
import { db } from "../firebase";
import {
  addDoc,
  updateDoc,
  serverTimestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  Timestamp,
  deleteDoc,
  setDoc,
} from "firebase/firestore";

// ---------------- REST BASE + FETCH ----------------
const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      (typeof data === "string" && data) || data?.error || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

// ======================= REST (unchanged) =======================

/** Return shape: { data: Booking[] } */
export async function listBookings(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  const data = await fetchJson(`${API_BASE}/api/bookings${q}`);
  return { data: Array.isArray(data) ? data : data?.data ?? [] };
}

/** Provide URL to download CSV */
export function exportCsvUrl(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  return `${API_BASE}/api/bookings/export.csv${q}`;
}

/** Real booking via backend API (paystack/flutterwave) */
export async function createBooking(body) {
  const payload = {
    email: body.email,
    title: body.title,
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: body.provider,
    reference: body.reference,
  };
  return fetchJson(`${API_BASE}/api/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Demo booking when gateway key/script is missing */
export async function createDemoBooking(body = {}) {
  const payload = {
    email: body.email || "test@example.com",
    title: body.title || "Demo Booking",
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: body.provider || "paystack",
    reference: body.reference || `NST_${Date.now()}`,
  };
  return fetchJson(`${API_BASE}/api/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Optional test booking helper */
export async function createTestBooking() {
  try {
    return await fetchJson(`${API_BASE}/api/bookings/test`, { method: "POST" });
  } catch {
    return createDemoBooking({
      email: "test@example.com",
      title: "Test Booking",
      nights: 1,
      total: 20000,
      provider: "paystack",
      reference: `NST_${Date.now().toString(36)}`,
    });
  }
}

/** Update status via server */
export async function setBookingStatus(id, status) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function verifyBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/verify`, {
    method: "POST",
  });
}

export async function deleteBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API_BASE}/api/bookings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ======================= FIRESTORE FLOW =======================

/**
* Create a PENDING booking *before* opening the payment popup.
* Stores enough context for the hold + later confirmation.
*/
export async function createPendingBookingFS({
  listing,       // { id, title, city, area, pricePerNight, ownerId/hostId/partnerUid? }
  user,          // Firebase auth user
  guests = 1,
  nights = 1,
  amountN = 0,   // total in Naira
  idType,
  idLast4,
  consent = false,
  checkIn = null,   // "YYYY-MM-DD" or Date
  checkOut = null,  // "YYYY-MM-DD" or Date
  expiresAt = null, // Date
}) {
  const hostOrPartner = listing?.hostId || listing?.ownerId || listing?.partnerUid || null;

  const payload = {
    // listing
    listingId: listing?.id || null,
    listingTitle: listing?.title || "",
    listingCity: listing?.city || "",
    listingArea: listing?.area || "",
    ownerId: listing?.ownerId || listing?.hostId || null, // normalized
    hostId: listing?.hostId || listing?.ownerId || null,  // legacy
    partnerUid: listing?.partnerUid || null,
    ownershipType: listing?.ownerId ? "host" : listing?.partnerUid ? "partner" : null,

    // guest/user
    userId: user?.uid || null,  // used across pages
    guestId: user?.uid || null, // duplicate for clarity
    email: user?.email || null,

    // stay
    guests: Number(guests || 1),
    nights: Number(nights || 0),
    amountN: Number(amountN || 0),
    checkIn: checkIn ? new Date(checkIn) : null,
    checkOut: checkOut ? new Date(checkOut) : null,

    // status/gateway
    status: "pending", // -> confirmed | failed | cancelled | refunded | expired
    gateway: null,
    provider: null,
    reference: null,

    // lightweight ID check
    idCheck: {
      type: idType || null,
      last4: idLast4 || null,
      consent: !!consent,
    },

    // hold expiry
    expiresAt: expiresAt instanceof Date ? Timestamp.fromDate(expiresAt) : null,

    // audit
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "bookings"), payload);
  return ref.id;
}

/**
* Ensure a single pending hold (with TTL). Returns { id, expiresAt }
*/
export async function ensurePendingHoldFS({
  listing,
  user,
  guests = 1,
  nights = 1,
  amountN = 0,
  idType,
  idLast4,
  consent,
  checkIn,
  checkOut,
  ttlMinutes = 90,
}) {
  // Try reuse latest pending that hasn't expired
  const qy = query(
    collection(db, "bookings"),
    where("userId", "==", user?.uid || null),
    where("listingId", "==", listing?.id || null),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(qy);
  if (!snap.empty) {
    const docRef = snap.docs[0];
    const d = docRef.data() || {};
    const exp =
      d.expiresAt?.toDate ? d.expiresAt.toDate() : d.expiresAt ? new Date(d.expiresAt) : null;
    if (exp && exp.getTime() > Date.now()) {
      return { id: docRef.id, expiresAt: exp };
    }
  }

  // Create a fresh hold
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const id = await createPendingBookingFS({
    listing,
    user,
    guests,
    nights,
    amountN,
    idType,
    idLast4,
    consent,
    checkIn,
    checkOut,
    expiresAt,
  });
  return { id, expiresAt };
}

/** Confirm booking after payment */
export async function markBookingConfirmedFS(
  bookingId,
  { provider = "paystack", reference = "" } = {}
) {
  const ref = doc(db, "bookings", bookingId);
  await updateDoc(ref, {
    status: "confirmed",
    gateway: "success",
    provider,
    reference,
    updatedAt: serverTimestamp(),
  });
}

/** Mark booking failed/cancelled (reason used in `gateway`) */
export async function markBookingFailedFS(bookingId, reason = "cancelled") {
  const ref = doc(db, "bookings", bookingId);
  const normalized = reason === "cancelled" ? "cancelled" : reason === "expired" ? "expired" : "failed";
  await updateDoc(ref, {
    status: normalized,
    gateway: reason,
    updatedAt: serverTimestamp(),
  });
}

/** Mark confirmed booking as refunded (admin/ops) */
export async function markBookingRefundedFS(bookingId, note = "manual_refund") {
  const ref = doc(db, "bookings", bookingId);
  await updateDoc(ref, {
    status: "refunded",
    gateway: note,
    updatedAt: serverTimestamp(),
  });
}

/** Release a pending hold (host/partner/admin action) */
export async function releaseHoldFS(bookingId, note = "released_by_admin") {
  const ref = doc(db, "bookings", bookingId);
  await updateDoc(ref, {
    status: "expired",
    gateway: note,
    updatedAt: serverTimestamp(),
  });
}

/** Legacy alias some code may still call */
export async function markBookingExpiredFS(bookingId) {
  return releaseHoldFS(bookingId, "expired");
}

/** Auto-expire pending bookings whose expiresAt is in the past */
export async function expireStaleBookings() {
  try {
    const snap = await getDocs(collection(db, "bookings"));
    const now = Date.now();
    const ops = [];
    snap.forEach((d) => {
      const b = d.data();
      if (b.status !== "pending") return;
      const exp = b.expiresAt?.toDate ? b.expiresAt.toDate() : b.expiresAt ? new Date(b.expiresAt) : null;
      if (exp && exp.getTime() < now) {
        ops.push(
          updateDoc(doc(db, "bookings", d.id), {
            status: "expired",
            gateway: "timeout",
            updatedAt: serverTimestamp(),
          })
        );
      }
    });
    if (ops.length) await Promise.all(ops);
  } catch (e) {
    console.error("Auto-expire cleanup failed:", e);
  }
}

// ======================= HOLDS COLLECTION (optional) =======================
// If you use the separate /holds collection anywhere, keep these helpers.

export async function fetchActiveHoldsFS({ guestId, listingId, checkIn, checkOut }) {
  if (!guestId || !listingId) return [];
  const sig = `${guestId}|${listingId}|${checkIn}|${checkOut}`;
  const snap = await getDocs(
    query(
      collection(db, "holds"),
      where("guestId", "==", guestId),
      where("listingId", "==", listingId),
      where("signature", "==", sig),
      orderBy("createdAt", "desc"),
      limit(5)
    )
  );
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((h) => h.status === "active" && Number(h.expiresAt || 0) > now);
}

export async function createHoldFS({ guest, listing, nights, checkIn, checkOut }) {
  if (!guest?.uid) throw new Error("Missing guest");
  if (!listing?.id) throw new Error("Missing listing");
  const HOLD_MINUTES = 90;
  const now = Date.now();
  const expiresAt = now + HOLD_MINUTES * 60 * 1000;
  const signature = `${guest.uid}|${listing.id}|${checkIn}|${checkOut}`;
  const payload = {
    listingId: listing.id,
    listingTitle: listing.title || "",
    hostId: listing.hostId || listing.ownerId || null,
    guestId: guest.uid,
    nights: Number(nights || 1),
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    createdAt: serverTimestamp(),
    expiresAt, // ms epoch; easy to compare on client
    status: "active",
    signature,
  };
  const ref = await addDoc(collection(db, "holds"), payload);
  return { id: ref.id, ...payload };
}

export async function cancelHoldFS(holdId) {
  if (!holdId) return;
  const ref = doc(db, "holds", holdId);
  await updateDoc(ref, { status: "cancel_request", updatedAt: serverTimestamp() });
}

export async function convertHoldFS(holdId) {
  try {
    if (!holdId) return;
    const ref = doc(db, "holds", holdId);
    await updateDoc(ref, { status: "converted", updatedAt: serverTimestamp() });
  } catch {}
}

export async function getHoldFS(holdId) {
  if (!holdId) return null;
  const snap = await getDoc(doc(db, "holds", holdId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
} 
