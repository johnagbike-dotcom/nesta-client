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
 * Format:
 *   b:<bookingId>::g:<guestId>::h:<hostId>
 */
export const buildThreadId = (bookingId, guestId, hostId) =>
  `b:${String(bookingId || "").trim()}::g:${String(guestId || "").trim()}::h:${String(hostId || "").trim()}`;

/**
 * Normalise uid text
 */
function norm(v) {
  return String(v || "").trim();
}

/**
 * Create or return chat thread for a booking
 */
export async function getOrCreateThreadForBooking({
  bookingId,
  listingId,
  listingTitle,
  guestId,
  hostId,
}) {
  const bId = norm(bookingId);
  const lId = norm(listingId);
  const gId = norm(guestId);
  const hId = norm(hostId);
  const lTitle = String(listingTitle || "").trim();

  if (!bId || !lId || !gId || !hId) {
    throw new Error("Missing booking/listing/guest/host");
  }

  if (gId === hId) {
    throw new Error("Guest and host cannot be the same user");
  }

  const participants = [gId, hId];
  const threadId = buildThreadId(bId, gId, hId);
  const ref = doc(db, "chats", threadId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      bookingId: bId,
      listingId: lId,
      listingTitle: lTitle,

      participants,

      archived: {
        [gId]: false,
        [hId]: false,
      },

      pinned: {
        [gId]: false,
        [hId]: false,
      },

      unreadFor: [],
      lastReadAt: {},

      lastMessage: null,
      lastMessageText: "",
      lastMessageSenderId: null,
      lastMessageAt: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return threadId;
  }

  // Self-heal older/incomplete thread docs
  const existing = snap.data() || {};
  const existingParticipants = Array.isArray(existing.participants)
    ? existing.participants.filter(Boolean)
    : [];

  const hasGuest = existingParticipants.includes(gId);
  const hasHost = existingParticipants.includes(hId);

  const needsRepair =
    !hasGuest ||
    !hasHost ||
    !existing.bookingId ||
    !existing.listingId ||
    typeof existing.archived !== "object" ||
    typeof existing.pinned !== "object";

  if (needsRepair) {
    await setDoc(
      ref,
      {
        bookingId: existing.bookingId || bId,
        listingId: existing.listingId || lId,
        listingTitle: existing.listingTitle || lTitle,

        participants: Array.from(new Set([...existingParticipants, gId, hId])),

        archived: {
          [gId]: existing.archived?.[gId] ?? false,
          [hId]: existing.archived?.[hId] ?? false,
          ...(existing.archived || {}),
        },

        pinned: {
          [gId]: existing.pinned?.[gId] ?? false,
          [hId]: existing.pinned?.[hId] ?? false,
          ...(existing.pinned || {}),
        },

        unreadFor: Array.isArray(existing.unreadFor) ? existing.unreadFor : [],
        lastReadAt: existing.lastReadAt || {},

        lastMessage: existing.lastMessage || null,
        lastMessageText: existing.lastMessageText || existing.lastMessage?.text || "",
        lastMessageSenderId:
          existing.lastMessageSenderId || existing.lastMessage?.senderId || null,
        lastMessageAt: existing.lastMessageAt || existing.lastMessage?.createdAt || null,

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return threadId;
}

/**
 * Send message to an existing thread
 */
export async function sendMessage({ threadId, senderId, text }) {
  const tId = norm(threadId);
  const sId = norm(senderId);
  const body = String(text || "").trim();

  if (!tId) throw new Error("Missing threadId");
  if (!sId) throw new Error("Missing senderId");
  if (!body) throw new Error("Message text is required");

  const chatRef = doc(db, "chats", tId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    throw new Error("Chat thread not found");
  }

  const chat = snap.data() || {};
  const participants = Array.isArray(chat.participants) ? chat.participants.filter(Boolean) : [];

  if (!participants.includes(sId)) {
    throw new Error("Sender is not a participant in this thread");
  }

  const otherParticipants = participants.filter((p) => p !== sId);

  const msg = {
    senderId: sId,
    text: body,
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, "chats", tId, "messages"), msg);

  await updateDoc(chatRef, {
    lastMessage: msg,
    lastMessageText: body,
    lastMessageSenderId: sId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadFor: otherParticipants,
  });
}