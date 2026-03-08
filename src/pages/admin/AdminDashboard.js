// src/pages/admin/AdminDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

/* ------------------------------ axios base (normalized) ------------------------------ */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: false,
});

// Attach Firebase ID token automatically (admin endpoints)
api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
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

const safeLower = (v) => String(v || "").toLowerCase();

function safeDateLoose(v) {
  if (!v) return null;

  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }

  if (typeof v === "object" && typeof v.seconds === "number") {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function isSuccessfulBookingStatus(status) {
  const s = safeLower(status);
  return (
    s === "confirmed" ||
    s === "paid" ||
    s === "completed" ||
    s === "paid_pending_release" ||
    s === "released"
  );
}

function isCancelledLike(status) {
  const s = safeLower(status);
  return s === "cancelled" || s === "canceled" || s === "refunded";
}

/** Normalized “needs attention” across the whole platform */
const isAttentionRow = (row = {}) => {
  const s = safeLower(row.status);

  // valid successful states should never be flagged as attention just because they are not "confirmed"
  if (isSuccessfulBookingStatus(s)) return false;

  const flags =
    !!row.paymentMismatch ||
    s === "paid-needs-review" ||
    !!row.cancelRequested ||
    !!row.cancellationRequested ||
    s === "cancel_request" ||
    s === "cancel-request" ||
    s === "refund_requested" ||
    s === "refund-requested" ||
    s === "date-change" ||
    s === "change-request";

  if (flags) return true;

  return [
    "pending",
    "hold",
    "hold-pending",
    "awaiting_payment",
    "reserved_unpaid",
    "pending_payment",
    "initialized",
    "date-change",
    "change-request",
    "cancel-request",
    "cancel_request",
    "refund_requested",
  ].includes(s);
};

// Normalise a booking document into a single shape we can render
const normaliseBooking = (docSnap) => {
  const data = docSnap?.data ? docSnap.data() : docSnap || {};
  const createdAt = safeDateLoose(
    data.createdAt || data.created_at || data.date || data.timestamp
  );

  const amount =
    Number(
      data.amountLockedN ??
        data.amountN ??
        data.totalAmount ??
        data.total ??
        data.amount ??
        0
    ) || 0;

  return {
    id: docSnap?.id || data.id,
    listingTitle:
      data.listingTitle ||
      data.listing?.title ||
      data.listing ||
      data.title ||
      data.property ||
      "—",
    guestEmail: data.email || data.guestEmail || data.guest || "—",
    status: data.status || "pending",
    amount,
    nights: Number(data.nights ?? data.night ?? 0) || 0,
    createdAt,
    reference: data.reference || data.ref || "",
    paymentMismatch: !!data.paymentMismatch,
    cancelRequested: !!data.cancelRequested,
    cancellationRequested: !!data.cancellationRequested,
  };
};

function statusChipClassFromBooking(b) {
  const s = safeLower(b?.status);

  if (isSuccessfulBookingStatus(s)) {
    return "bg-emerald-600/15 text-emerald-200 border border-emerald-500/30";
  }

  if (isCancelledLike(s)) {
    return "bg-rose-600/15 text-rose-200 border border-rose-500/30";
  }

  if (isAttentionRow(b)) {
    return "bg-amber-500/15 text-amber-200 border border-amber-400/30";
  }

  return "bg-slate-500/15 text-slate-200 border border-slate-500/30";
}

function buildDailyTrend(bookings, days = 10) {
  const map = new Map();
  const today = dayjs().startOf("day");

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = today.subtract(i, "day");
    const key = d.format("YYYY-MM-DD");
    map.set(key, {
      key,
      label: d.format("DD MMM"),
      bookings: 0,
      revenue: 0,
    });
  }

  bookings.forEach((b) => {
    if (!(b.createdAt instanceof Date)) return;
    const key = dayjs(b.createdAt).format("YYYY-MM-DD");
    if (!map.has(key)) return;
    const row = map.get(key);
    row.bookings += 1;
    row.revenue += Number(b.amount || 0);
  });

  return Array.from(map.values());
}

/* ------------------------------ small ui pieces ------------------------------ */
function TinyTrendChart({ data = [] }) {
  const width = 780;
  const height = 92;
  const padX = 18;
  const padTop = 8;
  const padBottom = 20;
  const innerH = height - padTop - padBottom;
  const maxY = Math.max(...data.map((d) => Number(d.revenue || 0)), 1);

  const points = data.map((d, idx) => {
    const x = padX + (idx * (width - padX * 2)) / Math.max(data.length - 1, 1);
    const y = padTop + innerH - (Number(d.revenue || 0) / maxY) * innerH;
    return [x, y];
  });

  const line = points.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area = [
    `M ${points[0]?.[0] || 0} ${height - padBottom}`,
    ...points.map((p) => `L ${p[0]} ${p[1]}`),
    `L ${points[points.length - 1]?.[0] || 0} ${height - padBottom}`,
    "Z",
  ].join(" ");

  return (
    <div className="h-[96px] w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="adminTrendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(38,229,213,0.42)" />
            <stop offset="100%" stopColor="rgba(38,229,213,0.02)" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((i) => {
          const y = padTop + (innerH * i) / 3;
          return (
            <line
              key={i}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}

        <path d={area} fill="url(#adminTrendGradient)" />
        <polyline
          points={line}
          fill="none"
          stroke="#23e5d5"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, idx) => {
          const x = padX + (idx * (width - padX * 2)) / Math.max(data.length - 1, 1);
          return (
            <text
              key={d.key}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Panel({ title, subtitle, rightAction, children, className = "" }) {
  return (
    <div className={`rounded-[28px] border border-white/8 bg-[#0e1218] ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-[1.02rem] font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] text-white/45">{subtitle}</p> : null}
        </div>
        {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
      </div>
      {children}
    </div>
  );
}

function KpiTile({ title, value, subtitle, tone = "dark" }) {
  const tones = {
    amber: "bg-gradient-to-r from-[#f4b900] to-[#ff970f] text-black border-transparent",
    teal: "bg-gradient-to-r from-[#0d7a6e] to-[#20d0c6] text-white border-transparent",
    rose: "bg-gradient-to-r from-[#ff2f58] to-[#ff1363] text-white border-transparent",
    blue: "bg-gradient-to-r from-[#1468d1] to-[#3090ff] text-white border-transparent",
    dark: "bg-[#10141b] text-white border-white/8",
  };

  const head = tone === "amber" ? "text-black/70" : "text-white/68";
  const sub = tone === "amber" ? "text-black/65" : "text-white/70";

  return (
    <div className={`rounded-[18px] border px-4 py-3 min-h-[94px] ${tones[tone]}`}>
      <div className={`text-[10px] font-bold uppercase tracking-[0.16em] ${head}`}>
        {title}
      </div>
      <div className="mt-1 text-[1.05rem] font-black leading-none">{value}</div>
      <div className={`mt-1 text-[11px] leading-snug ${sub}`}>{subtitle}</div>
    </div>
  );
}

function SmallMetric({ dot, title, value, subtitle }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-[#10141b] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
          {title}
        </span>
      </div>
      <div className="text-[1.02rem] font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] text-white/45">{subtitle}</div>
    </div>
  );
}

function StatusBars({ items = [] }) {
  const maxV = Math.max(...items.map((i) => Number(i.value || 0)), 1);

  return (
    <div className="grid grid-cols-5 gap-3 px-4 pb-4 pt-1">
      {items.map((item) => {
        const pct = maxV > 0 ? (Number(item.value || 0) / maxV) * 100 : 0;
        return (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className="flex h-[64px] w-full items-end justify-center rounded-[16px] bg-white/[0.03]">
              <div
                className="w-7 rounded-[12px] bg-[#3394ff] shadow-[0_8px_18px_rgba(51,148,255,0.35)]"
                style={{ height: `${Math.max(pct, item.value > 0 ? 16 : 0)}%` }}
              />
            </div>
            <div className="text-center">
              <div className="text-[11px] text-white/52">{item.label}</div>
              <div className="text-sm font-bold text-white">{softNum(item.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusSummary({ items = [], total = 0 }) {
  const colorMap = {
    Confirmed: "bg-emerald-400",
    Pending: "bg-amber-400",
    Cancelled: "bg-rose-400",
    Review: "bg-sky-400",
    Other: "bg-violet-400",
  };

  return (
    <div className="grid gap-2 px-4 pb-4">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0;
        return (
          <div key={item.label} className="rounded-[20px] border border-white/8 bg-[#0b1016] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2.5 w-2.5 rounded-full ${colorMap[item.label] || "bg-slate-400"}`} />
                <span className="truncate text-sm font-semibold text-white">{item.label}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-white/45">{pct}%</span>
                <span className="text-sm font-bold text-white">{softNum(item.value)}</span>
              </div>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/6">
              <div
                className={`h-full rounded-full ${colorMap[item.label] || "bg-slate-400"}`}
                style={{ width: `${Math.max(pct, item.value > 0 ? 6 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingsTable({ rows = [] }) {
  return (
    <div className="px-4 pb-4">
      <div className="grid max-h-[310px] overflow-y-auto rounded-[20px] border border-white/8">
        <div className="grid grid-cols-[minmax(0,1.5fr)_140px_140px] gap-4 border-b border-white/8 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">
          <div>Booking</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Status</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/40">No bookings yet.</div>
        ) : (
          rows.map((b) => {
            const s = safeLower(b.status);
            return (
              <div
                key={b.id}
                className="grid grid-cols-[minmax(0,1.5fr)_140px_140px] gap-4 border-b border-white/6 px-4 py-3 transition hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{b.listingTitle}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/42">
                    {b.guestEmail} • {String(b.reference || b.id || "—").slice(0, 26)}
                    {b.createdAt ? ` • ${dayjs(b.createdAt).format("YYYY-MM-DD HH:mm")}` : ""}
                  </p>
                </div>

                <div className="text-right text-sm font-bold text-white">{money(b.amount)}</div>

                <div className="flex justify-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusChipClassFromBooking(
                      b
                    )}`}
                  >
                    {s || "pending"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AdminCommandPanel({ nav }) {
  const groups = [
    {
      key: "bookings",
      title: "Bookings",
      links: [
        { label: "Review booking approvals", to: "/admin/bookings-admin" },
        { label: "Manage listings", to: "/admin/listings" },
        { label: "Transactions", to: "/admin/transactions" },
      ],
    },
    {
      key: "onboarding",
      title: "Onboarding queue",
      links: [
        { label: "Open onboarding queue", to: "/admin/onboarding-queue" },
        { label: "Open KYC panel", to: "/admin/kyc" },
        { label: "Payout setup verification", to: "/admin/payout-setups" },
        { label: "Payout requests & settlements", to: "/admin/payouts" },
      ],
    },
    {
      key: "platform",
      title: "Platform",
      links: [
        { label: "Feature / issue requests", to: "/admin/feature-requests" },
        { label: "Manage users", to: "/admin/manage-users" },
        { label: "Open inbox", to: "/inbox" },
      ],
    },
    {
      key: "tools",
      title: "Tools",
      links: [
        { label: "Data tools", to: "/admin/data-tools" },
        { label: "Reports & exports", to: "/admin/reports" },
        { label: "Settings", to: "/admin/settings" },
      ],
    },
  ];

  const [openKey, setOpenKey] = useState("bookings");

  return (
    <Panel title="Admin panel" subtitle="Compact command access." className="h-[310px]">
      <div className="grid gap-2 px-4 pb-3 max-h-[245px] overflow-y-auto">
        {groups.map((group) => {
          const open = openKey === group.key;
          return (
            <div key={group.key} className="overflow-hidden rounded-[20px] border border-white/8 bg-[#0b1016]">
              <button
                onClick={() => setOpenKey((prev) => (prev === group.key ? "" : group.key))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-white">{group.title}</span>
                <span className="text-lg leading-none text-white/45">{open ? "−" : "+"}</span>
              </button>

              {open && (
                <div className="grid gap-2 border-t border-white/8 px-4 py-3">
                  {group.links.map((link) => (
                    <button
                      key={link.to}
                      onClick={() => nav(link.to)}
                      className="rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/82 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------ component ------------------------------ */
export default function AdminDashboard() {
  const nav = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [serverOverview, setServerOverview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const shouldForceRefresh = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const qp = sp.get("refresh");
    const st = location.state || {};
    return qp === "1" || st?.refresh === true;
  }, [location.search, location.state]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    let overviewHasUsersCount = false;

    try {
      const res = await api.get("/admin/overview");
      const o = res?.data || null;

      setServerOverview(o);

      const apiUsersCount = Number(o?.users?.total ?? o?.users ?? NaN);

      if (Number.isFinite(apiUsersCount)) {
        setUsersCount(apiUsersCount);
        overviewHasUsersCount = true;
      } else {
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

    try {
      const bookingsRef = collection(db, "bookings");

      let snap = null;
      try {
        const qBookings = query(bookingsRef, orderBy("createdAt", "desc"), limit(200));
        snap = await getDocs(qBookings);
      } catch (e1) {
        console.warn("[AdminDashboard] bookings orderBy failed, fallback:", e1?.message || e1);
        const qBookingsNoOrder = query(bookingsRef, limit(200));
        snap = await getDocs(qBookingsNoOrder);
      }

      const loaded = (snap?.docs || []).map((d) => normaliseBooking(d));
      loaded.sort((a, b) => {
        const am = a?.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bm = b?.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bm - am;
      });

      setBookings(loaded);

      if (!overviewHasUsersCount) {
        try {
          const usersRef = collection(db, "users");
          const countSnap = await getCountFromServer(usersRef);
          const c = Number(countSnap?.data()?.count ?? 0);
          setUsersCount(Number.isFinite(c) ? c : 0);
        } catch (e2) {
          console.warn("[AdminDashboard] users count aggregation failed:", e2?.message || e2);
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!shouldForceRefresh) return;
      await load();

      if (!alive) return;
      const sp = new URLSearchParams(location.search || "");
      if (sp.get("refresh") === "1") {
        sp.delete("refresh");
        nav(
          { pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : "" },
          { replace: true, state: {} }
        );
      } else {
        nav(location.pathname, { replace: true, state: {} });
      }
    })();

    return () => {
      alive = false;
    };
  }, [shouldForceRefresh, load, location.pathname, location.search, nav]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalNights = 0;
    let needsAttention = 0;

    const statusCounts = {
      Confirmed: 0,
      Pending: 0,
      Cancelled: 0,
      Review: 0,
      Other: 0,
    };

    bookings.forEach((b) => {
      totalRevenue += Number(b.amount || 0);
      totalNights += Number(b.nights || 0);
      if (isAttentionRow(b)) needsAttention += 1;

      const s = safeLower(b.status);

      if (isSuccessfulBookingStatus(s)) {
        statusCounts.Confirmed += 1;
      } else if (
        s === "pending" ||
        s === "hold" ||
        s === "hold-pending" ||
        s === "awaiting_payment" ||
        s === "reserved_unpaid" ||
        s === "pending_payment" ||
        s === "initialized"
      ) {
        statusCounts.Pending += 1;
      } else if (isCancelledLike(s)) {
        statusCounts.Cancelled += 1;
      } else if (
        s === "paid-needs-review" ||
        s === "date-change" ||
        s === "change-request" ||
        s === "cancel-request" ||
        s === "cancel_request" ||
        s === "refund_requested" ||
        s === "refund-requested" ||
        s === "review"
      ) {
        statusCounts.Review += 1;
      } else {
        statusCounts.Other += 1;
      }
    });

    const totalBookings = bookings.length;
    const avgValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const avgNights = totalBookings > 0 ? totalNights / totalBookings : 0;
    const trend10 = buildDailyTrend(bookings, 10);
    const attentionRows = bookings.filter((b) => isAttentionRow(b)).slice(0, 8);

    return {
      totalBookings,
      totalRevenue,
      needsAttention,
      avgValue,
      avgNights,
      totalNights,
      latest: bookings.slice(0, 10),
      trend10,
      statusCounts,
      attentionRows,
    };
  }, [bookings]);

  const updatedLabel = updatedAt ? dayjs(updatedAt).format("YYYY-MM-DD HH:mm") : "";

  const statusSummaryItems = [
    { label: "Confirmed", value: stats.statusCounts.Confirmed },
    { label: "Pending", value: stats.statusCounts.Pending },
    { label: "Cancelled", value: stats.statusCounts.Cancelled },
    { label: "Review", value: stats.statusCounts.Review },
    { label: "Other", value: stats.statusCounts.Other },
  ];

  const statusBarItems = [
    { label: "OK", value: stats.statusCounts.Confirmed },
    { label: "Pend", value: stats.statusCounts.Pending },
    { label: "Cancel", value: stats.statusCounts.Cancelled },
    { label: "Review", value: stats.statusCounts.Review },
    { label: "Other", value: stats.statusCounts.Other },
  ];

  const attentionIsEmpty = stats.attentionRows.length === 0;

  return (
    <div className="min-h-screen bg-[#090d12] pb-14 text-white">
      <div className="mx-auto max-w-[1600px] px-6 pt-[calc(var(--topbar-h)+14px)]">
        {/* top utility row */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {updatedLabel ? (
            <div className="text-sm text-white/85">Last updated: {updatedLabel}</div>
          ) : null}

          <button
            onClick={() => nav(-1)}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            ← Back
          </button>

          <button
            onClick={load}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            onClick={() => nav("/admin/bookings-admin")}
            className="rounded-full bg-[#f5c000] px-6 py-2.5 text-sm font-bold text-black shadow-[0_10px_24px_rgba(245,192,0,0.18)] transition hover:brightness-105"
          >
            View bookings
          </button>

          <button
            onClick={() => nav("/inbox")}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Open inbox
          </button>
        </div>

        {/* heading */}
        <div className="mb-3">
          <h1 className="text-[2rem] font-black tracking-tight">Admin control centre</h1>
          <p className="mt-1 text-sm text-white/50">
            Platform health, bookings, users and admin tools at a glance.
          </p>
        </div>

        {/* top dashboard row */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_0.95fr_0.95fr]">
          <Panel
            title="Revenue trend"
            subtitle="10-day booking value movement."
            rightAction={
              <button
                onClick={() => nav("/admin/bookings-admin")}
                className="text-xs text-white/45 transition hover:text-white"
              >
                View all →
              </button>
            }
            className="h-[310px]"
          >
            <div className="px-4 pb-3">
              <TinyTrendChart data={stats.trend10} />
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3 h-[310px]">
            <KpiTile
              title="Revenue"
              value={shortMoney(stats.totalRevenue)}
              subtitle="Raw booking value"
              tone="teal"
            />
            <KpiTile
              title="Attention"
              value={softNum(stats.needsAttention)}
              subtitle="Needs admin check"
              tone="rose"
            />
            <KpiTile
              title="Users"
              value={softNum(usersCount)}
              subtitle={
                serverOverview
                  ? "API overview + Firestore fallback"
                  : "Fallback: Firestore users count"
              }
              tone="blue"
            />
            <KpiTile
              title="Bookings"
              value={softNum(stats.totalBookings)}
              subtitle="All-time"
              tone="amber"
            />
            <KpiTile
              title="Avg value"
              value={shortMoney(stats.avgValue)}
              subtitle="Per booking"
              tone="dark"
            />
            <KpiTile
              title="Avg nights"
              value={Number(stats.avgNights || 0).toFixed(1)}
              subtitle="Per booking"
              tone="dark"
            />
          </div>

          <AdminCommandPanel nav={nav} />
        </div>

        {/* middle row */}
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.28fr_0.92fr_0.8fr]">
          <Panel
            title="Latest bookings"
            subtitle="Recent platform transactions."
            rightAction={
              <button
                onClick={() => nav("/admin/bookings-admin")}
                className="text-xs text-white/45 transition hover:text-white"
              >
                View all →
              </button>
            }
            className="min-h-[410px]"
          >
            <BookingsTable rows={stats.latest} />
          </Panel>

          <Panel
            title="Attention queue"
            subtitle="Bookings needing review."
            className={attentionIsEmpty ? "min-h-[150px]" : "min-h-[410px]"}
          >
            <div className="px-4 pb-4">
              <div className={`grid gap-2 ${attentionIsEmpty ? "" : "max-h-[310px] overflow-y-auto"}`}>
                {attentionIsEmpty ? (
                  <div className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-5 text-sm text-white/45">
                    No immediate anomalies detected.
                  </div>
                ) : (
                  stats.attentionRows.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-[20px] border border-amber-300/12 bg-[#0b1016] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{b.listingTitle}</p>
                          <p className="truncate text-[11px] text-white/45">{b.guestEmail}</p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusChipClassFromBooking(
                            b
                          )}`}
                        >
                          {safeLower(b.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 content-start">
            <Panel title="Booking mix" subtitle="Compact status bars.">
              <StatusBars items={statusBarItems} />
            </Panel>

            <Panel title="Status summary" subtitle="Operational distribution.">
              <StatusSummary items={statusSummaryItems} total={stats.totalBookings} />
            </Panel>
          </div>
        </div>

        {/* bottom strip */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SmallMetric
            dot="bg-emerald-400"
            title="Confirmed"
            value={softNum(stats.statusCounts.Confirmed)}
            subtitle="Paid / pending release / released"
          />
          <SmallMetric
            dot="bg-amber-400"
            title="Pending"
            value={softNum(stats.statusCounts.Pending)}
            subtitle="Awaiting action / payment"
          />
          <SmallMetric
            dot="bg-violet-400"
            title="Total nights"
            value={softNum(stats.totalNights)}
            subtitle="Captured across bookings"
          />
          <SmallMetric
            dot="bg-rose-400"
            title="Review"
            value={softNum(stats.statusCounts.Review)}
            subtitle="Needs admin validation"
          />
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-sm text-white/70">
          Refreshing admin data…
        </div>
      )}

      {error && !loading && (
        <div className="fixed bottom-5 left-1/2 max-w-md -translate-x-1/2 rounded-xl bg-rose-700/90 px-4 py-2 text-center text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}