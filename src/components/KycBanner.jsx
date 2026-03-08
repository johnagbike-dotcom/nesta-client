// src/components/KycBanner.js
import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const OK_STATES = ["approved", "verified", "complete"];

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function isApprovedStatus(v) {
  return OK_STATES.includes(safeLower(v));
}

export default function KycBanner({ forceHide = false, role = "host" }) {
  const { user, profile: authProfile } = useAuth();
  const { profile: fetchedProfile } = useUserProfile();

  const profile = authProfile || fetchedProfile || null;

  const [remote, setRemote] = useState({
    loading: true,
    status: "",
    source: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.uid) {
        if (alive) {
          setRemote({ loading: false, status: "", source: "" });
        }
        return;
      }

      try {
        // 1) Preferred source: kycProfiles/{uid}
        const kycProfileRef = doc(db, "kycProfiles", user.uid);
        const kycProfileSnap = await getDoc(kycProfileRef);

        if (!alive) return;

        if (kycProfileSnap.exists()) {
          const data = kycProfileSnap.data() || {};
          const status = safeLower(data.status);
          setRemote({
            loading: false,
            status,
            source: "kycProfiles",
          });
          return;
        }

        // 2) Legacy fallback: kyc collection
        const qref = query(
          collection(db, "kyc"),
          where("userId", "==", user.uid),
          limit(1)
        );
        const snap = await getDocs(qref);

        if (!alive) return;

        if (snap.empty) {
          setRemote({ loading: false, status: "", source: "" });
        } else {
          const data = snap.docs[0].data() || {};
          setRemote({
            loading: false,
            status: safeLower(data.status),
            source: "kyc",
          });
        }
      } catch (e) {
        console.warn("[KycBanner] KYC fetch failed:", e);
        if (alive) {
          setRemote({ loading: false, status: "", source: "" });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const localStatus = useMemo(() => {
    return safeLower(
      profile?.kycStatus ||
        profile?.kyc?.status ||
        profile?.kyc?.state ||
        profile?.status ||
        ""
    );
  }, [profile]);

  const mergedStatus = useMemo(() => {
    if (forceHide) return "approved";

    if (isApprovedStatus(localStatus)) return localStatus;
    if (isApprovedStatus(remote.status)) return remote.status;

    return localStatus || remote.status || "";
  }, [forceHide, localStatus, remote.status]);

  const title =
    role === "partner"
      ? "Verify to unlock Partner tools"
      : "Verify to unlock Host tools";

  const intro =
    role === "partner"
      ? "To keep Nesta luxury-grade and safe, all partners must complete identity verification and provide a serviceable business or personal address."
      : "To keep Nesta luxury-grade and safe, all hosts must complete identity verification and provide a serviceable address.";

  const handleGoKyc = () => {
    try {
      localStorage.setItem(
        "nesta_kyc_intent",
        role === "partner" ? "partner" : "host"
      );
    } catch {
      // ignore
    }

    const next =
      role === "partner" ? "/onboarding/partner" : "/onboarding/host";

    window.location.href = `/onboarding/kyc/start?next=${encodeURIComponent(next)}`;
  };

  // Signed-out users should not see this blocker
  if (!user) return null;

  // While checking, keep quiet to avoid UI flash
  if (remote.loading) return null;

  // Approved users should not see banner
  if (isApprovedStatus(mergedStatus)) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0f1216] rounded-2xl border border-amber-400/20 w-full max-w-lg shadow-2xl relative overflow-hidden">
        <button
          onClick={handleGoKyc}
          className="absolute top-3 right-3 text-white/40 hover:text-white"
          aria-label="Close"
          type="button"
        >
          ✕
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-200 grid place-items-center font-bold">
              N
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-amber-200/70">
                KYC required
              </p>
              <h2 className="text-lg font-bold text-white">{title}</h2>
            </div>
          </div>

          <p className="text-white/70 text-sm leading-relaxed mb-4">
            {intro}
          </p>

          <ul className="text-white/60 text-sm space-y-1 mb-5">
            <li>• Government-issued ID</li>
            <li>• Live selfie for identity match</li>
            <li>• Proof of address</li>
            <li>• Signed declaration before review</li>
          </ul>

          {!!remote.source && (
            <div className="mb-4 text-[11px] text-white/35">
              Verification status source: {remote.source}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGoKyc}
              className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-semibold py-2 rounded-xl text-center"
              type="button"
            >
              Complete KYC
            </button>

            <button
              onClick={handleGoKyc}
              className="px-4 py-2 rounded-xl border border-white/10 text-white/80 text-sm"
              type="button"
            >
              View form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}