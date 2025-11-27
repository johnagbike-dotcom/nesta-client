// src/utils/bookingDraft.js
const KEY = "nesta.bookingDraft";

export function saveBookingDraft(draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn("saveBookingDraft()", e);
  }
}

export function loadBookingDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("loadBookingDraft()", e);
    return null;
  }
}

export function clearBookingDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (e) {
    console.warn("clearBookingDraft()", e);
  }
}
