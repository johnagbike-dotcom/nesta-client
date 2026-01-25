// src/pages/admin/AdminRouter.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AdminDashboard from "./AdminDashboard";
import BookingsAdmin from "./BookingsAdmin";
import ManageUsers from "./ManageUsers";
import ManageListings from "./ManageListings";
import Transactions from "./Transactions";
import AdminPayouts from "./AdminPayouts";
import AdminPayoutSetups from "./AdminPayoutSetups"; // ✅ NEW
import ReportsExports from "./ReportsExports";
import AdminFeatureRequests from "./AdminFeatureRequests";
import OnboardingQueue from "./OnboardingQueue";
import AdminDataTools from "./AdminDataTools";
import Settings from "./Settings";
import AdminKycPanel from "./AdminKycPanel";
import KycReviewPage from "./KycReviewPage";

export default function AdminRouter() {
  return (
    <Routes>
      {/* landing */}
      <Route index element={<AdminDashboard />} />
      <Route path="overview" element={<AdminDashboard />} />

      {/* KYC */}
      <Route path="kyc" element={<AdminKycPanel />} />
      {/* optional extra table view */}
      <Route path="kyc-table" element={<KycReviewPage />} />

      {/* bookings (admin view) */}
      <Route path="bookings-admin" element={<BookingsAdmin />} />
      {/* legacy alias */}
      <Route path="bookings" element={<BookingsAdmin />} />

      {/* core admin */}
      <Route path="manage-users" element={<ManageUsers />} />
      <Route path="listings" element={<ManageListings />} />
      <Route path="transactions" element={<Transactions />} />

      {/* payouts */}
      <Route path="payouts" element={<AdminPayouts />} />
      <Route path="payout-setups" element={<AdminPayoutSetups />} /> {/* ✅ NEW */}
      <Route path="payoutsetups" element={<Navigate to="/admin/payout-setups" replace />} /> {/* optional alias */}

      {/* ops tools */}
      <Route path="feature-requests" element={<AdminFeatureRequests />} />
      <Route path="onboarding-queue" element={<OnboardingQueue />} />
      <Route path="data-tools" element={<AdminDataTools />} />
      <Route path="reports" element={<ReportsExports />} />
      <Route path="settings" element={<Settings />} />

      {/* safety */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
