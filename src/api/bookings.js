// src/api/bookings.js
// Luxury standard:
// - Payment confirmation & money state changes happen on SERVER + WEBHOOKS only.
// - Client never writes booking payment status to Firestore.
// - Client uses Bearer Firebase ID token for all protected API calls.

import { db, auth } from "../firebase";
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
  Timestamp,
} from "firebase/firestore";

/* ---------------- REST BASE + FETCH ---------------- */

// Normalise API root so we NEVER produce /api/api
// Supports either:
//   REACT_APP_API_BASE=http://localhost:4000
//   REACT_APP_API_BASE=http://localhost:4000/api
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  // force refresh token for sensitive operations
  return await u.getIdToken(true);
}

// generic JSON fetch helper (Bearer-token; no cookies)
async function fetchJson(url, options = {}) {
  const token = await getIdToken();

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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
      (typeof data === "string" && data) ||
      data?.error ||
      data?.message ||
      `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

// small helper to safely turn FS dates into ISO strings
function toIso(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === "function") v = v.toDate();
    else if (typeof v.seconds === "number") v = new Date(v.seconds * 1000);
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/* ============================================================================
   LUXURY: API-FIRST FLOW (NEW, RECOMMENDED)
   ========================================================================== */

/**
 * Create a booking hold via server (recommended).
 * Returns: { ok:true, bookingId, reference, expiresAt?, amountN? }
 */
export async function createBookingHoldAPI(payload) {
  const data = await fetchJson(`${API}/bookings/hold`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (data?.ok === false) throw new Error(data?.error || "Failed to create hold");
  return data;
}

/**
 * Get booking from server (recommended for polling after Paystack callback).
 * Returns: booking object
 */
export async function getBookingStatusAPI(bookingId) {
  if (!bookingId) throw new Error("Missing booking id");
  const data = await fetchJson(`${API}/bookings/${encodeURIComponent(bookingId)}`, {
    method: "GET",
  });

  if (data?.ok === false) throw new Error(data?.error || "Failed to fetch booking");
  return data?.booking ?? data; // support both shapes
}

/**
 * Optional: client “nudge” endpoint after payment callback.
 * NOTE: webhook is source of truth. This is for UX only.
 */
export async function notifyPaymentReceivedAPI({ bookingId, provider, reference }) {
  if (!bookingId) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(bookingId)}/payment-received`, {
    method: "POST",
    body: JSON.stringify({ provider, reference }),
  });
}

/* ============================================================================
   ADMIN / LEGACY API (kept for compatibility)
   ========================================================================== */

// Push booking snapshots into the admin JSON + payouts ledger
export async function syncBookingToAdminLedger(bookingId, statusOverride) {
  try {
    if (!bookingId) return;

    const ref = doc(db, "bookings", bookingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const b = snap.data() || {};
    const status = (statusOverride || b.status || "confirmed").toLowerCase();

    const createdAt = toIso(
      b.createdAt && b.createdAt.toDate ? b.createdAt : b.createdAt || b.created || null
    );

    const checkIn = toIso(b.checkIn || b.startDate || null);
    const checkOut = toIso(b.checkOut || b.endDate || null);

    const amount = Number(b.amountN ?? b.total ?? b.totalAmount ?? b.grossAmount ?? 0);

    const payload = {
      id: bookingId,
      status,
      listingId: b.listingId || null,
      listingTitle: b.listingTitle || b.title || "",
      guestEmail: b.email || b.guestEmail || "",
      hostEmail: b.hostEmail || b.ownerEmail || b.hostContactEmail || b.payeeEmail || "",
      nights: Number(b.nights || b.nightsCount || 1),
      totalAmount: amount,
      provider: b.provider || "paystack",
      reference: b.reference || b.gatewayRef || "",
      createdAt,
      checkIn,
      checkOut,
    };

    await fetchJson(`${API}/admin/bookings-sync`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[bookings] syncBookingToAdminLedger failed:", err);
  }
}

/** Return shape: { data: Booking[] } */
export async function listBookings(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  const data = await fetchJson(`${API}/bookings${q}`, { method: "GET" });
  return { data: Array.isArray(data) ? data : data?.data ?? [] };
}

/** Provide URL to download CSV */
export function exportCsvUrl(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  return `${API}/bookings/export.csv${q}`;
}

/** Real booking via backend API (legacy) */
export async function createBooking(body) {
  const payload = {
    email: body.email,
    title: body.title,
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: body.provider,
    reference: body.reference,
  };
  return fetchJson(`${API}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Demo booking when gateway key/script is missing (legacy) */
export async function createDemoBooking(body = {}) {
  const payload = {
    email: body.email || "test@example.com",
    title: body.title || "Demo Booking",
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: body.provider || "paystack",
    reference: body.reference || `NST_${Date.now()}`,
  };
  return fetchJson(`${API}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Optional test booking helper (legacy) */
export async function createTestBooking() {
  try {
    return await fetchJson(`${API}/bookings/test`, { method: "POST" });
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

/** Update status via server (legacy/admin) */
export async function setBookingStatus(id, status) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function verifyBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}/verify`, {
    method: "POST",
  });
}

export async function deleteBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* ============================================================================
   FIRESTORE FLOW (EXISTING) — KEEP ONLY FOR FALLBACK / NON-MONEY UPDATES
   ========================================================================== */

export async function createPendingBookingFS({
  listing,
  user,
  guests = 1,
  nights = 1,
  amountN = 0,
  idType,
  idLast4,
  consent = false,
  checkIn = null,
  checkOut = null,
  expiresAt = null,
}) {
  const payload = {
    // listing
    listingId: listing?.id || null,
    listingTitle: listing?.title || "",
    listingCity: listing?.city || "",
    listingArea: listing?.area || "",
    ownerId: listing?.ownerId || listing?.hostId || null,
    hostId: listing?.hostId || listing?.ownerId || null,
    partnerUid: listing?.partnerUid || null,
    ownershipType: listing?.ownerId ? "host" : listing?.partnerUid ? "partner" : null,

    // guest/user
    userId: user?.uid || null,
    guestId: user?.uid || null,
    email: user?.email || null,

    // stay
    guests: Number(guests || 1),
    nights: Number(nights || 0),
    amountN: Number(amountN || 0),
    checkIn: checkIn ? new Date(checkIn) : null,
    checkOut: checkOut ? new Date(checkOut) : null,

    // status/gateway (DO NOT set paid here)
    status: "pending",
    gateway: null,
    provider: null,
    reference: null,

    idCheck: {
      type: idType || null,
      last4: idLast4 || null,
      consent: !!consent,
    },

    expiresAt: expiresAt instanceof Date ? Timestamp.fromDate(expiresAt) : null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "bookings"), payload);
  return ref.id;
}

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

export async function markBookingConfirmedFS(
  bookingId,
  { provider = "paystack", reference = "" } = {}
) {
  try {
    await notifyPaymentReceivedAPI({ bookingId, provider, reference });
  } catch {}

  try {
    await syncBookingToAdminLedger(bookingId, "paid");
  } catch {}

  return { ok: true };
}

export async function markBookingFailedFS(bookingId, reason = "cancelled") {
  try {
    await fetchJson(`${API}/bookings/${encodeURIComponent(bookingId)}/payment-cancelled`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  } catch {}

  try {
    await syncBookingToAdminLedger(bookingId, String(reason));
  } catch {}

  return { ok: true };
}

export async function markBookingRefundedFS(bookingId, note = "manual_refund") {
  const ref = doc(db, "bookings", bookingId);
  await updateDoc(ref, {
    status: "refunded",
    gateway: note,
    updatedAt: serverTimestamp(),
  });

  await syncBookingToAdminLedger(bookingId, "refunded");
}

export async function releaseHoldFS(bookingId, note = "released_by_admin") {
  const ref = doc(db, "bookings", bookingId);
  await updateDoc(ref, {
    status: "expired",
    gateway: note,
    updatedAt: serverTimestamp(),
  });

  await syncBookingToAdminLedger(bookingId, "expired");
}

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

/* ============================================================================
   HOLDS COLLECTION (optional legacy)
   ========================================================================== */

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
    expiresAt,
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
