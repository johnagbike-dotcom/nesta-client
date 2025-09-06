// src/App.js
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

// Components / Pages (adjust paths if your files live elsewhere)
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import CheckoutPage from "./pages/CheckoutPage";
import SearchBrowse from "./pages/SearchBrowse";
import ListingDetail from "./pages/ListingDetails";
import CreateListing from "./pages/CreateListing";
import EditListing from "./pages/EditListing";
import PartnerDashboard from "./pages/PartnerDashboard";
import DevSeed from "./pages/DevSeed"; // optional, if you still have the seeder page

function RequireAuth({ children }) {
  const auth = getAuth();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, [auth]);

  if (!ready) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!user) return <Navigate to="/" replace />; // kick back to home if not signed in
  return children;
}

export default function App() {
  const auth = getAuth();

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      {/* Render the global header once here so we never get a double header */}
      <Header
        onLogout={() => {
          signOut(auth).catch(() => {});
        }}
      />

      {/* Keep page content inside <main> so the header stays single */}
      <main className="max-w-5xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<SearchBrowse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/checkout/:id" element={<CheckoutPage />} />

          {/* Partner routes (protected) */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <PartnerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/listing/new"
            element={
              <RequireAuth>
                <CreateListing />
              </RequireAuth>
            }
          />
          <Route
            path="/listing/:id/edit"
            element={
              <RequireAuth>
                <EditListing />
              </RequireAuth>
            }
          />

          {/* Optional dev seeder */}
          <Route path="/dev/seed" element={<DevSeed />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="max-w-5xl mx-auto p-4 opacity-70">
        <div>© 2025 Nesta. All rights reserved.</div>
        <div className="text-sm">
          <a href="/terms" className="underline">Terms</a>
          {" "}
          <a href="/privacy" className="underline">Privacy</a>
          {" "}
          <a href="/help" className="underline">Help</a>
        </div>
      </footer>
    </div>
  );
}