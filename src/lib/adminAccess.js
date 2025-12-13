// src/lib/adminAccess.js
export function getAdminAccess(profile) {
  const role = String(profile?.role || "").toLowerCase();
  const level = String(profile?.adminLevel || "").toLowerCase();

  const perms = profile?.adminPermissions || {};
  const isAdmin = role === "admin";
  const isSuper = isAdmin && level === "super";

  const can = (key) => isSuper || (!!perms && perms[key] === true);

  return {
    isAdmin,
    isSuper,
    canUsers: can("users"),
    canBookings: can("bookings"),
    canPayouts: can("payouts"),
    canSettings: can("settings"),
    canReports: can("reports"),
  };
}
