// src/components/Header.js
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import useUnreadCount from "../hooks/useUnreadCount";
import useReservationsAttentionCount from "../hooks/useReservationsAttentionCount";

import OfficialLogo from "../assets/Official-Logo.jpg";

// mobile + desktop heights
const TOPBAR_H_MOBILE = 72;
const TOPBAR_H_DESKTOP = 88;

// helper: set CSS var so pages can use padding-top: var(--topbar-h)
function useTopbarCssVar() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      root.style.setProperty("--topbar-h", `${isMobile ? TOPBAR_H_MOBILE : TOPBAR_H_DESKTOP}px`);
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
}

function BrandButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 cursor-pointer px-1 py-1
                 transition-all duration-300 hover:opacity-90 hover:scale-[1.02]"
      aria-label="Go to homepage"
    >
      <img
        src={OfficialLogo}
        alt="Nesta"
        className="h-9 w-auto sm:h-10 shrink-0 object-contain"
      />
    </button>
  );
}

function NavItem({ to, children, end }) {
  const base = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const active = "text-[#f5b301]";
  const idle = "text-gray-200/80 hover:text-white";
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
      {children}
    </NavLink>
  );
}

export default function Header() {
  useTopbarCssVar();

  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const unread = useUnreadCount(user?.uid);

  const [open, setOpen] = useState(false);

  // close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const roleRaw = (profile?.role || "").toLowerCase();
  const kyc = (profile?.kycStatus || "").toLowerCase();
  const isKycApproved = kyc === "approved" || kyc === "verified" || kyc === "complete";

  const isGuest = !!user && (!roleRaw || roleRaw === "guest");
  const isHost = !!user && (roleRaw === "host" || roleRaw === "verified_host");
  const isPartner = !!user && (roleRaw === "partner" || roleRaw === "verified_partner");
  const isAdmin = !!user && roleRaw === "admin";

  const VerifiedBadge = () =>
    isKycApproved && (isHost || isPartner) ? (
      <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-50 text-[11px]">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        {isHost ? "Verified host" : "Verified partner"}
      </span>
    ) : null;

  const rightEmailPill = user?.email ? (
    <span className="hidden md:inline-flex truncate bg-white/5 px-3 py-1 rounded-full text-xs text-white/80">
      {user.email}
    </span>
  ) : null;

  const logoutBtn = (
    <button
      onClick={async () => {
        await logout();
        nav("/login", { replace: true });
      }}
      className="px-4 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold hover:brightness-105"
    >
      Logout
    </button>
  );

  const visitorCtas = (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => nav("/login")}
        className="px-4 py-1.5 rounded-full bg-white/5 text-white text-sm hover:bg-white/10"
      >
        Login
      </button>
      <button
        onClick={() => nav("/signup")}
        className="px-5 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold hover:brightness-105"
      >
        Get started
      </button>
    </div>
  );

  // role nav definitions (luxury wording)
  const navLinks = useMemo(() => {
    if (!user) {
      return [
        { to: "/explore", label: "Browse", end: true },
        { to: "/about", label: "About" },
        { to: "/post", label: "List your home" },
      ];
    }
    if (isAdmin) {
      return [
        { to: "/admin", label: "Admin", end: true },
        { to: "/inbox", label: `Inbox${unread > 0 ? ` (${unread})` : ""}` },
      ];
    }
    if (isHost) {
      return [
        { to: "/host", label: "Host dashboard", end: true },
        { to: "/host-reservations", label: "Reservations", attention: true },
        { to: "/host-listings", label: "Manage listings" },
        { to: "/inbox", label: `Inbox${unread > 0 ? ` (${unread})` : ""}` },
      ];
    }
    if (isPartner) {
      return [
        { to: "/partner", label: "Partner dashboard", end: true },
        { to: "/reservations", label: "Reservations", attention: true },
        { to: "/partner-listings", label: "My portfolio" },
        { to: "/inbox", label: `Inbox${unread > 0 ? ` (${unread})` : ""}` },
      ];
    }
    // guest
    return [
      { to: "/explore", label: "Browse", end: true },
      { to: "/bookings", label: "Bookings" },
      { to: "/post", label: "List your home" },
      { to: "/inbox", label: `Inbox${unread > 0 ? ` (${unread})` : ""}` },
    ];
  }, [user, isAdmin, isHost, isPartner, unread]);

  return (
    <header
      className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
      style={{ height: "var(--topbar-h)" }}
    >
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-3 sm:px-6 gap-3">
        <BrandButton onClick={() => nav("/")} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) =>
            l.attention ? (
              <AttentionReservationsLink key={l.to} to={l.to} label={l.label} />
            ) : (
              <NavItem key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavItem>
            )
          )}
        </nav>

        {/* Right side (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {rightEmailPill}
              <VerifiedBadge />
              {logoutBtn}
            </>
          ) : (
            visitorCtas
          )}
        </div>

        {/* Mobile: hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {user ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm"
              aria-expanded={open ? "true" : "false"}
              aria-label="Open menu"
            >
              ☰
            </button>
          ) : (
            <button
              onClick={() => setOpen((v) => !v)}
              className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm"
              aria-expanded={open ? "true" : "false"}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0e0e0e]/95 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-3 py-3 grid gap-2">
            {user?.email ? (
              <div className="text-xs text-white/70 px-2">
                Signed in as <span className="text-white/90">{user.email}</span>
              </div>
            ) : null}

            <div className="grid gap-1">
              {navLinks.map((l) =>
                l.attention ? (
                  <AttentionReservationsLinkMobile key={l.to} to={l.to} label={l.label} />
                ) : (
                  <NavItem key={l.to} to={l.to} end={l.end}>
                    {l.label}
                  </NavItem>
                )
              )}
            </div>

            <div className="pt-2 flex gap-2">
              {user ? (
                <>
                  <VerifiedBadge />
                  {logoutBtn}
                </>
              ) : (
                visitorCtas
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* helper for reservations bubble */
function AttentionReservationsLink({ to, label }) {
  // note: uid is read inside hook from auth in your existing code pattern, but we keep your signature simple:
  // if you need uid-specific, switch to: useReservationsAttentionCount(uid)
  // For now, we call it without uid to avoid breaking if uid is not passed.
  const nav = useNavigate();
  const { user } = useAuth?.() || {}; // safe guard if hook signature differs
  const attentionCount = useReservationsAttentionCount(user?.uid || null);

  // If your useAuth is not available here (depends on your setup), use the old uid prop approach instead.
  // If this line errors, tell me and I’ll switch back to your original prop signature.
  return (
    <div className="relative">
      <button
        onClick={() => nav(to)}
        className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-200/80 hover:text-white"
      >
        {label}
      </button>
      {attentionCount > 0 && (
        <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-bold grid place-items-center">
          {attentionCount}
        </span>
      )}
    </div>
  );
}

function AttentionReservationsLinkMobile({ to, label }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(to)}
      className="text-left px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-200/80 hover:text-white bg-white/0"
    >
      {label}
    </button>
  );
}
