// src/components/Header.js
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import useUnreadCount from "../hooks/useUnreadCount";
import useReservationsAttentionCount from "../hooks/useReservationsAttentionCount";
import OfficialLogo from "../assets/Official-Logo.jpg";

// mobile + desktop heights
const TOPBAR_H_MOBILE = 72;
const TOPBAR_H_DESKTOP = 88;

// single source of truth for "List your home" route
const LIST_YOUR_HOME_ROUTE = "/onboarding/kyc/apply";

function useTopbarCssVar() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      root.style.setProperty(
        "--topbar-h",
        `${isMobile ? TOPBAR_H_MOBILE : TOPBAR_H_DESKTOP}px`
      );
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
}

function getInitials(profile, user) {
  const name =
    profile?.displayName ||
    profile?.name ||
    user?.displayName ||
    user?.email ||
    "N";

  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function getShortName(profile, user) {
  const name =
    profile?.displayName ||
    profile?.name ||
    user?.displayName ||
    "";

  if (name) return name;

  const email = String(user?.email || "");
  return email.split("@")[0] || "User";
}

function BrandButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-full px-1 py-1 transition-all duration-300 hover:opacity-95"
      aria-label="Go to homepage"
    >
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-full bg-amber-300/10 blur-md transition-opacity duration-300 group-hover:bg-amber-300/20" />
        <img
          src={OfficialLogo}
          alt="Nesta"
          className="relative h-9 w-auto object-contain sm:h-10"
        />
      </div>

      <div className="hidden sm:flex flex-col items-start leading-none">
        <span className="text-[15px] font-semibold tracking-[0.14em] text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.18)]">
          NestaNg
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
          Premium stays
        </span>
      </div>
    </button>
  );
}

function NavItem({ to, children, end, title, mobile = false }) {
  const baseDesktop =
    "relative px-3 py-2 rounded-full text-sm font-medium transition-all duration-300";
  const baseMobile =
    "block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-300";

  const activeDesktop =
    "text-[#f5b301] bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(245,179,1,0.16)]";
  const idleDesktop =
    "text-white/72 hover:text-white hover:bg-white/[0.05]";

  const activeMobile =
    "text-[#f5b301] bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(245,179,1,0.16)]";
  const idleMobile =
    "text-white/75 hover:text-white hover:bg-white/[0.05]";

  return (
    <NavLink
      to={to}
      end={end}
      title={title}
      className={({ isActive }) =>
        mobile
          ? `${baseMobile} ${isActive ? activeMobile : idleMobile}`
          : `${baseDesktop} ${isActive ? activeDesktop : idleDesktop}`
      }
    >
      {children}
    </NavLink>
  );
}

function VerifiedBadge({ isKycApproved, isHost, isPartner, mobile = false }) {
  if (!isKycApproved || (!isHost && !isPartner)) return null;

  return (
    <span
      className={
        mobile
          ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-50"
          : "hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-50"
      }
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
      {isHost ? "Verified host" : "Verified partner"}
    </span>
  );
}

function AttentionReservationsLink({ to, label, uid }) {
  const nav = useNavigate();
  const attentionCount = useReservationsAttentionCount(uid || null);

  return (
    <div className="relative">
      <button
        onClick={() => nav(to)}
        className="relative rounded-full px-3 py-2 text-sm font-medium text-white/72 transition-all duration-300 hover:bg-white/[0.05] hover:text-white"
      >
        {label}
      </button>

      {attentionCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(239,68,68,0.45)]">
          {attentionCount}
        </span>
      )}
    </div>
  );
}

function AttentionReservationsLinkMobile({ to, label, uid }) {
  const nav = useNavigate();
  const attentionCount = useReservationsAttentionCount(uid || null);

  return (
    <button
      onClick={() => nav(to)}
      className="relative block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white/75 transition-all duration-300 hover:bg-white/[0.05] hover:text-white"
    >
      <span>{label}</span>

      {attentionCount > 0 && (
        <span className="absolute right-3 top-1/2 grid h-[19px] min-w-[19px] -translate-y-1/2 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(239,68,68,0.45)]">
          {attentionCount}
        </span>
      )}
    </button>
  );
}

export default function Header() {
  useTopbarCssVar();

  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { profile } = useUserProfile();
  const unread = useUnreadCount(user?.uid);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const roleRaw = (profile?.role || "").toLowerCase();
  const kyc = (profile?.kycStatus || "").toLowerCase();

  const isKycApproved =
    kyc === "approved" || kyc === "verified" || kyc === "complete";

  const isHost = !!user && (roleRaw === "host" || roleRaw === "verified_host");
  const isPartner =
    !!user && (roleRaw === "partner" || roleRaw === "verified_partner");
  const isAdmin = !!user && roleRaw === "admin";
  const isOperations = !!user && roleRaw === "operations";

  const initials = getInitials(profile, user);
  const shortName = getShortName(profile, user);
  const avatarPhoto = profile?.photoURL || user?.photoURL || null;

  // ── Desktop user pill — now a link to /profile ──
  const userPill = user ? (
    <Link
      to="/profile"
      title="Edit your profile"
      className="hidden lg:flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 backdrop-blur-md transition-all duration-300 hover:border-amber-400/30 hover:bg-white/[0.08]"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#f5b301] to-[#c89200] text-sm font-extrabold text-black shadow-[0_10px_24px_rgba(0,0,0,.35)] overflow-hidden flex-shrink-0">
        {avatarPhoto
          ? <img src={avatarPhoto} alt={shortName} className="w-full h-full object-cover" />
          : initials}
      </div>

      <div className="max-w-[190px] leading-tight">
        <div className="truncate text-xs font-semibold text-white">
          {shortName}
        </div>
        <div className="truncate text-[11px] text-white/50">{user.email}</div>
      </div>
    </Link>
  ) : null;

  const logoutBtn = (
    <button
      onClick={async () => {
        await logout();
        nav("/login", { replace: true });
      }}
      className="rounded-full bg-[#f5b301] px-4 py-2 text-sm font-semibold text-black transition duration-300 hover:brightness-105 hover:shadow-[0_8px_24px_rgba(245,179,1,0.28)]"
    >
      Logout
    </button>
  );

  const visitorCtas = (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => nav("/login")}
        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition duration-300 hover:bg-white/[0.08]"
      >
        Login
      </button>

      <button
        onClick={() => nav("/signup")}
        className="rounded-full bg-[#f5b301] px-5 py-2 text-sm font-semibold text-black transition duration-300 hover:brightness-105 hover:shadow-[0_8px_24px_rgba(245,179,1,0.28)]"
      >
        Get started
      </button>
    </div>
  );

  const inboxLabel = `Inbox${unread > 0 ? ` (${unread})` : ""}`;

  const navLinks = useMemo(() => {
    if (!user) {
      return [
        { to: "/explore", label: "Browse", end: true },
        { to: "/about", label: "About" },
        { to: LIST_YOUR_HOME_ROUTE, label: "List your home" },
      ];
    }

    if (isAdmin || isOperations) {
      return [
        { to: "/admin", label: "Dashboard", end: true },
        { to: "/inbox", label: inboxLabel },
      ];
    }

    if (isHost) {
      return [
        { to: "/host", label: "Host dashboard", end: true },
        { to: "/host-reservations", label: "Reservations", attention: true },
        { to: "/withdrawals", label: "Wallet", title: "Withdrawals & payout history" },
        { to: "/host-listings", label: "Manage listings" },
        { to: "/inbox", label: inboxLabel },
      ];
    }

    if (isPartner) {
      return [
        { to: "/partner", label: "Partner dashboard", end: true },
        { to: "/reservations", label: "Reservations", attention: true },
        { to: "/withdrawals", label: "Wallet", title: "Withdrawals & payout history" },
        { to: "/partner-listings", label: "My portfolio" },
        { to: "/inbox", label: inboxLabel },
      ];
    }

    return [
      { to: "/explore", label: "Browse", end: true },
      { to: "/bookings", label: "Bookings" },
      { to: LIST_YOUR_HOME_ROUTE, label: "List your home" },
      { to: "/inbox", label: inboxLabel },
    ];
  }, [user, isAdmin, isOperations, isHost, isPartner, inboxLabel]);

  return (
    <header
      className="fixed left-0 top-0 z-50 w-full border-b border-white/8 bg-[#07090d]/82 backdrop-blur-xl"
      style={{ height: "var(--topbar-h)" }}
    >
      {/* soft top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" />
      <div className="pointer-events-none absolute left-8 top-0 h-20 w-28 rounded-full bg-amber-300/8 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-0 h-20 w-28 rounded-full bg-white/6 blur-3xl" />

      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
        <BrandButton onClick={() => nav("/")} />

        <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 backdrop-blur-md">
          {navLinks.map((l) =>
            l.attention ? (
              <AttentionReservationsLink key={l.to} to={l.to} label={l.label} uid={user?.uid} />
            ) : (
              <NavItem key={l.to} to={l.to} end={l.end} title={l.title}>
                {l.label}
              </NavItem>
            )
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {userPill}
              <VerifiedBadge isKycApproved={isKycApproved} isHost={isHost} isPartner={isPartner} />
              {logoutBtn}
            </>
          ) : (
            visitorCtas
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm text-white transition duration-300 hover:bg-white/[0.08]"
            aria-expanded={open ? "true" : "false"}
            aria-label="Open menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#07090d]/95 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-3 py-4">
            {user ? (
              // ── Mobile user card — now a link to /profile ──
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 transition-all hover:border-amber-400/25 hover:bg-white/[0.07]"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#f5b301] to-[#c89200] text-sm font-extrabold text-black shadow-[0_10px_24px_rgba(0,0,0,.35)] overflow-hidden flex-shrink-0">
                  {avatarPhoto
                    ? <img src={avatarPhoto} alt={shortName} className="w-full h-full object-cover" />
                    : initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{shortName}</div>
                  <div className="truncate text-[11px] text-white/55">{user.email}</div>
                </div>

                <span className="text-[11px] text-white/30 flex-shrink-0">Edit profile →</span>
              </Link>
            ) : null}

            <div className="grid gap-1.5">
              {navLinks.map((l) =>
                l.attention ? (
                  <AttentionReservationsLinkMobile key={l.to} to={l.to} label={l.label} uid={user?.uid} />
                ) : (
                  <NavItem key={l.to} to={l.to} end={l.end} title={l.title} mobile>
                    {l.label}
                  </NavItem>
                )
              )}
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-2">
              {user ? (
                <>
                  <VerifiedBadge isKycApproved={isKycApproved} isHost={isHost} isPartner={isPartner} mobile />
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