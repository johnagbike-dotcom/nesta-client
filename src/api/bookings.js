// src/api/bookings.js
// Rules:
// - Payment state changes happen on SERVER + WEBHOOKS only.
// - Client never writes booking payment status to Firestore.
// - Client must send Bearer Firebase ID token for protected API calls.

import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
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

// Supports both CRA and Vite envs:
// - CRA:  process.env.REACT_APP_API_BASE
// - Vite: import.meta.env.VITE_API_BASE_URL
function getEnvApiBase() {
  const viteBase =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE);

  const craBase = process.env.REACT_APP_API_BASE;

  return (viteBase || craBase || "http://localhost:4000").toString().trim();
}

// Normalise API root so we NEVER produce /api/api
function normaliseApiRoot(rawBase) {
  const base = String(rawBase || "").replace(/\/+$/, "");
  return /\/api$/i.test(base) ? base : `${base}/api`;
}

const API = normaliseApiRoot(getEnvApiBase());

/* ---------------- AUTH TOKEN (HARDENED) ---------------- */

// Wait for Firebase Auth to hydrate (prevents false "logged out" reads (auth.currentUser null))
function waitForAuthUser({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    let done = false;
    let unsub = null;

    const stop = (u) => {
      if (done) return;
      done = true;
      try {
        if (typeof unsub === "function") unsub();
      } catch {}
      resolve(u || auth.currentUser || null);
    };

    unsub = onAuthStateChanged(auth, (u) => stop(u));
    setTimeout(() => stop(auth.currentUser || null), timeoutMs);
  });
}

// Strict token getter: if requireAuth is true, this MUST return a token or throw.
async function getIdToken({ forceRefresh = false, waitUser = true, requireAuth = false } = {}) {
  const u = auth.currentUser || (waitUser ? await waitForAuthUser() : null);

  if (!u) {
    if (requireAuth) {
      const err = new Error("Unauthorized");
      err.status = 401;
      err.reason = "no_current_user";
      throw err;
    }
    return null;
  }

  try {
    return await u.getIdToken(!!forceRefresh);
  } catch (e) {
    if (requireAuth) {
      const err = new Error("Unauthorized");
      err.status = 401;
      err.reason = "token_fetch_failed";
      err.cause = e;
      throw err;
    }
    return null;
  }
}

// Provider normalisation used across flows (paystack/flutterwave)
export function normalizeProvider(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s.includes("flutter")) return "flutterwave";
  if (s.includes("paystack")) return "paystack";
  return s || "";
}

// generic JSON fetch helper (Bearer-token; no cookies)
// ✅ Retries ONCE on 401 with a forced token refresh
async function fetchJson(url, options = {}) {
  const {
    requireAuth = false,
    forceRefresh = false,
    waitUser = true,
    headers = {},
    retryOn401 = true,
    ...rest
  } = options;

  const doFetch = async (forced) => {
    const token = await getIdToken({
      forceRefresh: forced || forceRefresh,
      waitUser,
      requireAuth,
    });

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...rest,
    });

    const text = await res.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { res, data };
  };

  // 1) First attempt
  let { res, data } = await doFetch(false);

  // 2) If unauthorized and allowed, retry once with forced refresh
  if (res.status === 401 && retryOn401 && requireAuth) {
    ({ res, data } = await doFetch(true));
  }

  if (!res.ok) {
    const message =
      (typeof data === "string" && data) ||
      data?.error ||
      data?.message ||
      `${res.status} ${res.statusText}`;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    err.url = url;
    throw err;
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
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/* =====================================================================
   API-FIRST FLOW (RECOMMENDED)
   ===================================================================== */

export async function getAvailabilityAPI({ listingId, checkIn, checkOut }) {
  const qs = new URLSearchParams({
    listingId: String(listingId || ""),
    checkIn: String(checkIn || ""),
    checkOut: String(checkOut || ""),
  }).toString();

  const data = await fetchJson(`${API}/bookings/availability?${qs}`, {
    method: "GET",
    requireAuth: false,
    retryOn401: false,
  });

  if (data?.ok === false) throw new Error(data?.error || "Failed to check availability");
  return data;
}

/**
 * Create a booking hold via server.
 * Returns: { ok:true, bookingId, reference, expiresAt?, amountN? }
 */
export async function createBookingHoldAPI(payload) {
  const data = await fetchJson(`${API}/bookings/hold`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    requireAuth: true,
    forceRefresh: true,
    waitUser: true,
    retryOn401: true,
  });

  if (data?.ok === false) throw new Error(data?.error || "Failed to create hold");
  return data;
}

/**
 * Get booking from server (recommended for polling after callback).
 *
 * IMPORTANT:
 * - BookingCompletePage may pass a bookingId OR a gateway reference.
 * - Your server can choose to support either.
 *
 * This client:
 *  1) tries GET /bookings/:idOrRef
 *  2) if 404/400, tries optional resolve-style fallbacks (safe if not implemented)
 */
export async function getBookingStatusAPI(bookingIdOrRef) {
  const key = String(bookingIdOrRef || "").trim();
  if (!key) throw new Error("Missing booking id");

  // (1) Primary path (recommended)
  try {
    const data = await fetchJson(`${API}/bookings/${encodeURIComponent(key)}`, {
      method: "GET",
      requireAuth: true,
      waitUser: true,
      retryOn401: true,
    });

    if (data?.ok === false) throw new Error(data?.error || "Failed to fetch booking");
    return data?.booking ?? data;
  } catch (e) {
    const status = e?.status;

    // Only attempt fallbacks on common "not found / bad param" cases
    const shouldTryFallback = status === 404 || status === 400;

    if (!shouldTryFallback) throw e;

    // (2) Fallback A: /bookings/resolve?reference=
    // Safe even if not implemented (will throw and we'll continue)
    try {
      const qs = new URLSearchParams({ reference: key }).toString();
      const data = await fetchJson(`${API}/bookings/resolve?${qs}`, {
        method: "GET",
        requireAuth: true,
        waitUser: true,
        retryOn401: true,
      });
      if (data?.ok === false) throw new Error(data?.error || "Failed to resolve booking");
      return data?.booking ?? data;
    } catch {}

    // (3) Fallback B: /bookings/by-reference?ref=
    try {
      const qs = new URLSearchParams({ ref: key }).toString();
      const data = await fetchJson(`${API}/bookings/by-reference?${qs}`, {
        method: "GET",
        requireAuth: true,
        waitUser: true,
        retryOn401: true,
      });
      if (data?.ok === false) throw new Error(data?.error || "Failed to resolve booking");
      return data?.booking ?? data;
    } catch {}

    // If no fallback worked, throw original error
    throw e;
  }
}

/**
 * Optional: client “nudge” endpoint after payment callback.
 * Webhook is source of truth; this is UX only.
 */
export async function notifyPaymentReceivedAPI({ bookingId, provider, reference }) {
  const id = String(bookingId || "").trim();
  if (!id) throw new Error("Missing booking id");

  const p = normalizeProvider(provider);
  const ref = String(reference || "").trim();

  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}/payment-received`, {
    method: "POST",
    body: JSON.stringify({ provider: p, reference: ref }),
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

/* =====================================================================
   ADMIN / LEGACY API (kept for compatibility)
   ===================================================================== */

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
      provider: normalizeProvider(b.provider || "paystack"),
      reference: b.reference || b.gatewayRef || "",
      createdAt,
      checkIn,
      checkOut,
    };

    await fetchJson(`${API}/admin/bookings-sync`, {
      method: "POST",
      body: JSON.stringify(payload),
      requireAuth: true,
      waitUser: true,
      retryOn401: true,
    });
  } catch (err) {
    console.warn("[bookings] syncBookingToAdminLedger failed:", err);
  }
}

export async function listBookings(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  const data = await fetchJson(`${API}/bookings${q}`, {
    method: "GET",
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
  return { data: Array.isArray(data) ? data : data?.data ?? [] };
}

export function exportCsvUrl(queryStr = "") {
  const q = queryStr ? `?q=${encodeURIComponent(queryStr)}` : "";
  return `${API}/bookings/export.csv${q}`;
}

export async function createBooking(body) {
  const payload = {
    email: body.email,
    title: body.title,
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: normalizeProvider(body.provider),
    reference: body.reference,
  };
  return fetchJson(`${API}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

export async function createDemoBooking(body = {}) {
  const payload = {
    email: body.email || "test@example.com",
    title: body.title || "Demo Booking",
    nights: Number(body.nights || 1),
    total: Number(body.total || 0),
    provider: normalizeProvider(body.provider || "paystack"),
    reference: body.reference || `NST_${Date.now()}`,
  };
  return fetchJson(`${API}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

export async function createTestBooking() {
  try {
    return await fetchJson(`${API}/bookings/test`, {
      method: "POST",
      requireAuth: true,
      waitUser: true,
      retryOn401: true,
    });
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

export async function setBookingStatus(id, status) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

export async function verifyBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

export async function deleteBooking(id) {
  if (!id) throw new Error("Missing booking id");
  return fetchJson(`${API}/bookings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    requireAuth: true,
    waitUser: true,
    retryOn401: true,
  });
}

/* =====================================================================
   FIRESTORE FLOW (FALLBACK / NON-MONEY UPDATES ONLY)
   ===================================================================== */

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
    listingId: listing?.id || null,
    listingTitle: listing?.title || "",
    listingCity: listing?.city || "",
    listingArea: listing?.area || "",
    ownerId: listing?.ownerId || listing?.hostId || null,
    hostId: listing?.hostId || listing?.ownerId || null,
    partnerUid: listing?.partnerUid || null,
    ownershipType: listing?.ownerId ? "host" : listing?.partnerUid ? "partner" : null,

    userId: user?.uid || null,
    guestId: user?.uid || null,
    email: user?.email || null,

    guests: Number(guests || 1),
    nights: Number(nights || 0),
    amountN: Number(amountN || 0),
    checkIn: checkIn ? new Date(checkIn) : null,
    checkOut: checkOut ? new Date(checkOut) : null,

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

export async function markBookingConfirmedFS(bookingId, { provider = "paystack", reference = "" } = {}) {
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
      requireAuth: true,
      waitUser: true,
      retryOn401: true,
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

/* =====================================================================
   HOLDS COLLECTION (optional legacy)
   ===================================================================== */

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