// src/pages/onboarding/KycGate.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function KycGate() {
  const nav = useNavigate();

  useEffect(() => {
    try {
      const intent = localStorage.getItem("nesta_kyc_intent");

      if (intent === "host") {
        nav("/onboarding/kyc?intent=host", { replace: true });
        return;
      }

      if (intent === "partner") {
        nav("/onboarding/kyc?intent=partner", { replace: true });
        return;
      }
    } catch {
      // ignore storage errors
    }

    // fallback
    nav("/onboarding/kyc", { replace: true });

  }, [nav]);

  return null;
}