// src/hooks/useSessionRole.js
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "./useUserProfile";
import { normalizeRole, isKycOk } from "../utils/normalizeUser";

export default function useSessionRole() {
  const { user, profile: ctxProfile, loading } = useAuth();
  // some projects fetch profile separately:
  const fetched = useUserProfile(user?.uid);
  const profile = ctxProfile ?? fetched.profile ?? null;
  const stillLoading = loading || fetched.loading;

  const role = normalizeRole(profile?.role || profile?.type || "guest");
  const kycStatus = profile?.kycStatus || profile?.kyc?.status || "none";
  const kycOk = isKycOk(kycStatus);

  return {
    loading: stillLoading,
    user,
    profile,
    role,
    kycStatus,
    kycOk,
    isGuest: !user || role === "guest",
    isHost: role === "host",
    isPartner: role === "partner",
    isAdmin: role === "admin" || profile?.isAdmin === true,
  };
}
