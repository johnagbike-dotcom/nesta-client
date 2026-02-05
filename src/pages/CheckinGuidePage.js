// src/pages/CheckinGuidePage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import "../styles/polish.css";
import "../styles/motion.css";

function allowedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "confirmed" || s === "paid" || s === "completed";
}

function toDateObj(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

function fmtDateTime(v, fallback = "—") {
  const d = toDateObj(v);
  if (!d || isNaN(d.getTime())) return fallback;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const { id } = useParams(); // bookingId
  const nav = useNavigate();
  const { state } = useLocation();

  const { user, profile: authProfile } = useAuth();
  const { profile: liveProfile } = useUserProfile(); // ✅ no args
  const profile = liveProfile || authProfile || {};

  const [booking, setBooking] = useState(state?.booking || null);
  const [loading, setLoading] = useState(!state?.booking);
  const [error, setError] = useState("");

  const isGuest = useMemo(() => {
    const r = String(profile?.role || "").toLowerCase();
    return !r || r === "guest";
  }, [profile?.role]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!id || booking) return;

      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "bookings", id));
        if (!snap.exists()) {
          setError("Booking not found.");
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        if (alive) setBooking(data);
      } catch (e) {
        console.error(e);
        if (alive) setError("Unable to load check-in guide.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [id, booking]);

  if (!user) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 py-10">
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
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          Loading check-in guide…
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 py-10">
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

  if (!isGuest || !allowedStatus(booking.status)) {
    return (
      <main className="min-h-[70vh] bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-xl font-bold mb-2">Check-in guide unavailable</h2>
          <p className="text-white/70 text-sm">
            This guide becomes available once your booking is confirmed.
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

  const {
    title,
    listingTitle,
    listingLocation,
    checkIn,
    checkOut,
    guests,
    checkinGuide,
  } = booking;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 py-10 motion-fade-in">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 motion-slide-up">
          <h1 className="text-3xl font-extrabold tracking-tight">Check-in Guide</h1>
          <p className="text-white/60 mt-2">
            {title || listingTitle || "Your stay"} • {listingLocation || ""}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <InfoBlock label="Check-in">{fmtDateTime(checkIn)}</InfoBlock>
          <InfoBlock label="Check-out">{fmtDateTime(checkOut)}</InfoBlock>
          <InfoBlock label="Guests">{guests || 1}</InfoBlock>
          <InfoBlock label="Status">
            <span className="text-emerald-300 font-semibold">
              {String(booking.status || "").toUpperCase()}
            </span>
          </InfoBlock>
        </div>

        <div className="space-y-5">
          <InfoBlock label="Arrival instructions">
            {checkinGuide?.arrival ||
              "Arrival details will be provided by your host before check-in."}
          </InfoBlock>

          <InfoBlock label="Access & keys">
            {checkinGuide?.access ||
              "Access instructions will be shared closer to your arrival date."}
          </InfoBlock>

          <InfoBlock label="House rules">
            {checkinGuide?.rules ||
              "Please respect the property and adhere to all house rules provided."}
          </InfoBlock>

          <InfoBlock label="Wi-Fi">
            {checkinGuide?.wifi || "Wi-Fi details will be available inside the property."}
          </InfoBlock>

          <InfoBlock label="Support">
            If you need assistance during your stay, please use the in-app chat
            to contact your host or partner.
          </InfoBlock>
        </div>

        <div className="mt-10 flex justify-between items-center">
          <button
            onClick={() => nav(-1)}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15"
          >
            ← Back to bookings
          </button>

          <button
            onClick={() => nav(`/booking/${booking.id}/chat`, { state: { booking } })}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            Chat with host / partner
          </button>
        </div>

        <div className="mt-6 text-xs text-white/40">
          This information is private and visible only to confirmed guests.
        </div>
      </div>
    </main>
  );
}
