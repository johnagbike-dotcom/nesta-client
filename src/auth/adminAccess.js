export function isAdmin(profile) {
  const role = (profile?.role || "").toLowerCase();
  return profile?.isAdmin === true || role === "admin";
}

export function isSuperAdmin(profile) {
  return isAdmin(profile) && (profile?.adminLevel || "").toLowerCase() === "super";
}

export function canAdmin(profile, area) {
  if (!isAdmin(profile)) return false;
  if (isSuperAdmin(profile)) return true;
  return !!profile?.adminPermissions?.[area];
}
