// src/utils/subscription.js

/**
 * Safely convert Firestore / JS / string date into a JS Date.
 */
function toJsDate(raw) {
  if (!raw) return null;

  try {
    if (raw.toDate && typeof raw.toDate === "function") {
      // Firestore Timestamp
      return raw.toDate();
    }
    if (typeof raw.seconds === "number") {
      // { seconds, nanoseconds } style
      return new Date(raw.seconds * 1000);
    }
    if (raw instanceof Date) return raw;

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Compute subscription status from a user profile document.
 *
 * Expected fields (from your Firestore `users` collection):
 *  - activeSubscription: true | false
 *  - isSubscribed: "true" | "false" | boolean
 *  - subscriptionExpiresAt: Timestamp | ISO string | ms
 *  - subscriptionPlan: "annual" | "monthly" | ...
 */
export function getSubscriptionStatus(userDoc) {
  const nowMs = Date.now();

  const flagActive =
    userDoc?.activeSubscription === true ||
    userDoc?.isSubscribed === true ||
    userDoc?.isSubscribed === "true";

  const expiresAtDate = toJsDate(userDoc?.subscriptionExpiresAt);
  const expiresMs = expiresAtDate ? expiresAtDate.getTime() : null;

  const isActive = !!(flagActive && expiresMs && expiresMs > nowMs);

  let daysLeft = null;
  if (expiresMs != null) {
    daysLeft = Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1000));
  }

  let label = "Not subscribed";
  let tone = "none"; // "ok" | "warn" | "danger"

  if (isActive) {
    if (daysLeft != null && daysLeft <= 7) {
      label = `Active — expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      tone = "warn";
    } else if (daysLeft != null && daysLeft > 7) {
      label = `Active — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
      tone = "ok";
    } else {
      label = "Active subscription";
      tone = "ok";
    }
  } else if (flagActive && expiresMs && expiresMs <= nowMs) {
    label = "Subscription expired";
    tone = "danger";
  } else if (flagActive && !expiresMs) {
    label = "Active (no expiry set)";
    tone = "ok";
  }

  return {
    isActive,
    label,
    tone,
    daysLeft,
    expiresAt: expiresAtDate,
    plan: userDoc?.subscriptionPlan || null,
  };
}
