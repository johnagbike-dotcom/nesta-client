// src/components/KycModal.js
import React from "react";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const OK = ["approved", "verified", "complete"];

function normalizeStatus(profile) {
  return String(
    profile?.kycStatus ||
      profile?.kyc?.status ||
      profile?.kyc?.state ||
      ""
  ).toLowerCase();
}

export default function KycModal({ open, onClose, role = "host" }) {
  const { user, profile: authProfile } = useAuth();
  const { profile: fetchedProfile } = useUserProfile();

  const profile = authProfile || fetchedProfile || null;
  const kycStatus = normalizeStatus(profile);
  const isApproved = OK.includes(kycStatus);

  if (!open || isApproved) return null;

  const title =
    role === "partner"
      ? "Verify to unlock Partner tools"
      : "Verify to start hosting";

  const subtitle =
    role === "partner"
      ? "Nesta secure partner tools"
      : "Nesta secure hosting";

  const handleStartKyc = () => {
    try {
      localStorage.setItem("nesta_kyc_intent", role === "partner" ? "partner" : "host");
    } catch {
      // ignore
    }

    const next =
      role === "partner" ? "/onboarding/partner" : "/onboarding/host";

    onClose?.();
    window.location.href = `/onboarding/kyc/start?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#101318] border border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/15 border border-amber-300/40 grid place-items-center text-amber-200 font-bold">
              N
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                KYC required
              </div>
              <div className="text-sm text-white/60">{subtitle}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 text-lg leading-none px-1"
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <h2 className="mt-4 text-xl font-bold text-white">{title}</h2>

        <p className="mt-2 text-sm text-white/70">
          To keep Nesta luxury-grade and safe, all inventory partners and premium
          hosts must complete identity verification and provide a serviceable
          address before accessing protected tools.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-white/70">
          <li>• Government-issued ID.</li>
          <li>• Live selfie for identity match.</li>
          <li>• Proof of address.</li>
          <li>• Signed declaration before review.</li>
        </ul>

        {!user ? (
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Please sign in first to continue with KYC.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleStartKyc}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300"
          >
            Complete KYC
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 text-white/80 text-sm border border-white/10 hover:bg-white/10"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}