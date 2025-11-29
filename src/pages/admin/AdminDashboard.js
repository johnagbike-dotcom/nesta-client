// src/pages/admin/AdminDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { db } from "../../firebase"; // adjust path if needed

// ---------- helpers ----------

const money = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
};

const softNum = (n) =>
  typeof n === "number" ? n.toLocaleString("en-NG") : "0";

const isAttentionStatus = (statusRaw) => {
  const s = String(statusRaw || "").toLowerCase();
  return ["pending", "hold", "hold-pending", "change-request", "date-change", "cancel-request"].includes(
    s
  );
};

// Normalise a booking document into a single shape we can render
const normaliseBooking = (doc) => {
  const data = doc.data ? doc.data() : doc;
  const createdAt =
    data.createdAt?.toDate?.() || data.createdAt || null;

  return {
    id: doc.id || data.id,
    listingTitle:
      data.listingTitle || data.listing || data.title || "—",
    guestEmail: data.email || data.guestEmail || data.guest || "—",
    status: data.status || "confirmed",
    amount:
      Number(data.amountN ?? data.amount ?? data.total ?? 0) || 0,
    nights: Number(data.nights ?? 0) || 0,
    createdAt,
    reference: data.reference || data.ref || "",
  };
};

// ---------- component ----------

export default function AdminDashboard() {
  const nav = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load bookings + users directly from Firestore
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // 1) Bookings
        const bookingsRef = collection(db, "bookings");
        const qBookings = query(
          bookingsRef,
          orderBy("createdAt", "desc"),
          limit(200)
        );

        const snap = await getDocs(qBookings);
        if (!alive) return;

        const loaded = snap.docs.map((d) => normaliseBooking(d));
        setBookings(loaded);

        // 2) Users / hosts count
        // For now we simply count docs in "users" collection.
        // (Fine for admin-only usage – called rarely.)
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          if (!alive) return;
          setUsersCount(usersSnap.size || 0);
        } catch (e) {
          // If users collection is missing or restricted, just fall back silently.
          console.warn("[Admin] Could not load users count:", e);
        }
      } catch (e) {
        console.error("[Admin] Dashboard load failed:", e);
        if (alive) {
          setError("We couldn’t load admin stats right now.");
          setBookings([]);
          setUsersCount(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // Derived metrics
  const stats = useMemo(() => {
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return {
        totalBookings: 0,
        totalRevenue: 0,
        needsAttention: 0,
        avgValue: 0,
        avgNights: 0,
        totalNights: 0,
        latest: [],
      };
    }

    let totalRevenue = 0;
    let totalNights = 0;
    let needsAttention = 0;

    bookings.forEach((b) => {
      totalRevenue += b.amount || 0;
      totalNights += b.nights || 0;
      if (isAttentionStatus(b.status)) needsAttention += 1;
    });

    const totalBookings = bookings.length;
    const avgValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const avgNights =
      totalBookings > 0 ? totalNights / totalBookings : 0;

    return {
      totalBookings,
      totalRevenue,
      needsAttention,
      avgValue,
      avgNights,
      totalNights,
      latest: bookings.slice(0, 8),
    };
  }, [bookings]);

  return (
    <div className="min-h-screen bg-[#0b0d11] pb-16 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <button
          onClick={() => nav(-1)}
          className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          ← Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => nav("/admin/bookings-admin")}
            className="rounded-2xl bg-[#f5b800] px-5 py-2 text-sm font-bold text-black shadow-md hover:brightness-110"
          >
            View bookings
          </button>
          <button
            onClick={() => nav("/inbox")}
            className="rounded-2xl bg-white/5 border border-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Open inbox
          </button>
        </div>
      </div>

      {/* Heading */}
      <div className="px-6 mt-4 mb-3">
        <h1 className="text-3xl font-black tracking-tight">
          Admin control centre
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Platform health, bookings, users and admin tools at a glance.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6">
        {/* Total bookings */}
        <div className="rounded-3xl bg-gradient-to-br from-[#f5b800] to-[#ff7b1b] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-black/70 font-bold">
            TOTAL BOOKINGS
          </p>
          <p className="text-5xl font-black text-black mt-2 leading-none">
            {softNum(stats.totalBookings)}
          </p>
          <p className="text-black/60 text-sm mt-3">
            All-time across the platform
          </p>
        </div>

        {/* Revenue */}
        <div className="rounded-3xl bg-gradient-to-br from-[#00735f] to-[#008c86] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            REVENUE (RAW)
          </p>
          <p className="text-5xl font-black mt-2 leading-none">
            {money(stats.totalRevenue)}
          </p>
          <p className="text-white/60 text-sm mt-3">
            From booking payloads (not settled)
          </p>
        </div>

        {/* Needs attention */}
        <div className="rounded-3xl bg-gradient-to-br from-[#b5131d] to-[#a10b38] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            ITEMS NEEDING ATTENTION
          </p>
          <p className="text-5xl font-black mt-2 leading-none">
            {softNum(stats.needsAttention)}
          </p>
          <p className="text-white/70 text-sm mt-3">
            Pending / cancel / date-change
          </p>
        </div>

        {/* Users */}
        <div className="rounded-3xl bg-gradient-to-br from-[#0b65c7] to-[#002e6f] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            USERS / HOSTS (APPROX.)
          </p>
          <p className="text-5xl font-black mt-2 leading-none">
            {softNum(usersCount)}
          </p>
          <p className="text-white/60 text-sm mt-3">
            From Firestore: users collection
          </p>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 mt-5">
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Avg booking value
          </div>
          <div className="text-3xl font-bold mt-2">
            {money(stats.avgValue)}
          </div>
        </div>
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Avg nights / booking
          </div>
          <div className="text-3xl font-bold mt-2">
            {stats.avgNights.toFixed(1)}
          </div>
        </div>
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Total nights (sample)
          </div>
          <div className="text-3xl font-bold mt-2">
            {softNum(stats.totalNights)}
          </div>
        </div>
      </div>

      {/* Middle section */}
      <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6 px-6 mt-6">
        {/* Latest bookings */}
        <div className="rounded-3xl bg-[#101318] border border-white/5 shadow-inner overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-white font-semibold text-lg">
              Latest bookings
            </h2>
            <button
              onClick={() => nav("/admin/bookings-admin")}
              className="text-sm text-white/50 hover:text-white"
            >
              View all →
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {stats.latest.length === 0 ? (
              <div className="px-5 py-6 text-sm text-white/40">
                No bookings yet.
              </div>
            ) : (
              stats.latest.map((b) => (
                <div
                  key={b.id}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-semibold">
                      {b.listingTitle}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">
                      guest: {b.guestEmail} • ref:{" "}
                      {String(b.reference || b.id || "—").slice(0, 22)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-bold">
                      {money(b.amount)}
                    </p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (b.status || "").toLowerCase() === "confirmed"
                          ? "bg-emerald-600/15 text-emerald-200 border border-emerald-500/30"
                          : (b.status || "").toLowerCase() === "cancelled"
                          ? "bg-rose-600/15 text-rose-200 border border-rose-500/30"
                          : "bg-slate-500/15 text-slate-200 border border-slate-500/30"
                      }`}
                    >
                      {(b.status || "draft").toLowerCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System activity */}
        <div className="rounded-3xl bg-[#101318] border border-white/5 shadow-inner px-5 py-4 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-lg">
            System activity
          </h2>
          <p className="text-xs text-white/40 mb-1">
            What admins / hosts may need to see.
          </p>

          <button
            onClick={() => nav("/admin/bookings-admin")}
            className="rounded-2xl bg-gradient-to-r from-[#2f83ff] to-[#36c2ff] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Review booking approvals
            <div className="text-xs text-white/70">
              Waiting for action
            </div>
          </button>

          <button
            onClick={() => nav("/admin/payouts")}
            className="rounded-2xl bg-gradient-to-r from-[#00a77e] to-[#00bf8f] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Payouts &amp; settlements
            <div className="text-xs text-white/70">
              Track partner/host payouts
            </div>
          </button>

          <button
            onClick={() => nav("/admin/transactions")}
            className="rounded-2xl bg-gradient-to-r from-[#705cff] to-[#8849f6] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Transactions
            <div className="text-xs text-white/70">
              Full ledger, refunds, corrections
            </div>
          </button>

          <button
            onClick={() => nav("/admin/feature-requests")}
            className="rounded-2xl bg-gradient-to-r from-[#ff8a44] to-[#ff546a] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Feature / issue requests
            <div className="text-xs text-white/70">
              View feedback coming from users
            </div>
          </button>

          <button
            onClick={() => nav("/admin/listings")}
            className="rounded-2xl bg-gradient-to-r from-[#5657ff] to-[#8836ff] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Manage listings
            <div className="text-xs text-white/70">
              Approve, disable, toggle featured
            </div>
          </button>

          <button
            onClick={() => nav("/admin/onboarding-queue")}
            className="rounded-2xl bg-[#161a1f] px-5 py-3 text-left font-semibold hover:bg-white/5"
          >
            Onboarding queue
            <div className="text-xs text-white/60">
              Host &amp; partner KYC / roles
            </div>
          </button>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => nav("/admin/data-tools")}
              className="rounded-2xl bg-[#0c0f13] border border-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Data tools
            </button>
            <button
              onClick={() => nav("/admin/reports")}
              className="rounded-2xl bg-[#0c0f13] border border-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Reports &amp; exports
            </button>
            <button
              onClick={() => nav("/admin/manage-users")}
              className="rounded-2xl bg-[#0c0f13] border border-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Manage users
            </button>
            <button
              onClick={() => nav("/admin/settings")}
              className="rounded-2xl bg-[#0c0f13] border border-white/10 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-black/70 text-white/70 rounded-xl px-4 py-2 text-sm">
          Refreshing admin data…
        </div>
      )}

      {error && !loading && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-rose-700/90 text-white rounded-xl px-4 py-2 text-sm max-w-md text-center">
          {error}
        </div>
      )}
    </div>
  );
}
