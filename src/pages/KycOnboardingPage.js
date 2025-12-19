import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import KycUploader from "../components/KycUploader";
import BackButton from "../components/BackButton";

export default function KycOnboardingPage() {
  const { profile } = useAuth(); // Firestore users/{uid} record
  const navigate = useNavigate();

  const kycStatus = profile?.kyc?.status || "not_submitted";
  const reason = profile?.kyc?.reason || "";
  const userType = profile?.type === "partner" ? "partner" : "host";

  useEffect(() => {
    if (kycStatus === "approved") navigate("/dashboard");
  }, [kycStatus, navigate]);

  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <BackButton />

      <h1 className="text-2xl font-bold mb-3">Identity Verification</h1>
      <p className="text-white/60 mb-6">
        Minimum required at launch: Government ID, Live Selfie, Proof of Address + Digital Declaration.
        Other documents can be reviewed at admin discretion and enforced later.
      </p>

      {kycStatus === "submitted" && (
        <div className="mb-6 bg-amber-500/10 border border-amber-400/30 text-amber-200 px-4 py-3 rounded-lg">
          🔍 Your documents have been submitted and are under review.
        </div>
      )}

      {kycStatus === "rejected" && (
        <div className="mb-6 bg-red-500/10 border border-red-400/40 text-red-200 px-4 py-3 rounded-lg">
          ❌ Your previous submission was rejected.
          {reason ? <p className="mt-2 font-medium">Reason: {reason}</p> : null}
          <p className="mt-2">Please correct and resubmit.</p>
        </div>
      )}

      <div className="mt-6">
        <KycUploader userType={userType} />
      </div>
    </div>
  );
}
