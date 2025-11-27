// src/components/KycModal.js
import React from "react";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const OK = ["approved", "verified", "complete"];

export default function KycModal({ open, onClose, role = "host" }) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const kycStatus = (
    profile?.kycStatus ||
    profile?.kyc?.status ||
    profile?.kyc?.state ||
    ""
  ).toLowerCase();

  const isApproved = OK.includes(kycStatus);

  // If user is already approved or modal is not requested → render nothing
  if (!open || isApproved) return null;

  const title =
    role === "partner" ? "Verify to unlock Partner tools" : "Verify to start hosting";

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
              <div className="text-sm text-white/60">
                Nesta secure {role === "partner" ? "partner tools" : "hosting"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        <h2 className="mt-4 text-xl font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm text-white/70">
          To keep Nesta luxury-grade and safe, all inventory partners and premium
          hosts must complete government-ID verification and provide a
          serviceable address.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-white/70">
          <li>• BVN (mandatory – prevents duplicate identities).</li>
          <li>
            • Valid government ID (NIN, National ID, International Passport).
          </li>
          <li>• Address details (will be validated for format).</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/onboarding/kyc"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300"
          >
            Complete KYC
          </a>
          <button
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
