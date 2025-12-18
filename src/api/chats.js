// src/api/chats.js
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Deterministic chat ID
 */
export const buildThreadId = (bookingId, guestId, hostId) =>
  `b:${bookingId}::g:${guestId}::h:${hostId}`;

/**
 * Create or return chat thread
 */
export async function getOrCreateThreadForBooking({
  bookingId,
  listingId,
  listingTitle,
  guestId,
  hostId,
}) {
  if (!bookingId || !listingId || !guestId || !hostId) {
    throw new Error("Missing booking/listing/guest/host");
  }

  const threadId = buildThreadId(bookingId, guestId, hostId);
  const ref = doc(db, "chats", threadId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      bookingId,
      listingId,
      listingTitle,

      participants: [guestId, hostId],

      // ✅ CRITICAL FIX
      archived: {
        [guestId]: false,
        [hostId]: false,
      },
      pinned: {
        [guestId]: false,
        [hostId]: false,
      },

      unreadFor: [],
      lastReadAt: {},

      lastMessage: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return threadId;
}

/**
 * Send message
 */
export async function sendMessage({ threadId, senderId, text }) {
  if (!threadId || !senderId || !text?.trim()) return;

  const msg = {
    senderId,
    text: text.trim(),
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, "chats", threadId, "messages"), msg);

  const chatRef = doc(db, "chats", threadId);
  const snap = await getDoc(chatRef);
  const participants = snap.data()?.participants || [];
  const otherUid = participants.find((p) => p !== senderId);

  await updateDoc(chatRef, {
    lastMessage: msg,
    updatedAt: serverTimestamp(),
    unreadFor: otherUid ? [otherUid] : [],
  });
}
