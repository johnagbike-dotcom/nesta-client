// src/pages/HostDashboard.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import axios from "axios";
import { getAuth } from "firebase/auth";

import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import VerifiedRoleBadge from "../components/VerifiedRoleBadge";
import SubscriptionBanner from "../components/SubscriptionBanner";
import { useToast } from "../context/ToastContext";

/* ===================== Format helpers ===================== */
const nf = new Intl.NumberFormat("en-NG");
const ngn = (n) => `₦${nf.format(Math.round(Number(n || 0)))}`;

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function safeUpper(v) {
  return String(v || "").toUpperCase();
}

function formatDateTime(v) {
  if (!v) return "—";
  try {
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : typeof v?.seconds === "number"
        ? new Date(v.seconds * 1000)
        : v instanceof Date
        ? v
        : new Date(v);

    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function toMillis(ts) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).getTime();
    const d = ts instanceof Date ? ts : new Date(ts);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function isPaidOrConfirmed(status) {
  const s = safeLower(status);
  return (
    s === "paid" ||
    s === "confirmed" ||
    s === "completed" ||
    s === "paid_pending_release" ||
    s === "checked_in" ||
    s === "released"
  );
}

function isPendingLike(status) {
  const s = safeLower(status);
  return (
    s === "pending" ||
    s === "awaiting" ||
    s === "hold" ||
    s === "reserved_unpaid" ||
    s === "initialized" ||
    s === "awaiting_payment" ||
    s === "pending_payment"
  );
}

function isCancelledLike(status) {
  const s = safeLower(status);
  return s === "cancelled" || s === "canceled";
}

function isRefundedLike(status) {
  const s = safeLower(status);
  return s === "refunded" || s === "refund";
}

const sleep = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/* ===================== API (normalized base) ===================== */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(
  /\/+$/,
  ""
);
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const u = getAuth().currentUser;
  if (u) {
    const token = await u.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ===================== UI bits ===================== */

function StatCard({ label, value, sub, tone = "default", icon }) {
  const border =
    tone === "gold"   ? "border-amber-400/25"
    : tone === "emerald" ? "border-emerald-400/25"
    : tone === "rose"    ? "border-rose-400/25"
    : "border-white/8";
  const glow =
    tone === "gold"   ? "shadow-[0_0_40px_rgba(251,191,36,0.06)]"
    : tone === "emerald" ? "shadow-[0_0_40px_rgba(52,211,153,0.06)]"
    : tone === "rose"    ? "shadow-[0_0_40px_rgba(251,113,133,0.06)]"
    : "";
  const valueColor =
    tone === "gold"   ? "text-amber-200"
    : tone === "emerald" ? "text-emerald-200"
    : tone === "rose"    ? "text-rose-300"
    : "text-white";

  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.03] px-5 py-4 ${glow}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold">{label}</span>
        {icon && <span className="text-white/20 text-base">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/35 mt-1">{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, className = "", action }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-[#0b0e15] overflow-hidden ${className}`}>
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-white/5">
        <div>
          <div className="text-sm font-bold text-white/90">{title}</div>
          {subtitle && <div className="text-[12px] text-white/40 mt-0.5">{subtitle}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "ghost", className = "" }) {
  const base = "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all";
  const variants = {
    gold: "bg-amber-400 text-black hover:bg-amber-300 shadow-[0_4px_16px_rgba(251,191,36,0.25)] disabled:opacity-40 disabled:cursor-not-allowed",
    ghost: "bg-white/5 border border-white/10 text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed",
    danger: "bg-rose-500/15 border border-rose-400/25 text-rose-300 hover:bg-rose-500/25",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant] || variants.ghost} ${className}`}>
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const s = safeLower(status || "pending");
  const cfg =
    isPaidOrConfirmed(s) ? "bg-emerald-500/12 text-emerald-300 border-emerald-400/20"
    : isCancelledLike(s) || isRefundedLike(s) ? "bg-rose-500/12 text-rose-300 border-rose-400/20"
    : isPendingLike(s) ? "bg-amber-500/12 text-amber-300 border-amber-400/20"
    : "bg-white/5 text-white/45 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${cfg}`}>
      {s}
    </span>
  );
}

function GatewayPill({ gateway }) {
  const g = safeLower(gateway || "");
  if (g.includes("paystack")) return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#00c3f7]/20 bg-[#00c3f7]/8 px-2 py-0.5 text-[10px] font-bold text-[#7ee8fa]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#00c3f7]" />Paystack
    </span>
  );
  if (g.includes("flutter")) return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#f5a623]/20 bg-[#f5a623]/8 px-2 py-0.5 text-[10px] font-bold text-[#fcd37a]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#f5a623]" />Flutterwave
    </span>
  );
  return null;
}

function Field({ children }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/8 px-3 py-2 text-white/90 focus-within:border-amber-400/50 transition-colors">
      {children}
    </div>
  );
}

const Input = (props) => (
  <input {...props} className="w-full bg-transparent outline-none placeholder-white/25 text-[13px]" />
);

const Select = (props) => (
  <select {...props} className="w-full bg-transparent outline-none text-[13px] text-white/80" />
);

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-14 text-center">
      <div className="text-4xl mb-3 opacity-30">🏠</div>
      <h3 className="text-lg font-bold text-white/80 mb-1">No listings yet</h3>
      <p className="text-white/40 text-sm mb-5">Add your first Nesta stay to start earning.</p>
      <Link to="/post/new" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-[13px] font-bold text-black hover:bg-amber-300 transition-all shadow-[0_4px_20px_rgba(251,191,36,0.25)]">
        + New listing
      </Link>
    </div>
  );
}

/* ===================== Main ===================== */
export default function HostDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const notify = useCallback(
    (msg, type = "info") => {
      try {
        showToast?.(msg, type);
      } catch {
        // no-op
      }
    },
    [showToast]
  );

  const { profile } = useUserProfile();

  const kycStatusRaw =
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = String(kycStatusRaw || "").toLowerCase();
  const isKycApproved = ["approved", "verified", "complete"].includes(kycStatus);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [status, setStatus] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [subInfo, setSubInfo] = useState({
    active: false,
    expiresAt: null,
    loading: true,
  });

  const [wallet, setWallet] = useState({
    loading: true,
    availableN: 0,
    pendingN: 0,
    currency: "NGN",
    canWithdraw: false,
    reason: "",
    payoutStatus: "",
    payoutPreview: null,
    minWithdrawal: 1000,
  });

  const [rev, setRev] = useState({
    grossLifetime: 0,
    gross30d: 0,
    netLifetimeTracked: 0,
    net30dTracked: 0,
    bookingsConfirmed: 0,
    bookingsPending: 0,
    cancelled: 0,
    refunded: 0,
    needsAttention: 0,
    mismatchCount: 0,
    reviewCount: 0,
    paystackTotal: 0,
    flutterwaveTotal: 0,
    otherTotal: 0,
  });

  const [hostBookings, setHostBookings] = useState([]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  const now = Date.now();
  const isSubscribed =
    subInfo.active &&
    (!subInfo.expiresAt || new Date(subInfo.expiresAt).getTime() > now);

  const recentBookings = useMemo(() => hostBookings.slice(0, 5), [hostBookings]);

  const goReservationsTab = (tab = "all") => {
    const t = String(tab || "all").toLowerCase();
    navigate(`/host-reservations?tab=${encodeURIComponent(t)}`);
  };

  const walletAvailable = Number(wallet.availableN || 0);
  const walletPending = Number(wallet.pendingN || 0);

  const payoutStatusUpper = safeUpper(wallet.payoutStatus || "");
  const payoutVerified = payoutStatusUpper === "VERIFIED";

  const canWithdraw = wallet.canWithdraw === true && walletAvailable > 0;

  const walletPrimaryHelper = wallet.loading
    ? "Loading wallet…"
    : wallet.canWithdraw === false
    ? wallet.reason || "Withdrawals are currently locked"
    : !payoutVerified
    ? "Complete payout verification before withdrawals can be released"
    : walletAvailable <= 0
    ? "No withdrawable balance yet"
    : "Ready to withdraw";

  const payoutStatusLabel = wallet.loading
    ? "Loading…"
    : payoutStatusUpper
    ? payoutStatusUpper.replace(/_/g, " ")
    : "Not set";

  const refreshMeta = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const qpRefresh = sp.get("refresh");
    const fromTab = sp.get("fromTab") || "";
    const action = sp.get("action") || "";
    const st = location.state || {};
    return {
      should: qpRefresh === "1" || st?.refresh === true,
      fromTab: String(st?.fromTab || fromTab || ""),
      action: String(st?.action || action || ""),
      hadQueryRefresh: qpRefresh === "1",
    };
  }, [location.search, location.state]);

  /* ---------- load listings ---------- */
  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      if (!user?.uid) return;

      const colRef = collection(db, "listings");

      const qOwnerId = query(
        colRef,
        where("ownerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap1 = await getDocs(qOwnerId);
      let list = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (list.length === 0) {
        const qOwnerUid = query(
          colRef,
          where("ownerUid", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap2 = await getDocs(qOwnerUid);
        list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      if (list.length === 0) {
        const qHostUid = query(
          colRef,
          where("hostUid", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap3 = await getDocs(qHostUid);
        list = snap3.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      setRows(list);
    } catch (e) {
      console.error("Error loading host listings:", e);
      setErr("Couldn’t load your listings right now.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadListings();
    })();
    return () => {
      alive = false;
    };
  }, [loadListings]);

  /* ---------- load subscription ---------- */
  const loadSubscription = useCallback(async () => {
    if (!user?.uid) {
      setSubInfo((p) => ({ ...p, loading: false }));
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        setSubInfo((p) => ({ ...p, loading: false }));
        return;
      }
      const d = snap.data() || {};
      setSubInfo({
        active: !!d.activeSubscription,
        expiresAt: d.subscriptionExpiresAt || null,
        loading: false,
      });
    } catch (e) {
      console.error("Error loading subscription:", e);
      setSubInfo((p) => ({ ...p, loading: false }));
    }
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadSubscription();
    })();
    return () => {
      alive = false;
    };
  }, [loadSubscription]);

  /* ---------- load wallet (server truth) ---------- */
  const loadWallet = useCallback(async () => {
    if (!user?.uid) {
      setWallet((w) => ({ ...w, loading: false }));
      return;
    }
    try {
      setWallet((w) => ({ ...w, loading: true }));
      const { data } = await api.get("/payouts/me/wallet");
      if (!data?.ok) {
        setWallet((w) => ({
          ...w,
          loading: false,
          canWithdraw: false,
          reason: data?.error || "Failed to load wallet",
        }));
        return;
      }

      const w = data.wallet || {};
      setWallet({
        loading: false,
        availableN: Number(w.available || 0),
        pendingN: Number(w.pending || 0),
        currency: w.currency || "NGN",
        canWithdraw: data.canWithdraw !== false,
        reason: data.reason || "",
        payoutStatus: data.payoutStatus || "",
        payoutPreview: data.payoutPreview || null,
        minWithdrawal: Number(data.minWithdrawal || 1000),
      });
    } catch (e) {
      console.error("Error loading host wallet:", e);
      setWallet((w) => ({
        ...w,
        loading: false,
        canWithdraw: false,
        reason: e?.response?.data?.error || "Failed to load wallet",
      }));
    }
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadWallet();
    })();
    return () => {
      alive = false;
    };
  }, [loadWallet]);

  /* ---------- load revenue + recent bookings ---------- */
  const loadRevenueAndBookings = useCallback(async () => {
    async function runQuery(field, uid) {
      try {
        const qref = query(
          collection(db, "bookings"),
          where(field, "==", uid),
          orderBy("createdAt", "desc"),
          limit(250)
        );
        return await getDocs(qref);
      } catch (e) {
        console.warn(`[HostDashboard] bookings query failed for ${field}:`, e);
        return null;
      }
    }

    if (!user?.uid) return;

    try {
      const snaps = await Promise.all([
        runQuery("hostId", user.uid),
        runQuery("hostUid", user.uid),
        runQuery("ownerUid", user.uid),
        runQuery("partnerUid", user.uid),
      ]);

      const seen = new Set();
      const docs = [];
      for (const s of snaps) {
        if (!s) continue;
        for (const d of s.docs) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          docs.push(d);
        }
      }

      docs.sort((a, b) => toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt));

      const nowMs = Date.now();
      const cutoff30d = nowMs - 30 * 24 * 60 * 60 * 1000;

      let grossLifetime = 0;
      let gross30d = 0;
      let netLifetimeTracked = 0;
      let net30dTracked = 0;

      let bookingsConfirmed = 0;
      let bookingsPending = 0;
      let cancelledCount = 0;
      let refundedCount = 0;

      let mismatchCount = 0;
      let reviewCount = 0;

      // gateway breakdown
      let paystackTotal = 0;
      let flutterwaveTotal = 0;
      let otherTotal = 0;

      const list = [];

      for (const docu of docs.slice(0, 400)) {
        const d = docu.data() || {};

        // exclude archived / junk
        if (d.archived) continue;

        const s = safeLower(d.status || "");

        const createdAtMs = toMillis(d.createdAt);
        const in30d = createdAtMs >= cutoff30d;

        const gross =
          Number(d.amountLockedN ?? d.amountN ?? d.total ?? d.totalAmount ?? 0) || 0;

        const hostNetTracked =
          Number(
            d.hostPayoutN ??
              d.pricingSnapshot?.netPayoutN ??
              d.pricingSnapshot?.hostPayoutN ??
              0
          ) || 0;

        if (d.paymentMismatch) mismatchCount++;
        if (safeLower(d.status || "") === "paid-needs-review") reviewCount++;

        if (isPaidOrConfirmed(s)) {
          bookingsConfirmed++;
          grossLifetime += gross;
          if (in30d) gross30d += gross;

          netLifetimeTracked += hostNetTracked;
          if (in30d) net30dTracked += hostNetTracked;

          // gateway breakdown
          const gw = safeLower(d.provider || d.gateway || d.paymentProvider || d.paymentGateway || "");
          if (gw.includes("paystack")) paystackTotal += gross;
          else if (gw.includes("flutter")) flutterwaveTotal += gross;
          else otherTotal += gross;
        } else if (isPendingLike(s)) {
          bookingsPending++;
        } else if (isCancelledLike(s)) {
          cancelledCount++;
        } else if (isRefundedLike(s)) {
          refundedCount++;
        }

        list.push({
          id: docu.id,
          listingTitle: d.listingTitle || d.listing?.title || d.title || "Listing",
          status: d.status || "pending",
          amount: gross,
          createdAt: d.createdAt || null,
          paymentMismatch: !!d.paymentMismatch,
        });
      }

      const needsAttention =
        bookingsPending + cancelledCount + refundedCount + mismatchCount + reviewCount;

      setRev({
        grossLifetime,
        gross30d,
        netLifetimeTracked,
        net30dTracked,
        bookingsConfirmed,
        bookingsPending,
        cancelled: cancelledCount,
        refunded: refundedCount,
        needsAttention,
        mismatchCount,
        reviewCount,
        paystackTotal,
        flutterwaveTotal,
        otherTotal,
      });

      setHostBookings(list);
    } catch (e) {
      console.error("[HostDashboard] Error loading revenue:", e);
    }
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadRevenueAndBookings();
    })();
    return () => {
      alive = false;
    };
  }, [loadRevenueAndBookings]);

  /* ---------- post-action refresh (from reservations page) ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!refreshMeta.should || !user?.uid) return;

      try {
        if (!alive) return;

        await Promise.all([
          loadListings(),
          loadWallet(),
          loadSubscription(),
          loadRevenueAndBookings(),
        ]);

        const action = safeLower(refreshMeta.action);
        if (action === "cancelled") notify("Booking cancelled ✅", "info");
        else if (action === "confirmed") notify("Booking confirmed ✅", "success");
        else if (action === "refunded") notify("Marked as refunded ✅", "success");
        else if (action === "released") notify("Payout released ✅", "success");
        else notify("Dashboard refreshed ✅", "success");

        await sleep(250);
        const sp = new URLSearchParams(location.search || "");
        sp.delete("refresh");
        sp.delete("action");
        sp.delete("fromTab");

        navigate(
          { pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : "" },
          { replace: true, state: {} }
        );
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    refreshMeta.should,
    refreshMeta.action,
    user?.uid,
    loadListings,
    loadWallet,
    loadSubscription,
    loadRevenueAndBookings,
    location.pathname,
    location.search,
    navigate,
    notify,
  ]);

  /* ---------- derived ---------- */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (Array.isArray(rows) ? rows : []).filter((r) => {
      const matchQ =
        !kw ||
        (r.title || "").toLowerCase().includes(kw) ||
        (r.city || "").toLowerCase().includes(kw) ||
        (r.area || "").toLowerCase().includes(kw);

      const price = Number(r.pricePerNight || 0);
      const passMin = !min || price >= Number(min);
      const passMax = !max || price <= Number(max);
      const s = (r.status || "active").toLowerCase();
      const passStatus = status === "all" || s === status;
      return matchQ && passMin && passMax && passStatus;
    });
  }, [rows, q, min, max, status]);

  const nightlyPortfolio = useMemo(() => {
    return filtered
      .filter((l) => String(l.status || "active").toLowerCase() === "active")
      .reduce((sum, l) => sum + Number(l.pricePerNight || 0), 0);
  }, [filtered]);

  const kpis = useMemo(() => {
    const active = filtered.filter(
      (r) => (r.status || "active").toLowerCase() === "active"
    ).length;
    return { active };
  }, [filtered]);

  const resetFilters = () => {
    setQ("");
    setMin("");
    setMax("");
    setStatus("all");
  };

  const payoutLabel = wallet.payoutPreview?.bankName
    ? `${wallet.payoutPreview.bankName} ${wallet.payoutPreview.accountNumberMasked || ""}`.trim()
    : "No payout method yet";

  /* ===================== JSX ===================== */
  return (
    <main className="min-h-screen bg-[#07090e] pt-20 pb-16 px-4 text-white">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/8 px-4 py-2 text-[13px] text-white/60 hover:text-white hover:bg-white/8 transition-all">
            ← Back
          </button>
          <button
            onClick={async () => {
              await Promise.all([loadListings(), loadWallet(), loadSubscription(), loadRevenueAndBookings()]);
              notify("Dashboard refreshed ✅", "success");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/8 px-4 py-2 text-[13px] text-white/60 hover:text-white hover:bg-white/8 transition-all"
          >
            ↺ Refresh
          </button>
        </div>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pt-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-amber-400/70 font-semibold mb-1">Host Dashboard</div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              {profile?.displayName || profile?.name || "Your dashboard"}
            </h1>
            <p className="text-white/40 text-[13px] mt-1.5">
              {rows.length} listing{rows.length !== 1 ? "s" : ""} in portfolio
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VerifiedRoleBadge role="Host" verified={isKycApproved} />
            <SubscriptionBanner />
            {!subInfo.loading && isSubscribed && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-300">
                Host Pro{subInfo.expiresAt ? ` · ${new Date(subInfo.expiresAt).toLocaleDateString()}` : ""}
              </span>
            )}
          </div>
        </header>

        {/* KYC gate */}
        {!isKycApproved && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-[13px] text-amber-100/80">
              <span className="font-bold text-amber-200">Finish your KYC</span> to unlock payouts, trust indicators, and full host features.
            </p>
            <Btn variant="gold" onClick={() => navigate("/onboarding/kyc/gate")}>Continue KYC →</Btn>
          </div>
        )}

        {err && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-[13px] text-rose-200">{err}</div>
        )}

        {/* ── Top KPI row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Active listings" value={kpis.active} icon="🏠" />
          <StatCard label="Confirmed bookings" value={rev.bookingsConfirmed} tone="emerald" icon="✓" />
          <StatCard label="Available balance" value={wallet.loading ? "—" : ngn(walletAvailable)} tone="gold" icon="₦" />
          <StatCard label="Needs attention" value={rev.needsAttention} tone={rev.needsAttention > 0 ? "rose" : "default"} icon="⚠" />
        </div>

        {/* ── Main two-column ── */}
        <div className="grid md:grid-cols-[1.15fr_1fr] gap-5">

          {/* Left col */}
          <div className="space-y-5">

            {/* Wallet card */}
            <Panel
              title="Wallet & payouts"
              subtitle="Server-truth balance · updated on each booking release"
              action={
                <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${
                  payoutVerified ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-300" : "border-amber-400/25 bg-amber-400/8 text-amber-300"
                }`}>{payoutStatusLabel}</span>
              }
            >
              {/* Balance row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/60 mb-1">Available</div>
                  <div className="text-2xl font-bold text-amber-200">{wallet.loading ? "—" : ngn(walletAvailable)}</div>
                  <div className="text-[11px] text-amber-300/40 mt-0.5">Withdrawable now</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/35 mb-1">Pending</div>
                  <div className="text-2xl font-bold text-white/70">{wallet.loading ? "—" : ngn(walletPending)}</div>
                  <div className="text-[11px] text-white/30 mt-0.5">Locked until release</div>
                </div>
              </div>

              {/* Gateway breakdown */}
              {!wallet.loading && rev.grossLifetime > 0 && (
                <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3 mb-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2.5 font-semibold">
                    Lifetime earnings by gateway <span className="text-white/20 normal-case tracking-normal">(indicative)</span>
                  </div>
                  <div className="space-y-2">
                    {rev.paystackTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <GatewayPill gateway="paystack" />
                        <span className="text-[13px] font-bold text-[#7ee8fa]">{ngn(rev.paystackTotal)}</span>
                      </div>
                    )}
                    {rev.flutterwaveTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <GatewayPill gateway="flutterwave" />
                        <span className="text-[13px] font-bold text-[#fcd37a]">{ngn(rev.flutterwaveTotal)}</span>
                      </div>
                    )}
                    {rev.otherTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/35">Other / untagged</span>
                        <span className="text-[13px] font-semibold text-white/50">{ngn(rev.otherTotal)}</span>
                      </div>
                    )}
                    {rev.paystackTotal === 0 && rev.flutterwaveTotal === 0 && (
                      <div className="text-[12px] text-white/30">No gateway data on bookings yet.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Payout destination */}
              <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3 mb-4">
                <div className="text-[11px] font-semibold text-white/50 mb-1">Payout destination</div>
                <div className="text-[13px] text-white/75">{payoutLabel}</div>
                <div className="text-[11px] text-white/35 mt-1">{walletPrimaryHelper}</div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Btn onClick={() => navigate("/payout-setup")}>Payout setup</Btn>
                <Btn
                  variant="gold"
                  disabled={!canWithdraw}
                  onClick={() => navigate("/withdrawals")}
                  title={!canWithdraw ? (wallet.reason || "Withdrawals locked") : "Withdraw available balance"}
                >
                  Withdraw {canWithdraw ? ngn(walletAvailable) : ""}
                </Btn>
              </div>
            </Panel>

            {/* Bookings overview */}
            <Panel title="Bookings overview" subtitle="All-time confirmed vs pending vs attention">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard label="Confirmed" value={rev.bookingsConfirmed} tone="emerald" />
                <StatCard label="Pending" value={rev.bookingsPending} tone="gold" />
                <StatCard label="Attention" value={rev.needsAttention} tone={rev.needsAttention > 0 ? "rose" : "default"} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn onClick={() => goReservationsTab("all")}>All reservations</Btn>
                {rev.needsAttention > 0 && (
                  <Btn onClick={() => goReservationsTab("attention")}>
                    ⚠ Attention ({rev.needsAttention})
                  </Btn>
                )}
                <Btn onClick={() => goReservationsTab("past")}>Past bookings</Btn>
              </div>
            </Panel>

          </div>

          {/* Right col */}
          <div className="space-y-5">

            {/* Portfolio card */}
            <Panel
              title="Portfolio"
              subtitle="Your active listings"
              action={
                <Link to="/post/new" className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 text-[12px] font-bold text-black hover:bg-amber-300 transition-all">
                  + New
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard label="Active" value={kpis.active} />
                <StatCard label="Nightly value" value={ngn(nightlyPortfolio)} tone="gold" />
              </div>
              <Btn onClick={() => navigate("/manage-listings")}>Manage listings →</Btn>
            </Panel>

            {/* Insights accordion */}
            <div className="rounded-2xl border border-white/8 bg-[#0b0e15] overflow-hidden">
              <button
                onClick={() => setInsightsOpen((v) => !v)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <div className="text-[13px] font-bold text-white/80">Revenue insights</div>
                  <div className="text-[11px] text-white/35 mt-0.5">Gross, net, cancellations, payment flags</div>
                </div>
                <span className="text-white/30 text-xs">{insightsOpen ? "▲" : "▼"}</span>
              </button>

              {insightsOpen && (
                <div className="px-5 pb-5 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <StatCard label="Gross lifetime" value={ngn(rev.grossLifetime)} />
                    <StatCard label="Gross 30 days" value={ngn(rev.gross30d)} tone="gold" />
                    <StatCard label="Net lifetime" value={ngn(rev.netLifetimeTracked)} tone="emerald" />
                    <StatCard label="Net 30 days" value={ngn(rev.net30dTracked)} tone="emerald" />
                    <StatCard label="Cancelled" value={rev.cancelled} tone="rose" />
                    <StatCard label="Refunded" value={rev.refunded} tone="rose" />
                    <StatCard label="Payment issues" value={rev.mismatchCount + rev.reviewCount} tone={rev.mismatchCount + rev.reviewCount > 0 ? "rose" : "default"} />
                    <StatCard label="Needs review" value={rev.reviewCount} tone={rev.reviewCount > 0 ? "rose" : "default"} />
                  </div>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Btn onClick={() => goReservationsTab("attention")}>Attention queue →</Btn>
                    <Btn onClick={() => goReservationsTab("past")}>Past bookings →</Btn>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl border border-white/8 bg-[#0b0e15] overflow-hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div>
              <div className="text-[13px] font-bold text-white/80">Listing filters</div>
              <div className="text-[11px] text-white/35 mt-0.5">Search, price range, status</div>
            </div>
            <span className="text-white/30 text-xs">{filtersOpen ? "▲" : "▼"}</span>
          </button>

          {filtersOpen && (
            <div className="px-5 pb-5 border-t border-white/5 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3">
                <Field><Input placeholder="Search title, city, area…" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
                <Field><Input type="number" min={0} placeholder="Min ₦/night" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
                <Field><Input type="number" min={0} placeholder="Max ₦/night" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
                <Field>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">Any status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="review">Under review</option>
                  </Select>
                </Field>
                <Btn onClick={resetFilters}>Reset</Btn>
              </div>
            </div>
          )}
        </div>

        {/* ── Listings grid ── */}
        <section>
          {loading ? (
            <div className="text-white/40 text-[13px] px-1">Loading listings…</div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => (
                <article
                  key={l.id}
                  className="rounded-2xl border border-white/8 bg-[#0b0e15] overflow-hidden hover:border-amber-400/25 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="h-36 bg-gradient-to-br from-[#161b26] to-[#0b0e15] border-b border-white/5 overflow-hidden">
                    {Array.isArray(l.imageUrls) && l.imageUrls[0] ? (
                      <img src={l.imageUrls[0]} alt={l.title || "Listing"} className="w-full h-full object-cover opacity-90" loading="lazy" />
                    ) : l.primaryImageUrl ? (
                      <img src={l.primaryImageUrl} alt={l.title || "Listing"} className="w-full h-full object-cover opacity-90" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">🏠</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-white text-sm leading-snug flex-1 truncate">{l.title || "Untitled"}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/45 capitalize shrink-0">{l.status || "active"}</span>
                    </div>
                    <div className="text-[12px] text-white/50 mb-3">
                      {ngn(l.pricePerNight || 0)}/night · {l.area || l.city || "—"}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link to={`/listing/${l.id}`} className="rounded-xl bg-white/5 border border-white/8 text-center py-2 text-[12px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-all">View</Link>
                      <Link to={`/listing/${l.id}/edit`} className="rounded-xl bg-amber-400/90 text-black text-center py-2 text-[12px] font-bold hover:bg-amber-300 transition-all">Edit</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── Recent bookings accordion ── */}
        <div className="rounded-2xl border border-white/8 bg-[#0b0e15] overflow-hidden">
          <button
            onClick={() => setRecentOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div>
              <div className="text-[13px] font-bold text-white/80">Recent bookings</div>
              <div className="text-[11px] text-white/35 mt-0.5">
                Showing {recentBookings.length} of {hostBookings.length} · open only when needed
              </div>
            </div>
            <span className="text-white/30 text-xs">{recentOpen ? "▲" : "▼"}</span>
          </button>

          {recentOpen && (
            <div className="border-t border-white/5">
              {recentBookings.length === 0 ? (
                <div className="px-5 py-5 text-[13px] text-white/35">No bookings yet for this host account.</div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {recentBookings.map((b) => (
                    <li key={b.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[13px] truncate text-white/85">{b.listingTitle || "Listing"}</p>
                        <p className="text-[11px] text-white/35 mt-0.5">{formatDateTime(b.createdAt)}</p>
                        {b.paymentMismatch && (
                          <p className="text-[11px] text-amber-300/70 mt-0.5">⚠ payment mismatch</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-[13px] text-white/80">{ngn(b.amount)}</span>
                        <StatusPill status={b.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-5 py-3 border-t border-white/5 flex gap-2">
                <Btn onClick={() => goReservationsTab("all")}>All reservations →</Btn>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}