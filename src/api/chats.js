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
* Deterministic thread id so we never create duplicates and we don't need composite indexes.
* b:<bookingId>::g:<guestId>::h:<hostId>
*/
const buildThreadId = (bookingId, guestId, hostId) =>
  `b:${bookingId}::g:${guestId}::h:${hostId}`;

/**
* Create (idempotent) or return a thread for a booking.
* Requires bookingId, listingId, guestId, hostId.
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
      guestId,
      hostId,
      participants: [guestId, hostId],
      title: listingTitle,
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedFor: [],   // optional future feature
      pinnedBy: [],      // optional future feature
    });
  }

  return threadId;
}

/**
* Subscribe to messages for a thread.
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
    lastMessage: { text: msg.text, senderId, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
} 