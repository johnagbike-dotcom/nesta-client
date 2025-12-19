import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { getAuth } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(
    /\/$/,
    ""
  ),
  timeout: 20000,
  withCredentials: false,
});

// Attach Firebase ID token automatically (admin endpoints)
api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ------------------------------ helpers ------------------------------ */
const money = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
};

// Mobile-friendly compact money (₦11.1m, ₦235.8k etc.)
const shortMoney = (n) => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  if (!Number.isFinite(num)) return "₦0";
  if (abs >= 1e9) return `₦${(num / 1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `₦${(num / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `₦${(num / 1e3).toFixed(1)}k`;
  return `₦${num.toLocaleString("en-NG")}`;
};

const softNum = (n) => {
  const num = Number(n || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-NG") : "0";
};

const isAttentionStatus = (statusRaw) => {
  const s = String(statusRaw || "").toLowerCase();
  return [
    "pending",
    "hold",
    "hold-pending",
    "change-request",
    "date-change",
    "cancel-request",
  ].includes(s);
};

function safeDateLoose(v) {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }

  // {seconds,nanoseconds}
  if (typeof v === "object" && typeof v.seconds === "number") {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // epoch or ISO
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Normalise a booking document into a single shape we can render
const normaliseBooking = (docSnap) => {
  const data = docSnap?.data ? docSnap.data() : docSnap || {};
  const createdAt = safeDateLoose(
    data.createdAt || data.created_at || data.date || data.timestamp
  );

  return {
    id: docSnap?.id || data.id,
    listingTitle:
      data.listingTitle || data.listing || data.title || data.property || "—",
    guestEmail: data.email || data.guestEmail || data.guest || "—",
    status: data.status || "confirmed",
    amount:
      Number(data.amountN ?? data.amount ?? data.total ?? data.totalAmount ?? 0) ||
      0,
    nights: Number(data.nights ?? data.night ?? 0) || 0,
    createdAt,
    reference: data.reference || data.ref || "",
  };
};

/* ------------------------------ component ------------------------------ */
export default function AdminDashboard() {
  const nav = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [serverOverview, setServerOverview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");

    // ✅ Important: overviewOk now means "API gave us a valid users count"
    let overviewHasUsersCount = false;

    // 1) API overview (use if available)
    try {
      const res = await api.get("/admin/overview");
      const o = res?.data || null;

      setServerOverview(o);

      // ✅ Support either: { users: { total } } OR { users: number }
      const apiUsersCount = Number(o?.users?.total ?? o?.users ?? NaN);

      if (Number.isFinite(apiUsersCount)) {
        setUsersCount(apiUsersCount);
        overviewHasUsersCount = true;
      } else {
        // API overview may still be useful, but not for users count
        overviewHasUsersCount = false;
      }

      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      console.warn(
        "[AdminDashboard] /admin/overview failed, falling back to Firestore:",
        e?.response?.data || e?.message
      );
      setServerOverview(null);
      setError("Admin overview is temporarily unavailable. Showing fallback stats.");
      overviewHasUsersCount = false;
    }

    // 2) Latest bookings (Firestore)
    try {
      const bookingsRef = collection(db, "bookings");
      const qBookings = query(bookingsRef, orderBy("createdAt", "desc"), limit(200));
      const snap = await getDocs(qBookings);
      const loaded = snap.docs.map((d) => normaliseBooking(d));
      setBookings(loaded);

      // ✅ Fallback users count if API didn't supply it
      if (!overviewHasUsersCount) {
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          setUsersCount(usersSnap.size || 0);
        } catch (e2) {
          console.warn("[AdminDashboard] users count fallback failed:", e2?.message || e2);
        }
      }

      setUpdatedAt((prev) => prev || new Date().toISOString());
    } catch (e) {
      console.error("[AdminDashboard] Firestore bookings load failed:", e?.message || e);
      setBookings([]);
      if (!overviewHasUsersCount) setUsersCount(0);
      setError((prev) => prev || "We couldn’t load admin stats right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalNights = 0;
    let needsAttention = 0;

    bookings.forEach((b) => {
      totalRevenue += b.amount || 0;
      totalNights += b.nights || 0;
      if (isAttentionStatus(b.status)) needsAttention += 1;
    });

    const totalBookings = bookings.length;
    const avgValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const avgNights = totalBookings > 0 ? totalNights / totalBookings : 0;

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

  const updatedLabel = updatedAt ? dayjs(updatedAt).format("YYYY-MM-DD HH:mm") : "";

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

        <div className="flex items-center gap-3">
          {updatedLabel ? (
            <div className="hidden md:block text-xs text-white/40">
              Last updated: {updatedLabel}
            </div>
          ) : null}

          <button
            onClick={load}
            className="rounded-2xl bg-white/5 border border-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/10"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

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
        <h1 className="text-3xl font-black tracking-tight">Admin control centre</h1>
        <p className="text-white/50 text-sm mt-1">
          Platform health, bookings, users and admin tools at a glance.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6">
        {/* Total bookings */}
        <div className="min-w-0 rounded-3xl bg-gradient-to-br from-[#f5b800] to-[#ff7b1b] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-black/70 font-bold">
            TOTAL BOOKINGS
          </p>
          <p className="mt-2 leading-none font-black text-black break-words text-[clamp(2.0rem,6vw,3.0rem)]">
            {softNum(stats.totalBookings)}
          </p>
          <p className="text-black/60 text-sm mt-3">All-time across the platform</p>
        </div>

        {/* Revenue */}
        <div className="min-w-0 rounded-3xl bg-gradient-to-br from-[#00735f] to-[#008c86] px-5 py-5 shadow-lg overflow-hidden">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            REVENUE (RAW)
          </p>

          <p
            className="mt-2 leading-none font-black whitespace-nowrap text-[clamp(1.45rem,4.9vw,2.85rem)]"
            title={money(stats.totalRevenue)}
          >
            <span className="hidden md:inline">{money(stats.totalRevenue)}</span>
            <span className="md:hidden">{shortMoney(stats.totalRevenue)}</span>
          </p>

          <p className="text-white/60 text-sm mt-3">From booking payloads (not settled)</p>
        </div>

        {/* Needs attention */}
        <div className="min-w-0 rounded-3xl bg-gradient-to-br from-[#b5131d] to-[#a10b38] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            ITEMS NEEDING ATTENTION
          </p>
          <p className="mt-2 leading-none font-black break-words text-[clamp(2.0rem,6vw,3.0rem)]">
            {softNum(stats.needsAttention)}
          </p>
          <p className="text-white/70 text-sm mt-3">Pending / cancel / date-change</p>
        </div>

        {/* Users */}
        <div className="min-w-0 rounded-3xl bg-gradient-to-br from-[#0b65c7] to-[#002e6f] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            USERS / HOSTS (APPROX.)
          </p>
          <p className="mt-2 leading-none font-black break-words text-[clamp(2.0rem,6vw,3.0rem)]">
            {softNum(usersCount)}
          </p>
          <p className="text-white/60 text-sm mt-3">
            {serverOverview
              ? "API: /admin/overview (users if provided) + Firestore fallback"
              : "Fallback: Firestore users collection"}
          </p>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 mt-5">
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Avg booking value
          </div>
          <div className="text-3xl font-bold mt-2">{money(stats.avgValue)}</div>
        </div>
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Avg nights / booking
          </div>
          <div className="text-3xl font-bold mt-2">
            {Number(stats.avgNights || 0).toFixed(1)}
          </div>
        </div>
        <div className="rounded-3xl bg-[#101318] border border-white/5 px-5 py-4">
          <div className="text-xs text-white/50 uppercase tracking-[0.2em]">
            Total nights (sample)
          </div>
          <div className="text-3xl font-bold mt-2">{softNum(stats.totalNights)}</div>
        </div>
      </div>

      {/* Middle section */}
      <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6 px-6 mt-6">
        {/* Latest bookings */}
        <div className="rounded-3xl bg-[#101318] border border-white/5 shadow-inner overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-white font-semibold text-lg">Latest bookings</h2>
            <button
              onClick={() => nav("/admin/bookings-admin")}
              className="text-sm text-white/50 hover:text-white"
            >
              View all →
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {stats.latest.length === 0 ? (
              <div className="px-5 py-6 text-sm text-white/40">No bookings yet.</div>
            ) : (
              stats.latest.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{b.listingTitle}</p>
                    <p className="text-xs text-white/35 mt-0.5">
                      guest: {b.guestEmail} • ref:{" "}
                      {String(b.reference || b.id || "—").slice(0, 22)}
                      {b.createdAt ? (
                        <>
                          {" "}
                          •{" "}
                          <span className="text-white/35">
                            {dayjs(b.createdAt).format("YYYY-MM-DD HH:mm")}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-bold">{money(b.amount)}</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        String(b.status || "").toLowerCase() === "confirmed"
                          ? "bg-emerald-600/15 text-emerald-200 border border-emerald-500/30"
                          : String(b.status || "").toLowerCase() === "cancelled"
                          ? "bg-rose-600/15 text-rose-200 border border-rose-500/30"
                          : "bg-slate-500/15 text-slate-200 border border-slate-500/30"
                      }`}
                    >
                      {String(b.status || "draft").toLowerCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System activity */}
        <div className="rounded-3xl bg-[#101318] border border-white/5 shadow-inner px-5 py-4 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-lg">System activity</h2>
          <p className="text-xs text-white/40 mb-1">What admins / hosts may need to see.</p>

          <button
            onClick={() => nav("/admin/bookings-admin")}
            className="rounded-2xl bg-gradient-to-r from-[#2f83ff] to-[#36c2ff] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Review booking approvals
            <div className="text-xs text-white/70">Waiting for action</div>
          </button>

          <button
            onClick={() => nav("/admin/payouts")}
            className="rounded-2xl bg-gradient-to-r from-[#00a77e] to-[#00bf8f] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Payouts &amp; settlements
            <div className="text-xs text-white/70">Track partner/host payouts</div>
          </button>

          <button
            onClick={() => nav("/admin/transactions")}
            className="rounded-2xl bg-gradient-to-r from-[#705cff] to-[#8849f6] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Transactions
            <div className="text-xs text-white/70">Full ledger, refunds, corrections</div>
          </button>

          <button
            onClick={() => nav("/admin/feature-requests")}
            className="rounded-2xl bg-gradient-to-r from-[#ff8a44] to-[#ff546a] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Feature / issue requests
            <div className="text-xs text-white/70">View feedback coming from users</div>
          </button>

          <button
            onClick={() => nav("/admin/listings")}
            className="rounded-2xl bg-gradient-to-r from-[#5657ff] to-[#8836ff] px-5 py-3 text-left font-semibold hover:brightness-110"
          >
            Manage listings
            <div className="text-xs text-white/70">Approve, disable, toggle featured</div>
          </button>

          <button
            onClick={() => nav("/admin/onboarding-queue")}
            className="rounded-2xl bg-[#161a1f] px-5 py-3 text-left font-semibold hover:bg-white/5"
          >
            Onboarding queue
            <div className="text-xs text-white/60">Host &amp; partner KYC / roles</div>
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
