// src/pages/admin/AdminDashboard.js
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  withCredentials: false,
  timeout: 12000,
});

// simple fallback data
const EMPTY = {
  totalBookings: 0,
  revenue: 0,
  attention: 0,
  users: 0,
  latest: [],
};

const softNum = (n) => (typeof n === "number" ? n.toLocaleString("en-NG") : "0");
const money = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-NG", { style: "currency", currency: "NGN" })
    : "₦0";

export default function AdminDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // try a couple of endpoints so we don't 500 if one doesn't exist
      let overview = null;
      const candidates = ["/admin/overview", "/admin/stats", "/admin/bookings/summary"];
      for (const ep of candidates) {
        try {
          const res = await api.get(ep);
          if (res?.data) {
            overview = res.data;
            break;
          }
        } catch (e) {
          // try next
        }
      }

      // try to get latest bookings for the left list
      let latest = [];
      const bookingEndpoints = ["/admin/bookings", "/bookings", "/transactions"];
      for (const ep of bookingEndpoints) {
        try {
          const res = await api.get(ep);
          const arr = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data?.bookings)
            ? res.data.bookings
            : [];
          latest = arr.slice(0, 8);
          break;
        } catch {
          // ignore
        }
      }

      const out = {
        totalBookings:
          overview?.bookings?.total ??
          overview?.bookingsTotal ??
          overview?.totalBookings ??
          latest.length ??
          0,
        revenue:
          overview?.revenue?.raw ??
          overview?.revenue ??
          overview?.totalRevenue ??
          0,
        attention:
          overview?.bookings?.needingAttention ??
          overview?.needingAttention ??
          0,
        users:
          overview?.users?.total ??
          overview?.usersTotal ??
          overview?.totalUsers ??
          0,
        latest,
      };
      setData(out);
    } catch (e) {
      console.warn("admin dashboard load failed", e);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0b0d11] pb-16">
      {/* top bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <button
          onClick={() => nav(-1)}
          className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white text-sm font-semibold hover:bg-white/10"
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
            className="rounded-2xl bg-white/5 border border-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Open inbox
          </button>
        </div>
      </div>

      {/* heading */}
      <div className="px-6 mt-4 mb-3">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Admin control centre
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Platform health, bookings, users and admin tools at a glance.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#f5b800] to-[#ff7b1b] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-black/70 font-bold">
            TOTAL BOOKINGS
          </p>
          <p className="text-5xl font-black text-black mt-2 leading-none">
            {softNum(data.totalBookings)}
          </p>
          <p className="text-black/60 text-sm mt-3">
            All-time across the platform
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-[#00735f] to-[#008c86] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            REVENUE (RAW)
          </p>
          <p className="text-5xl font-black text-white mt-2 leading-none">
            {money(data.revenue)}
          </p>
          <p className="text-white/60 text-sm mt-3">
            From booking payloads (not settled)
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-[#b5131d] to-[#a10b38] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            ITEMS NEEDING ATTENTION
          </p>
          <p className="text-5xl font-black text-white mt-2 leading-none">
            {softNum(data.attention)}
          </p>
          <p className="text-white/70 text-sm mt-3">
            Pending / cancel / date-change
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-[#0b65c7] to-[#002e6f] px-5 py-5 shadow-lg">
          <p className="uppercase tracking-[0.25em] text-xs text-white/60 font-bold">
            USERS / HOSTS (APPROX.)
          </p>
          <p className="text-5xl font-black text-white mt-2 leading-none">
            {softNum(data.users)}
          </p>
          <p className="text-white/60 text-sm mt-3">
            From Firestore: users collection
          </p>
        </div>
      </div>

      {/* middle section */}
      <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6 px-6 mt-6">
        {/* latest bookings box */}
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
            {data.latest.length === 0 ? (
              <div className="px-5 py-6 text-sm text-white/40">
                No bookings yet.
              </div>
            ) : (
              data.latest.map((b) => (
                <div key={b.id || b._id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">
                      {b.listingTitle || b.listing || b.title || "—"}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">
                      guest: {b.guestEmail || b.guest || "—"} • ref:{" "}
                      {(b.reference || b.ref || "—").toString().slice(0, 20)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-bold">
                      {money(Number(b.amount || b.total || 0))}
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

        {/* system activity */}
        <div className="rounded-3xl bg-[#101318] border border-white/5 shadow-inner px-5 py-4 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-lg">System activity</h2>
          <p className="text-xs text-white/40 mb-1">
            What admins / hosts may need to see.
          </p>

          <button
            onClick={() => nav("/admin/bookings-admin")}
            className="rounded-2xl bg-gradient-to-r from-[#2f83ff] to-[#36c2ff] px-5 py-3 text-left text-white font-semibold hover:brightness-110"
          >
            Review booking approvals
            <div className="text-xs text-white/70">Waiting for action</div>
          </button>

          <button
            onClick={() => nav("/admin/payouts")}
            className="rounded-2xl bg-gradient-to-r from-[#00a77e] to-[#00bf8f] px-5 py-3 text-left text-white font-semibold hover:brightness-110"
          >
            Payouts &amp; settlements
            <div className="text-xs text-white/70">Track partner/host payouts</div>
          </button>

          <button
            onClick={() => nav("/admin/transactions")}
            className="rounded-2xl bg-gradient-to-r from-[#705cff] to-[#8849f6] px-5 py-3 text-left text-white font-semibold hover:brightness-110"
          >
            Transactions
            <div className="text-xs text-white/70">Full ledger, refunds, corrections</div>
          </button>

          <button
            onClick={() => nav("/admin/feature-requests")}
            className="rounded-2xl bg-gradient-to-r from-[#ff8a44] to-[#ff546a] px-5 py-3 text-left text-white font-semibold hover:brightness-110"
          >
            Feature / issue requests
            <div className="text-xs text-white/70">View feedback coming from users</div>
          </button>

          <button
            onClick={() => nav("/admin/listings")}
            className="rounded-2xl bg-gradient-to-r from-[#5657ff] to-[#8836ff] px-5 py-3 text-left text-white font-semibold hover:brightness-110"
          >
            Manage listings
            <div className="text-xs text-white/70">Approve, disable, toggle featured</div>
          </button>

          <button
            onClick={() => nav("/admin/onboarding-queue")}
            className="rounded-2xl bg-[#161a1f] px-5 py-3 text-left text-white font-semibold hover:bg-white/5"
          >
            Onboarding queue
            <div className="text-xs text-white/60">Host &amp; partner KYC / roles</div>
          </button>

          {/* bottom pills */}
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

      {loading ? (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-black/70 text-white/70 rounded-xl px-4 py-2 text-sm">
          Refreshing admin data…
        </div>
      ) : null}
    </div>
  );
}
