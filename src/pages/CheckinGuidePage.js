// src/pages/CheckinGuidePage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAuth } from "firebase/auth";
import useUserProfile from "../hooks/useUserProfile";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";
import "../styles/motion.css";

/* ===================== API base ===================== */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

function safeStr(v) {
  return String(v ?? "").trim();
}
function lower(v) {
  return safeStr(v).toLowerCase();
}

async function getBearerToken() {
  try {
    const auth = getAuth();
    return auth.currentUser ? await auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

/* ===================== Policy helpers ===================== */

function allowedStatus(status) {
  const s = lower(status);
  return (
    s === "confirmed" ||
    s === "paid" ||
    s === "completed" ||
    s === "paid_pending_release" ||
    s === "checked_in" ||
    s === "released"
  );
}

function bookingBelongsToUser(booking, uid) {
  if (!booking || !uid) return false;

  const guestUid = safeStr(
    booking.guestUid || booking.guestId || booking.userId || booking.userUid || ""
  );

  return guestUid && guestUid === String(uid);
}

function prettyStatus(status) {
  const s = lower(status);
  if (!s) return "Pending";
  if (s === "paid") return "Paid";
  if (s === "confirmed") return "Confirmed";
  if (s === "completed") return "Completed";
  if (s === "paid_pending_release") return "Paid — awaiting check-in";
  if (s === "checked_in") return "Checked in";
  if (s === "released") return "Stay active";
  if (s === "cancelled") return "Cancelled";
  if (s === "refunded") return "Refunded";
  if (s === "failed") return "Failed";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ===================== Date helpers ===================== */
function toDateObj(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

function fmtDateTime(v, fallback = "—") {
  const d = toDateObj(v);
  if (!d || Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ===================== UI bits ===================== */
function InfoBlock({ label, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-wide text-white/50 mb-1">
        {label}
      </div>
      <div className="text-sm leading-relaxed text-white/90">{children}</div>
    </div>
  );
}

export default function CheckinGuidePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();

  const { user, profile: authProfile } = useAuth();
  const { profile: liveProfile } = useUserProfile();
  const profile = liveProfile || authProfile || {};

  const [booking, setBooking] = useState(state?.booking || null);
  const [loading, setLoading] = useState(!state?.booking);
  const [error, setError] = useState("");

  const role = useMemo(
    () => lower(profile?.role || profile?.type || ""),
    [profile?.role, profile?.type]
  );
  const isGuestRole = useMemo(() => !role || role === "guest", [role]);

  const loadBooking = useCallback(async () => {
    const bid = safeStr(id || "");
    if (!bid) {
      setError("Missing bookingId.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = await getBearerToken();
      const res = await fetch(`${API}/bookings/${encodeURIComponent(bid)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const b = json?.booking || json?.data || json || {};
      const normalized = { id: b.id || bid, ...b };

      setBooking(normalized);
    } catch (e) {
      console.error("[CheckinGuidePage] load error:", e);
      setError("Unable to load check-in guide.");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      if (!user?.uid) return;
      if (booking) return;
      await loadBooking();
    })();
    return () => {
      alive = false;
    };
  }, [user?.uid, booking, loadBooking]);

  /* ===================== Guards ===================== */

  if (!user) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 pt-[calc(var(--topbar-h,88px)+24px)] pb-10">
        <div className="max-w-3xl mx-auto">
          <p>Please sign in to view this page.</p>
          <button
            onClick={() => nav("/login")}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold"
          >
            Go to login
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 pt-[calc(var(--topbar-h,88px)+24px)] pb-10">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          Loading check-in guide…
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 pt-[calc(var(--topbar-h,88px)+24px)] pb-10">
        <div className="max-w-3xl mx-auto rounded-2xl bg-red-500/10 border border-red-400/30 p-6">
          {error || "Unable to display guide."}
          <button
            onClick={() => nav(-1)}
            className="mt-4 px-4 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15"
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  const isOwnerGuest = bookingBelongsToUser(booking, user.uid);

  if (!isGuestRole || !isOwnerGuest || !allowedStatus(booking.status)) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 pt-[calc(var(--topbar-h,88px)+24px)] pb-10">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-xl font-bold mb-2">Check-in guide unavailable</h2>
          <p className="text-white/70 text-sm">
            This guide is visible only to the confirmed guest on this booking.
          </p>
          <button
            onClick={() => nav(-1)}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold"
          >
            Go back
          </button>
        </div>
      </main>
    );
  }

  /* ===================== Render ===================== */

  const {
    title,
    listingTitle,
    listingLocation,
    city,
    area,
    listingId,
    checkIn,
    checkOut,
    guests,
    checkinGuide,
  } = booking;

  const displayTitle = title || listingTitle || "Your stay";
  const displayLocation = listingLocation || city || area || "";
  const displayStatus = prettyStatus(booking.status);

  const arrivalText =
    checkinGuide?.arrival ||
    (lower(booking.status) === "paid_pending_release"
      ? "Your booking is paid. Arrival details will be provided by your host before check-in."
      : lower(booking.status) === "checked_in"
      ? "Your check-in has been confirmed. Please follow the host’s arrival instructions shared for your stay."
      : "Arrival details will be provided by your host before check-in.");

  const accessText =
    checkinGuide?.access ||
    (lower(booking.status) === "checked_in" || lower(booking.status) === "released"
      ? "Access instructions should already have been shared for your stay. If you still need help, please use secure chat."
      : "Access instructions will be shared closer to your arrival date.");

  const rulesText =
    checkinGuide?.rules ||
    "Please respect the property and adhere to all house rules provided by the host or partner.";

  const wifiText =
    checkinGuide?.wifi ||
    "Wi-Fi details will be available inside the property or via host instructions.";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 pt-[calc(var(--topbar-h,88px)+24px)] pb-10 motion-fade-in">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 motion-slide-up">
          <h1 className="text-3xl font-extrabold tracking-tight">Check-in Guide</h1>
          <p className="text-white/60 mt-2">
            {displayTitle} {displayLocation ? `• ${displayLocation}` : ""}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <InfoBlock label="Check-in">{fmtDateTime(checkIn)}</InfoBlock>
          <InfoBlock label="Check-out">{fmtDateTime(checkOut)}</InfoBlock>
          <InfoBlock label="Guests">{guests || 1}</InfoBlock>
          <InfoBlock label="Status">
            <span className="text-emerald-300 font-semibold">{displayStatus}</span>
          </InfoBlock>
        </div>

        <div className="space-y-5">
          <InfoBlock label="Arrival instructions">{arrivalText}</InfoBlock>

          <InfoBlock label="Access & keys">{accessText}</InfoBlock>

          <InfoBlock label="House rules">{rulesText}</InfoBlock>

          <InfoBlock label="Wi-Fi">{wifiText}</InfoBlock>

          <InfoBlock label="Support">
            If you need assistance during your stay, please use the in-app chat
            to contact your host or partner.
          </InfoBlock>
        </div>

        <div className="mt-10 flex justify-between items-center gap-3 flex-wrap">
          <button
            onClick={() => nav(-1)}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15"
          >
            ← Back to bookings
          </button>

          <div className="flex gap-2 flex-wrap">
            {listingId ? (
              <button
                onClick={() => nav(`/listing/${listingId}`)}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15"
              >
                Open listing
              </button>
            ) : null}

            <button
              onClick={() =>
                nav(`/booking/${booking.id}/chat`, {
                  state: {
                    bookingId: booking.id,
                    booking,
                    listing: listingId
                      ? { id: listingId, title: displayTitle }
                      : null,
                    from: "checkin_guide",
                  },
                })
              }
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              Chat with host / partner
            </button>
          </div>
        </div>

        <div className="mt-6 text-xs text-white/40">
          This information is private and visible only to the confirmed guest on this booking.
        </div>
      </div>
    </main>
  );
}