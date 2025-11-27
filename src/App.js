import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";

import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";

import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProfilePage from "./pages/ProfilePage";

import HostDashboard from "./pages/HostDashboard";
import CreateListing from "./pages/CreateListing";
import EditListing from "./pages/EditListing";
import ListingDetails from "./pages/ListingDetails";

import PartnerDashboard from "./pages/PartnerDashboard";

import KycReviewPage from "./pages/admin/KycReviewPage";
import Transactions from "./pages/admin/Transactions";
import AdminFeatureRequests from "./pages/admin/AdminFeatureRequests";
import Settings from "./pages/admin/Settings";
import ManageUsers from "./pages/admin/ManageUsers";
import { RequireAuth, RequireKycApproved, RequireRole } from "./router/guards";
// Small helper so /listing/* can't be swallowed by order mistakes
function ListingSwitch() {
  const { pathname } = useLocation(); // e.g. /listing/host-vi-loft or /listing/host-vi-loft/edit
  const parts = pathname.split("/").filter(Boolean); // ["listing","<id>", "edit"?]
  const id = parts[1];
  const isEdit = parts[2] === "edit";
  if (!id) return <NotFound />;
  return isEdit ? <EditListing /> : <ListingDetails />;
}

function Ping() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontWeight: 800 }}>Router OK</h1>
      <p>Ping route rendered. If you can see this, routing works.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ minHeight: "72vh" }}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/ping" element={<Ping />} />
          <Route path="/onboarding/kyc" element={<KycGate />} />
          <Route path="/onboarding/host" element={<HostOnboarding />} />
          <Route path="/onboarding/partner" element={<PartnerOnboarding />} />


          {/* Profile */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />

          // Host dashboard
<Route
  path="/host"
  element={
    <RequireAuth>
      <RequireKycApproved>
        <RequireRole role="host">
          <HostDashboard />
        </RequireRole>
      </RequireKycApproved>
    </RequireAuth>
  }
/>
          {/* Alias used by some buttons */}
          <Route path="/host-listings" element={<Navigate to="/host" replace />} />

          {/* Create listing */}
          <Route
            path="/post/new"
            element={
              <RequireAuth>
                <RequireRole allow={["host", "partner", "admin"]}>
                  <CreateListing />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="/post" element={<Navigate to="/post/new" replace />} />

          {/* Listing details / edit (handled by switch to avoid order problems) */}
          <Route path="/listing/*" element={<ListingSwitch />} />

          // Partner dashboard
<Route
  path="/partner"
  element={
    <RequireAuth>
      <RequireKycApproved>
        <RequireRole role="partner">
          <PartnerDashboard />
        </RequireRole>
      </RequireKycApproved>
    </RequireAuth>
  }
/>

          {/* Admin */}
          <Route
            path="/admin/kyc"
            element={
              <RequireAuth>
                <RequireRole allow={["admin"]}>
                  <KycReviewPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/transactions"
            element={
              <RequireAuth>
                <RequireRole allow={["admin"]}>
                  <Transactions />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/feature-requests"
            element={
              <RequireAuth>
                <RequireRole allow={["admin"]}>
                  <AdminFeatureRequests />
                </RequireRole>
              </RequireAuth>
            }
            />
          <Route
            path="/admin/manage-users"
            element={
              <RequireAuth>
                <RequireRole allow={["admin"]}>
                  <ManageUsers />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RequireAuth>
                <RequireRole allow={["admin"]}>
                  <Settings />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* 404 last */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}