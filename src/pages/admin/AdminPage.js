// src/pages/admin/AdminPage.js
import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getAuth } from "firebase/auth";

api.interceptors.request.use(async (config) => {
  const u = getAuth().currentUser;
  if (u) {
    const token = await u.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  withCredentials: false,
  timeout: 15000,
});

/* ------------------------------ small UI bits ------------------------------ */
function Tile({ title, subtitle, children, badge }) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      style={{ minHeight: 152, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-white text-lg">{title}</h3>
          {badge ? (
            <span
              className="text-[12px] font-extrabold px-3 py-1 rounded-full border"
              style={{
                borderColor: "rgba(245,158,11,.35)",
                background: "rgba(245,158,11,.20)",
                color: "#fde68a",
                whiteSpace: "nowrap",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-white/70 text-[13px] mt-1">{subtitle}</p> : null}
      </div>
      <div className="pt-3">{children}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="text-xl font-extrabold text-white mt-0.5">{value}</div>
    </div>
  );
}

/* --------------------------------- page --------------------------------- */
export default function AdminPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    listings: 0,
    transactions: { total: 0, confirmed: 0, refunded: 0, cancelled: 0 },
    kycPending: 0,
    featureRequests: { total: 0, pending: 0, planned: 0, shipped: 0, rejected: 0 },
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/overview");
        // Expected response shape (example):
        // {
        //   users, listings,
        //   transactions: { total, confirmed, refunded, cancelled },
        //   kycPending,
        //   featureRequests: { total, pending, planned, shipped, rejected }
        // }
        if (alive && res?.data) {
          setStats({
            users: Number(res.data.users || 0),
            listings: Number(res.data.listings || 0),
            transactions: {
              total: Number(res.data?.transactions?.total || 0),
              confirmed: Number(res.data?.transactions?.confirmed || 0),
              refunded: Number(res.data?.transactions?.refunded || 0),
              cancelled: Number(res.data?.transactions?.cancelled || 0),
            },
            kycPending: Number(res.data.kycPending || 0),
            featureRequests: {
              total: Number(res.data?.featureRequests?.total || 0),
              pending: Number(res.data?.featureRequests?.pending || 0),
              planned: Number(res.data?.featureRequests?.planned || 0),
              shipped: Number(res.data?.featureRequests?.shipped || 0),
              rejected: Number(res.data?.featureRequests?.rejected || 0),
            },
          });
        }
      } catch (e) {
        console.error("Overview load failed:", e);
        // Keep zeros; page still renders fine
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const txBadge = useMemo(() => {
    const chips = [];
    if (stats.transactions.confirmed) chips.push(`${stats.transactions.confirmed} confirmed`);
    if (stats.transactions.refunded) chips.push(`${stats.transactions.refunded} refunded`);
    if (stats.transactions.cancelled) chips.push(`${stats.transactions.cancelled} cancelled`);
    return chips.join(" · ");
  }, [stats.transactions]);

  return (
    <main className="container mx-auto px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <button
          className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          onClick={() => nav(-1)}
        >
          ← Back
        </button>
        <button
          className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          onClick={() => nav("/")}
        >
          → Back to site
        </button>
      </div>

      <div className="mt-3">
        <h1 className="text-2xl md:text-3xl font-extrabold">Admin Dashboard</h1>
        <p className="text-white/70 text-[13px]">Overview & quick links</p>
      </div>

      {/* Top metrics row */}
      <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-4">
        <StatCard label="Users" value={stats.users.toLocaleString()} />
        <StatCard label="Listings" value={stats.listings.toLocaleString()} />
        <StatCard label="Transactions" value={stats.transactions.total.toLocaleString()} />
        <StatCard label="KYC pending" value={stats.kycPending.toLocaleString()} />
      </div>

      {/* Tiles grid */}
      <div className="mt-5 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Tile title="Manage Users" subtitle="Assign roles (host, partner), disable users, view directory.">
          <Link to="/admin/manage-users" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Manage Listings" subtitle="Approve/disable, toggle featured, and review inventory quality.">
          <Link to="/admin/manage-listings" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Transactions" subtitle="Confirm, cancel, or refund bookings; export if needed." badge={txBadge}>
          <Link to="/admin/transactions" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="KYC Reviews" subtitle="Verify identities; approve or reject with notes.">
          <Link to="/admin/kyc" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Bookings Admin" subtitle="Raw booking records and CSV export.">
          <Link to="/admin/bookings" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Payouts" subtitle="Track partner/host payouts and settlement status.">
          <Link to="/admin/payouts" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Reports & Exports" subtitle="CSV exports, summaries, and audit trails.">
          <Link to="/admin/reports" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>

        <Tile title="Settings" subtitle="Brand toggles, payment keys, maintenance mode.">
          <Link to="/admin/settings" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>
        {/* Feature Requests */}
<div className="admin-card">
  <div className="admin-card-icon">
    💡
  </div>
  <div className="admin-card-body">
    <h3>Feature Requests</h3>
    <p>Track and prioritize new product ideas from users.</p>
    <p style={{ marginTop: "0.5rem", color: "#FFD74A", fontWeight: "700" }}>
      {stats?.featureRequests?.pending || 0} pending
    </p>
    <Link to="/admin/feature-requests" className="admin-card-link">
      Open →
    </Link>
  </div>
</div>

        {/* ⭐ NEW: Feature Requests tile */}
        <Tile
          title="Feature Requests"
          subtitle="Track and prioritize product ideas."
          badge={`${stats?.featureRequests?.pending || 0} pending`}
        >
          <Link to="/admin/feature-requests" className="text-yellow-300 font-bold">Open →</Link>
        </Tile>
      </div>

      {loading ? <p className="text-white/60 mt-4">Loading latest stats…</p> : null}

      <footer className="mt-10 text-center text-white/50 text-xs">
        © {new Date().getFullYear()} Nesta. All rights reserved. Terms · Privacy · Help
      </footer>
    </main>
  );
}
