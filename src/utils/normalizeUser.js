// src/utils/normalizeUser.js

// turn "verified_partner" → "partner", "verified_host" → "host"
export function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_partner") return "partner";
  if (r === "verified_host") return "host";
  if (!r) return "guest";
  return r;
}

export function isKycOk(status) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "verified" || s === "complete";
}
