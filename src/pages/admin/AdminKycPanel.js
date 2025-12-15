// src/pages/admin/AdminKycPanel.js
import React from "react";
import KycReviewPage from "./KycReviewPage";

/**
 * Keep this file as a simple wrapper so your existing routes don't break:
 * /admin/kyc can still render AdminKycPanel,
 * but the implementation is now the proper API-driven KycReviewPage.
 */
export default function AdminKycPanel() {
  return <KycReviewPage />;
}
