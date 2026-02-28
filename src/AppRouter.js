// src/AppRouter.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { InboxProvider } from "./context/InboxContext";

import ReserveSuccessPage from "./pages/ReserveSuccessPage";
import SearchBrowse from "./pages/SearchBrowse";

// Legal / info pages
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CancellationPolicyPage from "./pages/CancellationPolicyPage";
import ComplaintsPage from "./pages/ComplaintsPage";

// Onboarding / KYC
import KycPage from "./pages/onboarding/KycPage";
import KycApplicationPage from "./pages/onboarding/KycApplicationPage";
import KycGate from "./pages/onboarding/KycGate";
import KycPending from "./pages/onboarding/KycPending";
import KycRetry from "./pages/onboarding/KycRetry";
import KycStart from "./pages/onboarding/KycStart";
import OnboardingHost from "./pages/onboarding/HostOnboarding";
import OnboardingPartner from "./pages/onboarding/PartnerOnboarding";

// Public / user pages
import HomePage from "./pages/HomePage";
import GuestDashboard from "./pages/GuestDashboard";
import ListingDetails from "./pages/ListingDetails";
import ReservePage from "./pages/ReservePage";
import ChatPage from "./pages/ChatPage";
import ChatStart from "./pages/ChatStart";
import Wishlist from "./pages/Wishlist";
import GuestBookings from "./pages/GuestBookings";
import InboxPage from "./pages/InboxPage";
import AboutPage from "./pages/AboutPage";
import PostAdLanding from "./pages/PostAdLanding";
import PostListing from "./pages/PostListing";
import PostAdRouter from "./pages/PostAdRouter";
import ContactPage from "./pages/ContactPage";
import PressPage from "./pages/PressPage";
import CareersPage from "./pages/CareersPage";
import HelpPage from "./pages/HelpPage";
import GuestExplorePage from "./pages/GuestExplorePage";
import TrustSafetyPage from "./pages/TrustSafetyPage";
import SecurityPage from "./pages/SecurityPage";

// Booking detail / receipt / check-in
import BookingDetailsPage from "./pages/BookingDetailsPage";
import BookingCompletePage from "./pages/BookingCompletePage";
import BookingReceiptPage from "./pages/BookingReceiptPage";
import CheckinGuidePage from "./pages/CheckinGuidePage";

// Host / Partner dashboards & tools
import HostDashboard from "./pages/HostDashboard";
import PartnerDashboard from "./pages/PartnerDashboard";
import HostReservationsPage from "./pages/HostReservationsPage";
import PartnerReservationsPage from "./pages/PartnerReservationsPage";
import CreateListing from "./pages/CreateListing";
import EditListing from "./pages/EditListing";
import Withdrawals from "./pages/Withdrawals";
import ManageMyListings from "./pages/ManageMyListings";
import SubscribePage from "./pages/SubscribePage";
import PayoutSetup from "./pages/PayoutSetup";

// Admin router
import AdminRouter from "./pages/admin/AdminRouter";
import AdminDashboard from "./pages/admin/AdminDashboard";

// Auth pages
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import Login from "./auth/Login";
import SignUp from "./auth/SignUp";
import PhoneSignin from "./auth/PhoneSignin";
import ResetPassword from "./auth/ResetPassword";
import MfaSetup from "./auth/MfaSetup";
import AuthActionHandler from "./auth/AuthActionHandler";
import MfaVerifyPage from "./auth/MfaVerifyPage";

// Guards
import {
  RequireAuth,
  RequireKycApproved,
  RequireRole,
  OnboardingGate,
} from "./routes/guards";

/* ---------- Local admin guard ---------- */
function RequireAdmin({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const role = (profile?.role || "").toLowerCase();
  if (role !== "admin" && profile?.isAdmin !== true) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <InboxProvider>
        <BrowserRouter>
          <ToastProvider>
            <Header />
            <Routes>
              {/* ---------- Public ---------- */}
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<GuestExplorePage />} />
              <Route path="/listing/:id" element={<ListingDetails />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/post-ad" element={<PostAdLanding />} />
              <Route path="/PostListing" element={<PostListing />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/press" element={<PressPage />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/cancellation-policy" element={<CancellationPolicyPage />} />
              <Route path="/complaints" element={<ComplaintsPage />} />
              <Route path="/trust-and-safety" element={<TrustSafetyPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/search" element={<SearchBrowse />} />

              {/* ---------- Auth (public) ---------- */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/login-legacy" element={<Login />} />
              <Route path="/signup-legacy" element={<SignUp />} />
              <Route path="/phone" element={<PhoneSignin />} />
              <Route path="/reset" element={<ResetPassword />} />
              <Route path="/mfa-setup" element={<MfaSetup />} />
              <Route path="/action" element={<AuthActionHandler />} />
              <Route path="/mfa" element={<MfaVerifyPage />} />

              {/* ---------- Logged-in guest space ---------- */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <GuestDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/reserve/success"
                element={
                  <RequireAuth>
                    <ReserveSuccessPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/booking-complete"
                element={
                  <RequireAuth>
                    <BookingCompletePage />
                  </RequireAuth>
                }
              />

              {/* ---------- Booking details / receipt / check-in ---------- */}
              <Route
                path="/booking/:id"
                element={
                  <RequireAuth>
                    <BookingDetailsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/receipt/:id"
                element={
                  <RequireAuth>
                    <BookingReceiptPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/checkin/:id"
                element={
                  <RequireAuth>
                    <CheckinGuidePage />
                  </RequireAuth>
                }
              />

              {/* ---------- Subscriptions ---------- */}
              <Route
                path="/subscribe"
                element={
                  <RequireAuth>
                    <SubscribePage />
                  </RequireAuth>
                }
              />

              {/* ---------- KYC / Onboarding flows ---------- */}
              <Route
                path="/onboarding/kyc"
                element={
                  <RequireAuth>
                    <KycPage />
                  </RequireAuth>
                }
              />

              {/* ✅ NEW: Step 1 page route */}
              <Route
                path="/onboarding/kyc/start"
                element={
                  <RequireAuth>
                    <KycStart />
                  </RequireAuth>
                }
              />

              <Route
                path="/onboarding/kyc/gate"
                element={
                  <RequireAuth>
                    <KycGate />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding/kyc/apply"
                element={
                  <RequireAuth>
                    <KycApplicationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding/kyc/pending"
                element={
                  <RequireAuth>
                    <KycPending />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding/kyc/retry"
                element={
                  <RequireAuth>
                    <KycRetry />
                  </RequireAuth>
                }
              />

              {/* ---------- Role-specific onboarding ---------- */}
              <Route
                path="/onboarding/host"
                element={
                  <OnboardingGate wantRole="host" alreadyHasRoleTo="/host">
                    <OnboardingHost />
                  </OnboardingGate>
                }
              />
              <Route
                path="/onboarding/partner"
                element={
                  <OnboardingGate wantRole="partner" alreadyHasRoleTo="/partner">
                    <OnboardingPartner />
                  </OnboardingGate>
                }
              />

              {/* ---------- Inbox / chat ---------- */}
              <Route
                path="/inbox"
                element={
                  <RequireAuth>
                    <InboxPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/chat"
                element={
                  <RequireAuth>
                    <ChatPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/chat/:uid"
                element={
                  <RequireAuth>
                    <ChatPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/booking/:bookingId/chat"
                element={
                  <RequireAuth>
                    <ChatPage />
                  </RequireAuth>
                }
              />

              {/* ---------- Guest features ---------- */}
              <Route
                path="/reserve/:id"
                element={
                  <RequireAuth>
                    <ReservePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/bookings"
                element={
                  <RequireAuth>
                    <GuestBookings />
                  </RequireAuth>
                }
              />
              <Route
  path="/booking/:bookingId/chat"
  element={
    <RequireAuth>
      <ChatStart />
    </RequireAuth>
  }
/>
              {/* ✅ Favourites / Wishlist (aliases) */}
              <Route
                path="/favourites"
                element={
                  <RequireAuth>
                    <Wishlist />
                  </RequireAuth>
                }
              />
              <Route path="/wishlist" element={<Navigate to="/favourites" replace />} />
              <Route path="/favorites" element={<Navigate to="/favourites" replace />} />

              {/* =========================================================
                  ✅ ONLY HOST/PARTNER/ADMIN CAN SET PAYOUT DETAILS
                  ========================================================= */}
              <Route
                path="/payout-setup"
                element={
                  <RequireAuth>
                    <RequireRole roles={["host", "partner", "admin"]}>
                      <PayoutSetup />
                    </RequireRole>
                  </RequireAuth>
                }
              />

              {/* =========================================================
                  ✅ ONLY HOST/PARTNER/ADMIN CAN LIST PROPERTIES
                  ========================================================= */}
              <Route
                path="/post"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "partner", "admin"]}>
                        <PostAdRouter />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />
              <Route
                path="/post/new"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "partner", "admin"]}>
                        <CreateListing />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />
              <Route
                path="/listing/:id/edit"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "partner", "admin"]}>
                        <EditListing />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />

              {/* ---------- Host / Partner dashboards & tools ---------- */}
              <Route
                path="/host"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "admin"]}>
                        <HostDashboard />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />
              <Route
                path="/partner"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["partner", "admin"]}>
                        <PartnerDashboard />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />

              <Route
                path="/host-reservations"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "admin"]}>
                        <HostReservationsPage />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />
              <Route
                path="/reservations"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["partner", "admin"]}>
                        <PartnerReservationsPage />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />

              <Route
                path="/withdrawals"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "partner", "admin"]}>
                        <Withdrawals />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />

              <Route
                path="/manage-listings"
                element={
                  <RequireAuth>
                    <RequireKycApproved>
                      <RequireRole roles={["host", "partner", "admin"]}>
                        <ManageMyListings />
                      </RequireRole>
                    </RequireKycApproved>
                  </RequireAuth>
                }
              />

              <Route path="/host-listings" element={<Navigate to="/manage-listings" replace />} />
              <Route path="/partner-listings" element={<Navigate to="/manage-listings" replace />} />

              {/* ✅ Alias routes to prevent “bounce to home” when old paths exist */}
              <Route path="/partner-reservations" element={<Navigate to="/reservations" replace />} />
              <Route path="/partner-withdrawals" element={<Navigate to="/withdrawals" replace />} />
              <Route path="/partner-wallet" element={<Navigate to="/withdrawals" replace />} />
              <Route path="/partner-manage-listings" element={<Navigate to="/manage-listings" replace />} />
              <Route path="/partner-add-listing" element={<Navigate to="/post/new" replace />} />
              <Route path="/partner-inbox" element={<Navigate to="/inbox" replace />} />

              {/* ---------- Admin (consolidated) ---------- */}
              <Route
                path="/admin/*"
                element={
                  <RequireAdmin>
                    <AdminRouter />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminDashboard />
                  </RequireAdmin>
                }
              />

              {/* ---------- Backstop ---------- */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Footer />
          </ToastProvider>
        </BrowserRouter>
      </InboxProvider>
    </AuthProvider>
  );
}
