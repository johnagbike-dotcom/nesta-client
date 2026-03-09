// src/pages/admin/AdminDashboard.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";

/* ─────────────────────────────── axios ─────────────────────────────── */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({ baseURL: API_BASE, timeout: 20000, withCredentials: false });

api.interceptors.request.use(async (cfg) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

/* ─────────────────────────────── helpers ─────────────────────────────── */
const money  = (n) => Number(n||0).toLocaleString("en-NG",{ style:"currency", currency:"NGN", maximumFractionDigits:0 });
const shortMoney = (n) => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  if (!Number.isFinite(num)) return "₦0";
  if (abs >= 1e9) return `₦${(num/1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `₦${(num/1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `₦${(num/1e3).toFixed(1)}k`;
  return `₦${num.toLocaleString("en-NG")}`;
};
const softNum = (n) => { const num = Number(n||0); return Number.isFinite(num) ? num.toLocaleString("en-NG") : "0"; };
const safeLower = (v) => String(v || "").toLowerCase();

function safeDateLoose(v) {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") { try { return v.toDate(); } catch { return null; } }
  if (typeof v === "object" && typeof v.seconds === "number") {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    const d = new Date(ms); return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

/* ── Status classifiers ── */
function isSuccessfulBookingStatus(status) {
  const s = safeLower(status);
  return ["confirmed","paid","completed","paid_pending_release","released","checked_in"].includes(s);
}
function isCancelledLike(status) {
  const s = safeLower(status);
  return ["cancelled","canceled","refunded"].includes(s);
}

/**
 * isRealRevenue — only count bookings that represent real confirmed payment.
 * Excludes: pending, initialized, awaiting_payment, reserved_unpaid, failed, archived.
 */
function isRealRevenue(b) {
  if (b?.archived) return false;
  return isSuccessfulBookingStatus(b?.status);
}

const isAttentionRow = (row = {}) => {
  if (row?.archived) return false;
  const s = safeLower(row.status);
  if (isSuccessfulBookingStatus(s)) return false;
  if (isCancelledLike(s)) return false;
  const flags =
    !!row.paymentMismatch ||
    s === "paid-needs-review" ||
    !!row.cancelRequested ||
    !!row.cancellationRequested ||
    ["cancel_request","cancel-request","refund_requested","refund-requested","date-change","change-request"].includes(s);
  if (flags) return true;
  // Only flag genuinely stuck states, not bare "pending" (which is just pre-payment)
  return ["hold","hold-pending","date-change","change-request","cancel-request","cancel_request","refund_requested"].includes(s);
};

const normaliseBooking = (docSnap) => {
  const data = docSnap?.data ? docSnap.data() : docSnap || {};
  const createdAt = safeDateLoose(data.createdAt || data.created_at || data.date || data.timestamp);
  const amount = Number(data.amountLockedN ?? data.amountN ?? data.totalAmount ?? data.total ?? data.amount ?? 0) || 0;
  return {
    id: docSnap?.id || data.id,
    listingTitle: data.listingTitle || data.listing?.title || data.listing || data.title || data.property || "—",
    guestEmail: data.email || data.guestEmail || data.guest || "—",
    status: data.status || "pending",
    amount,
    nights: Number(data.nights ?? data.night ?? 0) || 0,
    createdAt,
    reference: data.reference || data.ref || "",
    paymentMismatch: !!data.paymentMismatch,
    cancelRequested: !!data.cancelRequested,
    cancellationRequested: !!data.cancellationRequested,
    archived: !!data.archived,
  };
};

function statusChipClass(b) {
  const s = safeLower(b?.status);
  if (isSuccessfulBookingStatus(s)) return "bg-emerald-600/15 text-emerald-300 border border-emerald-500/25";
  if (isCancelledLike(s))           return "bg-rose-600/15 text-rose-300 border border-rose-500/25";
  if (isAttentionRow(b))            return "bg-amber-500/15 text-amber-300 border border-amber-400/25";
  return "bg-slate-500/15 text-slate-300 border border-slate-500/25";
}

function buildDailyTrend(bookings, days = 10) {
  const map = new Map();
  const today = dayjs().startOf("day");
  for (let i = days - 1; i >= 0; i--) {
    const d = today.subtract(i, "day");
    const key = d.format("YYYY-MM-DD");
    map.set(key, { key, label: d.format("DD MMM"), bookings: 0, revenue: 0 });
  }
  bookings.forEach((b) => {
    if (!isRealRevenue(b)) return;
    if (!(b.createdAt instanceof Date)) return;
    const key = dayjs(b.createdAt).format("YYYY-MM-DD");
    if (!map.has(key)) return;
    const row = map.get(key);
    row.bookings += 1;
    row.revenue += Number(b.amount || 0);
  });
  return Array.from(map.values());
}

/* ─────────────────────────────── nav config ─────────────────────────────── */
const NAV_GROUPS = [
  {
    key: "bookings",
    label: "Bookings",
    icon: "◈",
    links: [
      { label: "Booking records",      to: "/admin/bookings-admin" },
      { label: "Transactions",         to: "/admin/transactions" },
      { label: "Manage listings",      to: "/admin/listings" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: "◎",
    links: [
      { label: "Payouts",              to: "/admin/payouts" },
      { label: "Payout setups",        to: "/admin/payout-setups" },
      { label: "Reports & exports",    to: "/admin/reports" },
    ],
  },
  {
    key: "people",
    label: "People",
    icon: "◉",
    links: [
      { label: "Manage users",         to: "/admin/manage-users" },
      { label: "KYC review",           to: "/admin/kyc" },
      { label: "Onboarding queue",     to: "/admin/onboarding-queue" },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    icon: "⬡",
    links: [
      { label: "Feature requests",     to: "/admin/feature-requests" },
      { label: "Data tools",           to: "/admin/data-tools" },
      { label: "Settings",             to: "/admin/settings" },
    ],
  },
];

/* ─────────────────────────────── ui components ─────────────────────────────── */

/** Horizontal nav bar with dropdown groups */
function AdminNav({ nav }) {
  const [open, setOpen] = useState(null);
  const barRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav
      ref={barRef}
      className="relative z-50 flex items-center gap-1 rounded-2xl border border-white/8 bg-[#0e1218] px-3 py-2"
    >
      {/* Brand mark */}
      <span className="mr-3 select-none text-[11px] font-black tracking-[0.22em] text-white/30 uppercase">
        Nesta Admin
      </span>

      {NAV_GROUPS.map((group) => {
        const isOpen = open === group.key;
        return (
          <div key={group.key} className="relative">
            <button
              onClick={() => setOpen(isOpen ? null : group.key)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-150
                ${isOpen
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/6 hover:text-white/90"
                }`}
            >
              <span className="text-[10px] opacity-60">{group.icon}</span>
              {group.label}
              <svg
                className={`ml-0.5 h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                viewBox="0 0 12 12" fill="none"
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f15] shadow-[0_24px_64px_rgba(0,0,0,0.55)] animate-in">
                <div className="p-1.5">
                  {group.links.map((link) => (
                    <button
                      key={link.to}
                      onClick={() => { nav(link.to); setOpen(null); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
                    >
                      <span className="h-1 w-1 rounded-full bg-white/20" />
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Utility actions pushed to the right */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => nav("/inbox")}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-white/45 transition hover:bg-white/6 hover:text-white/80"
        >
          Inbox
        </button>
        <button
          onClick={() => nav("/")}
          className="rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 text-[13px] font-semibold text-white/45 transition hover:bg-white/8 hover:text-white/80"
        >
          ← Site
        </button>
      </div>
    </nav>
  );
}

function Panel({ title, subtitle, rightAction, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-[#0e1218] ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 py-3.5">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-white/40">{subtitle}</p>}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      {children}
    </div>
  );
}

function KpiTile({ title, value, subtitle, tone = "dark" }) {
  const tones = {
    amber: "bg-gradient-to-br from-[#f4b900] to-[#ff970f] text-black border-transparent",
    teal:  "bg-gradient-to-br from-[#0d7a6e] to-[#20d0c6] text-white border-transparent",
    rose:  "bg-gradient-to-br from-[#c0182e] to-[#ff2f58] text-white border-transparent",
    blue:  "bg-gradient-to-br from-[#1468d1] to-[#3090ff] text-white border-transparent",
    dark:  "bg-[#10141b] text-white border-white/8",
  };
  const headCls = tone === "amber" ? "text-black/65" : "text-white/55";
  const subCls  = tone === "amber" ? "text-black/60" : "text-white/60";
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${tones[tone]}`}>
      <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${headCls}`}>{title}</div>
      <div className="mt-1.5 text-xl font-black leading-none">{value}</div>
      <div className={`mt-1 text-[11px] leading-snug ${subCls}`}>{subtitle}</div>
    </div>
  );
}

function SmallMetric({ dot, title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#10141b] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{title}</span>
      </div>
      <div className="text-lg font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] text-white/38">{subtitle}</div>
    </div>
  );
}

function StatusBars({ items = [] }) {
  const maxV = Math.max(...items.map((i) => Number(i.value || 0)), 1);
  return (
    <div className="grid grid-cols-5 gap-2 px-5 pb-4 pt-1">
      {items.map((item) => {
        const pct = maxV > 0 ? (Number(item.value || 0) / maxV) * 100 : 0;
        return (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className="flex h-[56px] w-full items-end justify-center rounded-xl bg-white/[0.03]">
              <div
                className="w-6 rounded-lg bg-[#3394ff] shadow-[0_6px_14px_rgba(51,148,255,0.3)]"
                style={{ height: `${Math.max(pct, item.value > 0 ? 16 : 0)}%` }}
              />
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/42">{item.label}</div>
              <div className="text-[13px] font-bold text-white">{softNum(item.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusSummary({ items = [], total = 0 }) {
  const colorMap = {
    Confirmed: "bg-emerald-400", Pending: "bg-amber-400",
    Cancelled: "bg-rose-400",   Review: "bg-sky-400", Other: "bg-violet-400",
  };
  return (
    <div className="grid gap-1.5 px-5 pb-4">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0;
        return (
          <div key={item.label} className="rounded-xl border border-white/6 bg-[#0b1016] px-4 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 rounded-full ${colorMap[item.label] || "bg-slate-400"}`} />
                <span className="truncate text-[13px] font-semibold text-white">{item.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-white/38">{pct}%</span>
                <span className="text-[13px] font-bold text-white">{softNum(item.value)}</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${colorMap[item.label] || "bg-slate-400"}`}
                style={{ width: `${Math.max(pct, item.value > 0 ? 5 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingsTable({ rows = [], nav }) {
  return (
    <div className="px-5 pb-4">
      <div className="overflow-hidden rounded-xl border border-white/8">
        <div className="grid grid-cols-[minmax(0,1.6fr)_120px_110px] border-b border-white/8 bg-white/[0.02] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
          <div>Booking</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Status</div>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/35">No bookings yet.</div>
          ) : (
            rows.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[minmax(0,1.6fr)_120px_110px] border-b border-white/5 px-4 py-2.5 transition hover:bg-white/[0.02] cursor-pointer"
                onClick={() => nav("/admin/bookings-admin")}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">{b.listingTitle}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/38">
                    {b.guestEmail}
                    {b.createdAt ? ` · ${dayjs(b.createdAt).format("DD MMM HH:mm")}` : ""}
                  </p>
                </div>
                <div className="text-right text-[13px] font-bold text-white self-center">{money(b.amount)}</div>
                <div className="flex justify-end self-center">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusChipClass(b)}`}>
                    {safeLower(b.status) || "pending"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Sparkline trend chart — only real revenue */
function TinyTrendChart({ data = [] }) {
  const W = 760; const H = 80; const pX = 16; const pTop = 6; const pBot = 18;
  const innerH = H - pTop - pBot;
  const maxY = Math.max(...data.map((d) => Number(d.revenue || 0)), 1);
  const points = data.map((d, idx) => {
    const x = pX + (idx * (W - pX * 2)) / Math.max(data.length - 1, 1);
    const y = pTop + innerH - (Number(d.revenue || 0) / maxY) * innerH;
    return [x, y];
  });
  const line = points.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area = [
    `M ${points[0]?.[0] || 0} ${H - pBot}`,
    ...points.map((p) => `L ${p[0]} ${p[1]}`),
    `L ${points[points.length - 1]?.[0] || 0} ${H - pBot}`,
    "Z",
  ].join(" ");
  return (
    <div className="h-[84px] w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(38,229,213,0.38)" />
            <stop offset="100%" stopColor="rgba(38,229,213,0.01)" />
          </linearGradient>
        </defs>
        {[0,1,2,3].map((i) => {
          const y = pTop + (innerH * i) / 3;
          return <line key={i} x1={pX} x2={W-pX} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>;
        })}
        <path d={area} fill="url(#trendGrad)" />
        <polyline points={line} fill="none" stroke="#23e5d5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {data.map((d, idx) => {
          const x = pX + (idx * (W - pX * 2)) / Math.max(data.length - 1, 1);
          return (
            <text key={d.key} x={x} y={H-3} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.38)">{d.label}</text>
          );
        })}
      </svg>
    </div>
  );
}

/** Attention queue — excludes bare pending/unpaid carryovers */
function AttentionQueue({ rows = [] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 pb-4">
        <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-5 text-[13px] text-white/38">
          No anomalies detected.
        </div>
      </div>
    );
  }
  return (
    <div className="px-5 pb-4">
      <div className="grid max-h-[260px] gap-1.5 overflow-y-auto">
        {rows.map((b) => (
          <div key={b.id} className="rounded-xl border border-amber-400/10 bg-[#0d1118] px-4 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">{b.listingTitle}</p>
                <p className="truncate text-[11px] text-white/40">{b.guestEmail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusChipClass(b)}`}>
                {safeLower(b.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── main component ─────────────────────────────── */
export default function AdminDashboard() {
  const nav = useNavigate();
  const location = useLocation();

  const [bookings, setBookings]       = useState([]);
  const [usersCount, setUsersCount]   = useState(0);
  const [serverOverview, setServerOverview] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [updatedAt, setUpdatedAt]     = useState(null);

  const shouldForceRefresh = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    return sp.get("refresh") === "1" || (location.state || {})?.refresh === true;
  }, [location.search, location.state]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let overviewHasUsers = false;

    try {
      const res = await api.get("/admin/overview");
      const o = res?.data || null;
      setServerOverview(o);
      const apiCount = Number(o?.users?.total ?? o?.users ?? NaN);
      if (Number.isFinite(apiCount)) { setUsersCount(apiCount); overviewHasUsers = true; }
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      console.warn("[AdminDashboard] /admin/overview failed:", e?.message);
      setServerOverview(null);
      setError("Admin overview temporarily unavailable — showing Firestore fallback.");
      overviewHasUsers = false;
    }

    try {
      const bookingsRef = collection(db, "bookings");
      let snap = null;
      try {
        snap = await getDocs(query(bookingsRef, orderBy("createdAt", "desc"), limit(200)));
      } catch {
        snap = await getDocs(query(bookingsRef, limit(200)));
      }
      const loaded = (snap?.docs || []).map((d) => normaliseBooking(d));
      loaded.sort((a, b) => {
        const am = a?.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bm = b?.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bm - am;
      });
      setBookings(loaded);

      if (!overviewHasUsers) {
        try {
          const usersRef = collection(db, "users");
          const countSnap = await getCountFromServer(usersRef);
          const c = Number(countSnap?.data()?.count ?? 0);
          setUsersCount(Number.isFinite(c) ? c : 0);
        } catch (e2) {
          console.warn("[AdminDashboard] users count failed:", e2?.message);
        }
      }
      setUpdatedAt((prev) => prev || new Date().toISOString());
    } catch (e) {
      console.error("[AdminDashboard] Firestore failed:", e?.message);
      setBookings([]);
      setError((prev) => prev || "Could not load admin stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!shouldForceRefresh) return;
      await load();
      if (!alive) return;
      const sp = new URLSearchParams(location.search || "");
      if (sp.get("refresh") === "1") {
        sp.delete("refresh");
        nav({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : "" }, { replace: true, state: {} });
      } else {
        nav(location.pathname, { replace: true, state: {} });
      }
    })();
    return () => { alive = false; };
  }, [shouldForceRefresh, load, location.pathname, location.search, nav]);

  /* ── stats — only real revenue, exclude archived/unpaid ── */
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalNights  = 0;
    let needsAttention = 0;

    const statusCounts = { Confirmed: 0, Pending: 0, Cancelled: 0, Review: 0, Other: 0 };

    bookings.forEach((b) => {
      if (b.archived) return; // never count archived rows in any stat

      if (isRealRevenue(b)) {
        totalRevenue += Number(b.amount || 0);
        totalNights  += Number(b.nights || 0);
      }
      if (isAttentionRow(b)) needsAttention += 1;

      const s = safeLower(b.status);
      if (isSuccessfulBookingStatus(s))      statusCounts.Confirmed += 1;
      else if (["pending","hold","hold-pending","awaiting_payment","reserved_unpaid","pending_payment","initialized"].includes(s)) statusCounts.Pending += 1;
      else if (isCancelledLike(s))           statusCounts.Cancelled += 1;
      else if (["paid-needs-review","date-change","change-request","cancel-request","cancel_request","refund_requested","refund-requested","review"].includes(s)) statusCounts.Review += 1;
      else statusCounts.Other += 1;
    });

    // "latest" only shows real bookings (paid/confirmed) — not pre-payment noise
    const latest = bookings.filter((b) => !b.archived && isRealRevenue(b)).slice(0, 10);

    const realCount   = bookings.filter((b) => !b.archived && isRealRevenue(b)).length;
    const totalBookings = bookings.filter((b) => !b.archived).length;
    const avgValue    = realCount > 0 ? totalRevenue / realCount : 0;
    const avgNights   = realCount > 0 ? totalNights  / realCount : 0;
    const trend10     = buildDailyTrend(bookings, 10);
    const attentionRows = bookings.filter((b) => !b.archived && isAttentionRow(b)).slice(0, 8);

    return { totalBookings, realCount, totalRevenue, needsAttention, avgValue, avgNights, totalNights, latest, trend10, statusCounts, attentionRows };
  }, [bookings]);

  const updatedLabel = updatedAt ? dayjs(updatedAt).format("DD MMM YYYY, HH:mm") : "";

  /* ── layout ── */
  return (
    <div className="min-h-screen bg-[#090d12] pb-14 text-white">
      <div className="mx-auto max-w-[1400px] px-5 pt-[calc(var(--topbar-h,0px)+18px)]">

        {/* ── Top nav bar ── */}
        <AdminNav nav={nav} />

        {/* ── Page header ── */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Control centre</h1>
            <p className="mt-0.5 text-[12px] text-white/38">
              Platform health at a glance
              {updatedLabel ? ` · Last updated ${updatedLabel}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-white/8 bg-white/4 px-4 py-2 text-[13px] font-semibold text-white/60 transition hover:bg-white/8 hover:text-white disabled:opacity-40"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={() => nav("/admin/bookings-admin")}
              className="rounded-xl bg-[#f5c000] px-5 py-2 text-[13px] font-bold text-black shadow-[0_8px_20px_rgba(245,192,0,0.2)] transition hover:brightness-105"
            >
              View bookings
            </button>
          </div>
        </div>

        {/* ── KPI row ── 6 tiles, responsive */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile title="Revenue"    value={shortMoney(stats.totalRevenue)} subtitle="Confirmed only"  tone="teal"  />
          <KpiTile title="Bookings"   value={softNum(stats.realCount)}       subtitle="Paid / confirmed" tone="amber" />
          <KpiTile title="Attention"  value={softNum(stats.needsAttention)}  subtitle="Needs review"    tone="rose"  />
          <KpiTile title="Users"      value={softNum(usersCount)}            subtitle={serverOverview ? "Live" : "Firestore"} tone="blue" />
          <KpiTile title="Avg value"  value={shortMoney(stats.avgValue)}     subtitle="Per booking"     tone="dark"  />
          <KpiTile title="Avg nights" value={Number(stats.avgNights||0).toFixed(1)} subtitle="Per booking" tone="dark" />
        </div>

        {/* ── Main content: 3 columns on large, stack on laptop ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_0.85fr]">

          {/* Col 1 — trend + latest bookings */}
          <div className="flex flex-col gap-4">
            <Panel
              title="Revenue trend"
              subtitle="10-day confirmed booking value"
              rightAction={
                <button onClick={() => nav("/admin/bookings-admin")} className="text-[11px] text-white/35 transition hover:text-white">View all →</button>
              }
            >
              <div className="px-5 pb-4">
                <TinyTrendChart data={stats.trend10} />
              </div>
            </Panel>

            <Panel
              title="Latest bookings"
              subtitle="Confirmed & paid only"
              rightAction={
                <button onClick={() => nav("/admin/bookings-admin")} className="text-[11px] text-white/35 transition hover:text-white">View all →</button>
              }
            >
              <BookingsTable rows={stats.latest} nav={nav} />
            </Panel>
          </div>

          {/* Col 2 — attention queue + status mix */}
          <div className="flex flex-col gap-4">
            <Panel title="Attention queue" subtitle="Stuck or flagged bookings">
              <AttentionQueue rows={stats.attentionRows} />
            </Panel>

            <Panel title="Booking mix" subtitle="Status distribution">
              <StatusBars items={[
                { label: "OK",     value: stats.statusCounts.Confirmed },
                { label: "Pend",   value: stats.statusCounts.Pending },
                { label: "Cancel", value: stats.statusCounts.Cancelled },
                { label: "Review", value: stats.statusCounts.Review },
                { label: "Other",  value: stats.statusCounts.Other },
              ]} />
            </Panel>
          </div>

          {/* Col 3 — status summary + bottom metrics */}
          <div className="flex flex-col gap-4">
            <Panel title="Status summary" subtitle="Operational breakdown">
              <StatusSummary
                items={[
                  { label: "Confirmed", value: stats.statusCounts.Confirmed },
                  { label: "Pending",   value: stats.statusCounts.Pending },
                  { label: "Cancelled", value: stats.statusCounts.Cancelled },
                  { label: "Review",    value: stats.statusCounts.Review },
                  { label: "Other",     value: stats.statusCounts.Other },
                ]}
                total={stats.totalBookings}
              />
            </Panel>

            {/* Bottom micro-metrics */}
            <div className="grid grid-cols-2 gap-2">
              <SmallMetric dot="bg-emerald-400" title="Confirmed" value={softNum(stats.statusCounts.Confirmed)} subtitle="Paid / released" />
              <SmallMetric dot="bg-amber-400"   title="Pending"   value={softNum(stats.statusCounts.Pending)}   subtitle="Pre-payment" />
              <SmallMetric dot="bg-violet-400"  title="Nights"    value={softNum(stats.totalNights)}            subtitle="All-time" />
              <SmallMetric dot="bg-rose-400"    title="Review"    value={softNum(stats.statusCounts.Review)}    subtitle="Needs action" />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-10 text-center text-[11px] text-white/28">
          © {new Date().getFullYear()} Nesta · Admin
        </footer>
      </div>

      {/* Toast overlays */}
      {loading && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-[13px] text-white/65">
          Refreshing…
        </div>
      )}
      {error && !loading && (
        <div className="fixed bottom-5 left-1/2 max-w-sm -translate-x-1/2 rounded-xl bg-rose-700/90 px-4 py-2 text-center text-[13px] text-white">
          {error}
        </div>
      )}
    </div>
  );
}