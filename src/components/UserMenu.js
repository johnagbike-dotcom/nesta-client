// src/components/UserMenu.js
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
* Props:
*  - user: Firebase user (email, displayName, photoURL)
*  - profile: Firestore user doc (role, partnerStatus, etc.)
*  - onLogout: () => Promise<void>
*/
export default function UserMenu({ user, profile, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials =
    (user?.displayName?.trim()?.slice(0, 1) ||
      user?.email?.slice(0, 1) ||
      "U").toUpperCase();

  const role = (profile?.role || "guest").toLowerCase();
  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "partner"
      ? profile?.partnerStatus === "verified"
        ? "Verified Partner"
        : "Partner (Pending)"
      : role === "host"
      ? "Host"
      : "Guest";

  const roleClass =
    role === "admin"
      ? "badge-admin"
      : role === "partner"
      ? profile?.partnerStatus === "verified"
        ? "badge-partner"
        : "badge-pending"
      : role === "host"
      ? "badge-host"
      : "badge-guest";

  return (
    <div className="user-menu" ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="user-chip"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((s) => !s)}
        title={user?.email || "Account"}
      >
        {user?.photoURL ? <img src={user.photoURL} alt="avatar" /> : initials}
      </button>

      {open && (
        <div
          className="menu-flyout"
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            background: "rgba(32,42,56,.96)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 12,
            minWidth: 260,
            padding: 10,
            boxShadow: "0 14px 28px rgba(0,0,0,.38)",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 10, padding: 6 }}>
            <div className="user-chip" style={{ width: 40, height: 40 }}>
              {user?.photoURL ? <img src={user.photoURL} alt="avatar" /> : initials}
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: "#e8efff",
                  marginBottom: 2,
                }}
              >
                {user?.displayName || user?.email?.split("@")[0] || "Your account"}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "#cbd8f1",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={user?.email || ""}
              >
                {user?.email || "—"}
              </div>
            </div>
          </div>

          {/* Role badge */}
          <div style={{ padding: "6px 6px 10px" }}>
            <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
          </div>

          {/* Links */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,.08)",
              marginTop: 8,
              paddingTop: 8,
              display: "grid",
              gap: 6,
            }}
          >
            <Link className="menu-link" to="/dashboard" onClick={() => setOpen(false)}>
              Dashboard
            </Link>
            <Link className="menu-link" to="/bookings" onClick={() => setOpen(false)}>
              Bookings
            </Link>
            <Link className="menu-link" to="/profile" onClick={() => setOpen(false)}>
              Profile & Settings
            </Link>
            {role === "admin" && (
              <Link className="menu-link" to="/admin" onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
          </div>

          {/* Logout */}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-gold" style={{ width: "100%" }} onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 




