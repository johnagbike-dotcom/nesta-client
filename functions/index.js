// functions/index.js (2nd Gen, same name: unlockContact)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

// Global 2nd-Gen runtime options (tweak as needed)
setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 30,
  minInstances: 0
});

async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function userHasConfirmedBooking({ guestUid, listingId }) {
  const qs = await db
    .collection("bookings")
    .where("guestUid", "==", guestUid)
    .where("listingId", "==", listingId)
    .where("status", "in", ["paid", "confirmed"])
    .limit(1)
    .get();
  return !qs.empty;
}

exports.unlockContact = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx || !ctx.uid) {
    throw new HttpsError("unauthenticated", "Please sign in to continue.");
  }

  const { listingId } = request.data || {};
  if (!listingId || typeof listingId !== "string") {
    throw new HttpsError("invalid-argument", "listingId is required.");
  }

  const listingRef = db.collection("listings").doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) {
    throw new HttpsError("not-found", "Listing not found.");
  }

  const listing = listingSnap.data();
  const ownerUid = listing.ownerUid;
  const ownerType = listing.ownerType || "host"; // "host" | "agent"

  if (ownerType === "host") {
    // Host contacts only after booking is paid/confirmed
    const ok = await userHasConfirmedBooking({ guestUid: ctx.uid, listingId });
    if (!ok) {
      throw new HttpsError(
        "permission-denied",
        "Contact is available after you complete a booking for this listing."
      );
    }
  } else if (ownerType === "agent") {
    // Agent contacts require: guest subscribed + agent subscribed
    const [callerProfile, agentProfile] = await Promise.all([
      getUserProfile(ctx.uid),
      getUserProfile(ownerUid),
    ]);
    const callerSub = !!(callerProfile && callerProfile.isSubscribed);
    const agentSub = !!(agentProfile && agentProfile.isSubscribed);

    if (!callerSub) {
      throw new HttpsError(
        "permission-denied",
        "Please subscribe to view agent contact details."
      );
    }
    if (!agentSub) {
      throw new HttpsError(
        "permission-denied",
        "Agent has not enabled contact sharing."
      );
    }
  } else {
    throw new HttpsError("failed-precondition", "Invalid listing owner type.");
  }

  const contactsSnap = await listingRef.collection("contacts").doc("public").get();
  if (!contactsSnap.exists) {
    throw new HttpsError(
      "not-found",
      "Contact details are not available for this listing."
    );
  }

  const contacts = contactsSnap.data() || {};
  return {
    phone: contacts.phone || null,
    email: contacts.email || null,
    whatsapp: contacts.whatsapp || null,
    other: contacts.other || null,
  };
});