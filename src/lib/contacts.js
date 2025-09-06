// Client helpers for listing contacts (public + gated)
// Works with your deployed `unlockContact` Cloud Function
// and your Firestore security rules.

import { app, auth, db } from "../firebase";
import {
  doc,
  getDoc
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable
} from "firebase/functions";

/** Region must match your deployed function (us-central1). */
const functions = getFunctions(app, "us-central1");
const unlockContactFn = httpsCallable(functions, "unlockContact");

/**
* Public contact fetch (always readable).
* @returns {Promise<{whatsapp?:string, chatOnly?:boolean} | null>}
*/
export async function getPublicContacts(listingId) {
  if (!listingId) throw new Error("listingId required");
  const ref = doc(db, "listings", listingId, "contacts", "public");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
* Try to read private contact directly (will only succeed if rules allow).
* If not allowed yet, call Cloud Function to unlock (checks subscription/booking),
* then read again.
* @returns {Promise<{phone?:string,email?:string} | null>}
*/
export async function getPrivateContacts(listingId) {
  if (!listingId) throw new Error("listingId required");
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const privateRef = doc(db, "listings", listingId, "contacts", "private");

  // 1) First attempt (maybe already allowed by rules)
  try {
    const snap = await getDoc(privateRef);
    if (snap.exists()) return snap.data();
  } catch {
    /* permission denied – we’ll try to unlock */
  }

  // 2) Ask backend to grant access if eligible
  try {
    await unlockContactFn({ listingId }); // throws if not eligible
  } catch (e) {
    // Bubble a friendly error up to the UI
    const msg =
      (e && e.message) ||
      "Could not unlock contact (subscription/booking required).";
    throw new Error(msg);
  }

  // 3) Read again (now should be allowed if function granted access)
  const snap2 = await getDoc(privateRef);
  return snap2.exists() ? snap2.data() : null;
}

/**
* Convenience: fetch both sets. Private may be null if not eligible.
*/
export async function fetchContactsForListing(listingId) {
  const [pub, priv] = await Promise.allSettled([
    getPublicContacts(listingId),
    // private requires auth; if no user, resolve to null instead of throwing
    (async () => {
      try {
        if (!auth.currentUser) return null;
        return await getPrivateContacts(listingId);
      } catch {
        return null;
      }
    })()
  ]);

  return {
    public: pub.status === "fulfilled" ? pub.value : null,
    private: priv.status === "fulfilled" ? priv.value : null
  };
}