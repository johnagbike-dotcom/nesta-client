// src/pages/onboarding/KycGate.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function KycGate() {
  const nav = useNavigate();
  useEffect(() => {
    // Always use the Firestore checklist KYC page
    nav("/onboarding/kyc", { replace: true });
  }, [nav]);

  return null;
}
