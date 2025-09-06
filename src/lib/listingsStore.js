// src/lib/listingsStore.js

/**
* A tiny localStorage-backed listings store used by Host, Agent, and Guest.
* Shape:
* {
*   id: number,                // unique id (timestamp)
*   role: "host" | "agent",    // who created it
*   title: string,
*   price: number,             // per night in NGN
*   location: string,
*   description?: string,
*   images?: string[],         // data URLs or /public paths (e.g., "/listings/1-1.jpg")
*   commissionRate?: number    // % for agent listings only (e.g., 10 for 10%)
* }
*/

const KEY = "nestaListings.v1";

export function getAllListings() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveAllListings(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list || []));
  } catch (_) {}
}

export function addListing(item) {
  const nowId = Date.now();
  const clean = {
    id: nowId,
    role: item.role || "host",
    title: (item.title || "").trim(),
    price: Number(item.price) || 0,
    location: (item.location || "").trim(),
    description: (item.description || "").trim(),
    images: Array.isArray(item.images) ? item.images : [],
    commissionRate: item.role === "agent" ? Number(item.commissionRate) || 0 : undefined,
  };

  const all = getAllListings();
  all.push(clean);
  saveAllListings(all);
  return clean;
}

export function updateListing(id, patch) {
  const all = getAllListings();
  const next = all.map((l) =>
    l.id === id
      ? {
          ...l,
          ...patch,
          title: patch.title != null ? String(patch.title).trim() : l.title,
          location: patch.location != null ? String(patch.location).trim() : l.location,
          price: patch.price != null ? Number(patch.price) : l.price,
          commissionRate:
            l.role === "agent"
              ? (patch.commissionRate != null ? Number(patch.commissionRate) : l.commissionRate)
              : undefined,
          images: Array.isArray(patch.images) ? patch.images : l.images,
          description:
            patch.description != null ? String(patch.description).trim() : l.description,
        }
      : l
  );
  saveAllListings(next);
  return next.find((x) => x.id === id);
}

export function removeListing(id) {
  const all = getAllListings();
  const next = all.filter((l) => l.id !== id);
  saveAllListings(next);
}

export function clearAllListings() {
  saveAllListings([]);
}