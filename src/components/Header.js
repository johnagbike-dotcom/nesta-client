// src/components/Header.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const navigate = useNavigate();
  const auth = getAuth();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // (optional) clear any local state you keep
      navigate("/", { replace: true });
    } catch (e) {
      console.error("Failed to sign out:", e);
      alert("Failed to sign out. Check console for details.");
    }
  };

  const link = "text-white/80 hover:text-amber-300";

  return (
    <header className="w-full bg-[#0b0f14] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          NESTA
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/browse" className={link}>Browse</Link>
          <Link to="/help" className={link}>Help</Link>

          {!user ? (
            <>
              <Link to="/login" className={link}>Login</Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-300 font-semibold hover:bg-amber-400/10"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className={link}>Dashboard</Link>
              <Link to="/profile" className={link}>Profile</Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}