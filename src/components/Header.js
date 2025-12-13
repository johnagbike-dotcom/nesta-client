// src/components/Header.js
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import useUnreadCount from "../hooks/useUnreadCount";
import useReservationsAttentionCount from "../hooks/useReservationsAttentionCount";

// ⬇️ Update this path/filename to match where you place the logo asset
import nestaLogo from "../assets/Official-Logo.jpg";

const TOPBAR_H = 88; // change to 96 if you still see overlap

// Small brand component so we don’t repeat it 4 times
function BrandButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 cursor-pointer px-2 py-1 
                 transition-all duration-300 hover:opacity-90 hover:scale-[1.03]"
    >
      <img
        src={nestaLogo}
        alt="Nesta"
        className="h-12 w-auto md:h-14 lg:h-16"
      />

      {/* OPTIONAL WORDMARK (hidden by default) */}
      {/* 
      <span className="hidden lg:inline text-xs font-semibold 
                      tracking-[0.28em] text-amber-300 uppercase">
        NESTA
      </span>
      */}
    </button>
  );
}


export default function Header() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const unread = useUnreadCount(user?.uid);

  const roleRaw = (profile?.role || "").toLowerCase();
  const kyc = (profile?.kycStatus || "").toLowerCase();
  const isKycApproved =
    kyc === "approved" || kyc === "verified" || kyc === "complete";

  const isGuest = !!user && (!roleRaw || roleRaw === "guest");
  const isHost = !!user && (roleRaw === "host" || roleRaw === "verified_host");
  const isPartner =
    !!user && (roleRaw === "partner" || roleRaw === "verified_partner");
  const isAdmin = !!user && roleRaw === "admin";


  const linkBase =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const linkActive = "text-[#f5b301]";
  const linkIdle = "text-gray-200/80 hover:text-white";

  const navClass = ({ isActive }) =>
    `${linkBase} ${isActive ? linkActive : linkIdle}`;

  const VerifiedBadge = () =>
    isKycApproved && (isHost || isPartner) ? (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-50 text-[11px]">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        {isHost ? "Verified host" : "Verified partner"}
      </span>
    ) : null;

  /* ───────── VISITOR ───────── */
  if (!user) {
    return (
      <header
  className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
  style={{ height: TOPBAR_H }}
>
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6 gap-4">
          <BrandButton onClick={() => nav("/")} />

          <nav className="flex items-center gap-1">
            <NavLink to="/explore" className={navClass} end>
              Browse
            </NavLink>
            <NavLink to="/about" className={navClass}>
              About
            </NavLink>
            <NavLink to="/post" className={navClass}>
              Post an Ad
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/login")}
              className="px-4 py-1.5 rounded-full bg-white/5 text-white text-sm hover:bg-white/10"
            >
              Login
            </button>
            <button
              onClick={() => nav("/signup")}
              className="px-5 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold"
            >
              Get started
            </button>
          </div>
        </div>
      </header>
    );
  }

  /* ───────── ADMIN ───────── */
  if (isAdmin) {
    return (
      <header
  className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
  style={{ height: TOPBAR_H }}
      >
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6 gap-4">
          <BrandButton onClick={() => nav("/")} />

          <nav className="flex items-center gap-1">
            <NavLink to="/admin" className={navClass} end>
              Admin
            </NavLink>
            <NavLink to="/inbox" className={navClass}>
              Inbox {unread > 0 ? `(${unread})` : ""}
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 max-w-[280px]">
            <span className="truncate bg-white/5 px-3 py-1 rounded-full text-xs text-white/80">
              {user.email}
            </span>
            <button
              onClick={async () => {
                await logout();
                nav("/login", { replace: true });
              }}
              className="px-4 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    );
  }

  /* ───────── HOST ───────── */
  if (isHost) {
    return (
      <header
  className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
  style={{ height: TOPBAR_H }}
>
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6 gap-4">
          <BrandButton onClick={() => nav("/")} />

          <nav className="flex items-center gap-1">
            <NavLink to="/host" className={navClass} end>
              Host dashboard
            </NavLink>

            <AttentionReservationsLink
              to="/host-reservations"
              navClass={navClass}
              uid={user.uid}
            />

            <NavLink to="/host-listings" className={navClass}>
              Manage listings
            </NavLink>
            <NavLink to="/inbox" className={navClass}>
              Inbox {unread > 0 ? `(${unread})` : ""}
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 max-w-[320px]">
            <span className="truncate bg-white/5 px-3 py-1 rounded-full text-xs text-white/80 flex items-center gap-2">
              {user.email}
              <VerifiedBadge />
            </span>
            <button
              onClick={async () => {
                await logout();
                nav("/login", { replace: true });
              }}
              className="px-4 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    );
  }

  /* ───────── PARTNER ───────── */
  if (isPartner) {
    return (
      <header
  className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
  style={{ height: TOPBAR_H }}
>
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6 gap-4">
          <BrandButton onClick={() => nav("/")} />

          <nav className="flex items-center gap-1">
            <NavLink to="/partner" className={navClass} end>
              Partner dashboard
            </NavLink>

            <AttentionReservationsLink
              to="/reservations"
              navClass={navClass}
              uid={user.uid}
            />

            <NavLink to="/partner-listings" className={navClass}>
              My portfolio
            </NavLink>
            <NavLink to="/inbox" className={navClass}>
              Inbox {unread > 0 ? `(${unread})` : ""}
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 max-w-[320px]">
            <span className="truncate bg-white/5 px-3 py-1 rounded-full text-xs text-white/80 flex items-center gap-2">
              {user.email}
              <VerifiedBadge />
            </span>
            <button
              onClick={async () => {
                await logout();
                nav("/login", { replace: true });
              }}
              className="px-4 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    );
  }

  /* ───────── LOGGED-IN GUEST ───────── */
  return (
    <header
  className="fixed top-0 left-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-md border-b border-white/5"
  style={{ height: TOPBAR_H }}
>
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6 gap-4">
        <BrandButton onClick={() => nav("/")} />

        <nav className="flex items-center gap-1">
          <NavLink to="/explore" className={navClass} end>
            Browse
          </NavLink>
          <NavLink to="/bookings" className={navClass}>
            Bookings
          </NavLink>
          <NavLink to="/post" className={navClass}>
            Post an Ad
          </NavLink>
          <NavLink to="/inbox" className={navClass}>
            Inbox {unread > 0 ? `(${unread})` : ""}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3 max-w-[280px]">
          <span className="truncate bg-white/5 px-3 py-1 rounded-full text-xs text-white/80">
            {user.email}
          </span>
          <button
            onClick={async () => {
              await logout();
              nav("/login", { replace: true });
            }}
            className="px-4 py-1.5 rounded-full bg-[#f5b301] text-black text-sm font-semibold"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

/* helper for reservations bubble */
function AttentionReservationsLink({ to, navClass, uid }) {
  const attentionCount = useReservationsAttentionCount(uid || null);
  return (
    <div className="relative">
      <NavLink to={to} className={navClass} end>
        Reservations
      </NavLink>
      {attentionCount > 0 && (
        <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-bold grid place-items-center">
          {attentionCount}
        </span>
      )}
    </div>
  );
}
