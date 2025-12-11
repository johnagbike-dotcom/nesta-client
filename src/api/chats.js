// src/api/chats.js
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getApp } from "firebase/app";

const db = getFirestore(getApp());

/**
 * Deterministic thread id so we never create duplicates.
 * Format: b:<bookingId>::g:<guestId>::h:<hostId>
 */
export const buildThreadId = (bookingId, guestId, hostId) =>
  `b:${bookingId}::g:${guestId}::h:${hostId}`;

/**
 * Create (idempotent) or return a thread for a booking.
 * Requires bookingId, listingId, guestId, hostId.
 *
 * We also store listingTitle + participants so Inbox / Chat can render nicely.
 * Contact-reveal logic is handled on the client in ChatRoom.
 */
export async function getOrCreateThreadForBooking({
  bookingId,
  listingId,
  guestId,
  hostId,
  listingTitle = "Chat",
}) {
  if (!bookingId || !listingId || !guestId || !hostId) {
    throw new Error("Missing hostId/guestId/listingId/bookingId");
  }

  const threadId = buildThreadId(bookingId, guestId, hostId);
  const threadRef = doc(db, "chats", threadId);
  const snap = await getDoc(threadRef);

  if (!snap.exists()) {
    await setDoc(threadRef, {
      id: threadId,
      bookingId,
      listingId,
      listingTitle,
      guestId,
      hostId,
      participants: [guestId, hostId],
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedFor: [], // reserved for future use
      pinnedBy: [],    // reserved for future use
    });
  }

  return threadId;
}

/**
 * Subscribe to messages for a thread.
 * Calls onUpdate(messagesArray) on every change.
 */
export function subscribeToMessages(threadId, onUpdate) {
  if (!threadId || typeof onUpdate !== "function") {
    console.warn("subscribeToMessages: invalid threadId or onUpdate callback");
    return () => {};
  }

  const q = query(
    collection(db, "messages", threadId, "items"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (ss) => {
    const out = [];
    ss.forEach((d) => out.push({ id: d.id, ...d.data() }));
    onUpdate(out);
  });
}

/**
 * Send a message to a thread.
 */
export async function sendMessage({ threadId, text, senderId }) {
  if (!threadId) throw new Error("threadId required");
  if (!text?.trim()) return;

  const msg = {
    text: text.trim(),
    senderId,
    threadId,
    createdAt: serverTimestamp(),
  };

  // messages/<threadId>/items/...
  const itemsCol = collection(db, "messages", threadId, "items");
  await addDoc(itemsCol, msg);

  // Update chat's last message
  await updateDoc(doc(db, "chats", threadId), {
    lastMessage: {
      text: msg.text,
      senderId,
      createdAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}
