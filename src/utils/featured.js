// src/utils/featured.js
// Single source of truth for "Featured" visibility + validity window.

export function getSponsoredUntilMs(v) {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v?.toMillis === "function") return v.toMillis();

  // Timestamp-like { toDate() }
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    const ms = d?.getTime?.();
    return Number.isFinite(ms) ? ms : null;
  }

  // number milliseconds
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // ISO string / date string
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Luxury featured rule:
 * - sponsored === true
 * - featured === true
 * - sponsoredUntil exists AND is in the future
 * - status not inactive/hidden (optional guard)
 */
export function isFeaturedActive(listing, nowMs = Date.now()) {
  if (!listing) return false;

  if (listing.sponsored !== true) return false;
  if (listing.featured !== true) return false;

  const untilMs = getSponsoredUntilMs(listing.sponsoredUntil);
  if (!untilMs) return false;
  if (untilMs <= nowMs) return false;

  const status = String(listing.status || "").toLowerCase();
  if (status === "inactive" || status === "hidden") return false;

  return true;
}
