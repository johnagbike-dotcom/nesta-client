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

function formatDateTime(v) {
  if (!v) return "—";
  try {
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
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

function Card({
  title,
  children,
  right,
  tone = "default",
  className = "",
  onClick,
  disabled = false,
}) {
  const toneCls =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10"
      : tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : tone === "rose"
      ? "border-rose-400/30 bg-rose-500/10"
      : "border-white/10 bg-white/5";

  const clickable = !!onClick && !disabled;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`rounded-3xl border ${toneCls} p-5 shadow-[0_18px_70px_rgba(0,0,0,0.55)] transition-all ${
        clickable ? "cursor-pointer hover:bg-white/10 hover:border-amber-300/50" : ""
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      aria-disabled={disabled ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            {title}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniKpi({ label, value, tone = "default" }) {
  const toneCls =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
      : tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "rose"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <div className={`rounded-2xl border ${toneCls} px-4 py-3`}>
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ children }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white/90 focus-within:border-amber-400/70 transition-colors">
      {children}
    </div>
  );
}

const Input = (props) => (
  <input
    {...props}
    className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
  />
);

const Select = (props) => (
  <select
    {...props}
    className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
  />
);

function EmptyState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
      <h3 className="text-2xl font-bold text-white mb-2">No listings yet</h3>
      <p className="text-white/70">Add your first Nesta stay to start earning.</p>
      <Link
        to="/post/new"
        className="inline-block mt-5 px-6 py-3 rounded-2xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
      >
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

  // ✅ hook has NO args; it subscribes to auth internally
  const { profile } = useUserProfile();

  // UI hint only; server policy is truth (withdrawals page uses /payouts/me/wallet)
  const kycStatusRaw =
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = String(kycStatusRaw || "").toLowerCase();
  const isKycApproved = ["approved", "verified", "complete"].includes(kycStatus);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [status, setStatus] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Subscription
  const [subInfo, setSubInfo] = useState({
    active: false,
    expiresAt: null,
    loading: true,
  });

  // Wallet (server truth)
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

  // Revenue + booking stats
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

  const canWithdraw = wallet.canWithdraw === true && walletAvailable > 0;

  const walletPrimaryHelper = wallet.loading
    ? "Loading…"
    : wallet.canWithdraw === false
    ? wallet.reason || "Withdrawals locked"
    : walletAvailable <= 0
    ? "No withdrawable balance yet"
    : "Ready to withdraw";

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

      const list = [];

      for (const docu of docs.slice(0, 400)) {
        const d = docu.data() || {};
        const s = safeLower(d.status || "");

        const createdAtMs = toMillis(d.createdAt);
        const in30d = createdAtMs >= cutoff30d;

        const gross = Number(d.amountLockedN ?? d.amountN ?? d.total ?? d.totalAmount ?? 0) || 0;

        const hostNetTracked =
          Number(d.hostPayoutN ?? d.pricingSnapshot?.netPayoutN ?? d.pricingSnapshot?.hostPayoutN ?? 0) || 0;

        if (d.paymentMismatch) mismatchCount++;
        if (safeLower(d.status || "") === "paid-needs-review") reviewCount++;

        if (isPaidOrConfirmed(s)) {
          bookingsConfirmed++;
          grossLifetime += gross;
          if (in30d) gross30d += gross;

          netLifetimeTracked += hostNetTracked;
          if (in30d) net30dTracked += hostNetTracked;
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

  /* ===================== JSX (calmer layout) ===================== */
  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-12 px-4 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await Promise.all([loadListings(), loadWallet(), loadSubscription(), loadRevenueAndBookings()]);
                notify("Dashboard refreshed ✅", "success");
              }}
              className="rounded-full px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300">
              Host Dashboard
            </h1>
            <p className="text-white/70 mt-2 max-w-2xl text-sm md:text-base">
              A calm view of your portfolio, bookings, and earnings — designed for premium trust.
            </p>
            <div className="mt-2 text-[11px] text-white/45">
              Portfolio:{" "}
              <span className="text-white/70 font-semibold">{rows.length}</span>{" "}
              listing(s)
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <VerifiedRoleBadge role="Host" verified={isKycApproved} />
            <SubscriptionBanner />
            {!subInfo.loading && isSubscribed && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-200">
                Host Pro
                {subInfo.expiresAt
                  ? ` • until ${new Date(subInfo.expiresAt).toLocaleDateString()}`
                  : ""}
              </span>
            )}
          </div>
        </header>

        {/* KYC Gate Banner */}
        {!isKycApproved && (
          <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-50 flex items-center justify-between gap-3">
            <p className="max-w-3xl">
              <span className="font-semibold">Finish your KYC</span> to unlock payouts, trust indicators, and full host features.
            </p>
            <button
              onClick={() => navigate("/onboarding/kyc/gate")}
              className="px-4 py-2 rounded-2xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300"
            >
              Continue KYC →
            </button>
          </section>
        )}

        {err && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {err}
          </div>
        )}

        {/* Above the fold: only decision KPIs */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card title="Portfolio">
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi label="Active listings" value={kpis.active.toLocaleString("en-NG")} />
              <MiniKpi
                label="Nightly portfolio"
                value={ngn(nightlyPortfolio)}
                tone="default"
              />
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/manage-listings")}
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
              >
                Manage listings
              </button>
              <Link
                to="/post/new"
                className="px-4 py-2 rounded-2xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400"
              >
                + New listing
              </Link>
            </div>
          </Card>

          <Card title="Bookings overview" right={<span className="text-[11px] text-white/50">Last 30 days</span>}>
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi
                label="Confirmed"
                value={rev.bookingsConfirmed.toLocaleString("en-NG")}
                tone="emerald"
              />
              <MiniKpi
                label="Pending / upcoming"
                value={rev.bookingsPending.toLocaleString("en-NG")}
                tone="amber"
              />
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => goReservationsTab("all")}
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
              >
                Open reservations →
              </button>
              <button
                type="button"
                onClick={() => goReservationsTab("attention")}
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
              >
                Needs attention ({rev.needsAttention})
              </button>
            </div>
          </Card>

          <Card
            title="Wallet & payouts"
            tone={canWithdraw ? "emerald" : "amber"}
            right={
              <span className="text-[11px] text-white/50">
                Status:{" "}
                <span className="text-white/80 font-semibold">
                  {String(wallet.payoutStatus || "—")}
                </span>
              </span>
            }
          >
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-white/70 text-sm">Available (withdrawable)</div>
                <div className="text-2xl font-semibold">{wallet.loading ? "—" : ngn(walletAvailable)}</div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-white/60 text-xs">
                  Pending (releases after check-in)
                </div>
                <div className="text-sm text-white/70">{wallet.loading ? "—" : ngn(walletPending)}</div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
                <div className="font-semibold text-white/80">Payout destination</div>
                <div className="mt-1">{payoutLabel}</div>
                <div className="mt-2 text-white/60">{walletPrimaryHelper}</div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate("/payout-setup")}
                  className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
                >
                  Payout setup
                </button>

                <button
                  type="button"
                  disabled={!canWithdraw}
                  onClick={() => navigate("/withdrawals")}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${
                    canWithdraw
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                  title={
                    wallet.loading
                      ? "Loading wallet…"
                      : wallet.canWithdraw === false
                      ? wallet.reason || "Withdrawals locked"
                      : "No withdrawable balance yet"
                  }
                >
                  Withdraw
                </button>
              </div>
            </div>
          </Card>
        </section>

        {/* Insights accordion: all secondary KPIs moved out of sight */}
        <section className="rounded-3xl border border-white/10 bg-[#090c12] overflow-hidden">
          <button
            onClick={() => setInsightsOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-white">Insights</div>
              <div className="text-xs text-white/50 mt-1">
                Revenue, cancellations, refunds, and payment flags — kept tidy.
              </div>
            </div>
            <div className="text-white/70 text-sm">{insightsOpen ? "Hide" : "Show"} ▾</div>
          </button>

          {insightsOpen ? (
            <div className="px-5 pb-5">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <MiniKpi label="Gross revenue (lifetime)" value={ngn(rev.grossLifetime)} />
                <MiniKpi label="Gross revenue (30 days)" value={ngn(rev.gross30d)} />
                <MiniKpi label="Lifetime earned (net tracked)" value={ngn(rev.netLifetimeTracked)} tone="emerald" />
                <MiniKpi label="Net (30 days tracked)" value={ngn(rev.net30dTracked)} tone="emerald" />

                <MiniKpi label="Cancelled" value={rev.cancelled.toLocaleString("en-NG")} tone="rose" />
                <MiniKpi label="Refunded" value={rev.refunded.toLocaleString("en-NG")} tone="rose" />
                <MiniKpi
                  label="Payment issues"
                  value={(rev.mismatchCount + rev.reviewCount).toLocaleString("en-NG")}
                  tone="amber"
                />
                <MiniKpi label="Paid-needs-review" value={rev.reviewCount.toLocaleString("en-NG")} tone="amber" />
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => goReservationsTab("attention")}
                  className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
                >
                  Open attention queue →
                </button>
                <button
                  type="button"
                  onClick={() => goReservationsTab("past")}
                  className="px-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
                >
                  Past bookings →
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Filters (collapsed by default) */}
        <section className="rounded-3xl bg-[#090c12] border border-white/5 overflow-hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-white">Filters</div>
              <div className="text-xs text-white/50 mt-1">
                Search & pricing filters (optional).
              </div>
            </div>
            <div className="text-white/70 text-sm">{filtersOpen ? "Hide" : "Show"} ▾</div>
          </button>

          {filtersOpen ? (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3">
                <Field>
                  <Input
                    placeholder="Search (title, city, area)…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </Field>
                <Field>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min ₦/night"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </Field>
                <Field>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max ₦/night"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </Field>
                <Field>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">Any status</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="review">under review</option>
                  </Select>
                </Field>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Listings */}
        <section>
          {loading ? (
            <p className="text-white/70 text-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => (
                <article
                  key={l.id}
                  className="rounded-3xl border border-white/10 bg-[#0f1419] overflow-hidden hover:border-amber-300/50 hover:-translate-y-1 transition-all duration-200 shadow-[0_16px_50px_rgba(0,0,0,0.55)]"
                >
                  <div className="h-40 bg-gradient-to-br from-[#202736] via-[#151924] to-black/90 border-b border-white/10 overflow-hidden">
                    {Array.isArray(l.imageUrls) && l.imageUrls[0] ? (
                      <img
                        src={l.imageUrls[0]}
                        alt={l.title || "Listing"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : l.primaryImageUrl ? (
                      <img
                        src={l.primaryImageUrl}
                        alt={l.title || "Listing"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg flex-1 truncate">
                        {l.title || "Untitled"}
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/15 text-white/70 capitalize">
                        {l.status || "active"}
                      </span>
                    </div>

                    <div className="text-white/70 mt-2 text-sm">
                      {ngn(l.pricePerNight || 0)}/night • {l.area || "—"}
                      <div className="text-white/50">{l.city || "—"}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        to={`/listing/${l.id}`}
                        className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-center text-sm hover:bg-white/15"
                      >
                        View
                      </Link>
                      <Link
                        to={`/listing/${l.id}/edit`}
                        className="px-4 py-2 rounded-2xl bg-amber-500 text-black font-semibold text-center text-sm hover:bg-amber-400"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Recent bookings (collapsed) */}
        <section className="rounded-3xl bg-[#090c12] border border-white/5 overflow-hidden">
          <button
            onClick={() => setRecentOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-white">Recent bookings</div>
              <div className="text-xs text-white/50 mt-1">
                Quick glance — open only when needed.
              </div>
            </div>
            <div className="text-white/70 text-sm">{recentOpen ? "Hide" : "Show"} ▾</div>
          </button>

          {recentOpen ? (
            <>
              <div className="px-5 pb-2 flex items-center justify-between">
                <div className="text-[11px] text-white/45">
                  Showing {recentBookings.length} of {hostBookings.length}
                </div>
                <button
                  onClick={() => goReservationsTab("all")}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Open reservations →
                </button>
              </div>

              {recentBookings.length === 0 ? (
                <div className="px-5 pb-5 text-xs text-white/45">
                  No bookings yet for this host account.
                </div>
              ) : (
                <ul className="divide-y divide-white/5 text-xs md:text-sm">
                  {recentBookings.map((b) => (
                    <li
                      key={b.id}
                      className="px-5 py-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.listingTitle || "Listing"}</p>
                        <p className="text-[11px] text-white/45">{formatDateTime(b.createdAt)}</p>
                        {b.paymentMismatch ? (
                          <p className="mt-1 text-[11px] text-amber-200/80">
                            ⚠ payment mismatch (review)
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-[13px]">{ngn(b.amount)}</span>
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold capitalize border ${
                            isPaidOrConfirmed(b.status)
                              ? "bg-emerald-600/15 text-emerald-200 border-emerald-500/30"
                              : isCancelledLike(b.status) || isRefundedLike(b.status)
                              ? "bg-rose-600/15 text-rose-200 border-rose-500/30"
                              : "bg-slate-500/15 text-slate-200 border-slate-500/30"
                          }`}
                        >
                          {safeLower(b.status || "pending")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}