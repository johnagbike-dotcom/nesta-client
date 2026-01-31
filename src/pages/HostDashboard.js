// src/pages/HostDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import VerifiedRoleBadge from "../components/VerifiedRoleBadge";
import SubscriptionBanner from "../components/SubscriptionBanner";

const nf = new Intl.NumberFormat("en-NG");
const ngn = (n) => `₦${nf.format(Math.round(Number(n || 0)))}`;

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

/* ---------- Small reusable UI ---------- */

function CardStat({
  label,
  value,
  helper,
  currency = false,
  tone,
  onClick,
  disabled = false,
}) {
  const safeValue =
    typeof value === "number" ? value : Number(value || 0) || 0;
  const formatted = currency
    ? ngn(safeValue)
    : safeValue.toLocaleString("en-NG");

  const toneClasses =
    tone === "amber"
      ? "border-amber-400/40 bg-amber-500/10"
      : "border-white/10 bg-white/5";

  const clickable = !!onClick && !disabled;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`rounded-2xl px-4 py-3 border ${toneClasses} flex flex-col justify-between min-h-[84px] transition-all ${
        clickable
          ? "cursor-pointer hover:bg-white/10 hover:border-amber-300/60"
          : disabled
          ? "opacity-55 cursor-not-allowed"
          : ""
      }`}
      title={
        disabled
          ? "Withdrawal is locked"
          : clickable
          ? `View ${label.toLowerCase()}`
          : undefined
      }
      aria-disabled={disabled ? "true" : "false"}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">
        {Number.isNaN(safeValue) ? (currency ? "₦0" : "0") : formatted}
      </div>
      {helper && (
        <div className="mt-1 text-[11px] text-white/55 truncate">{helper}</div>
      )}
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
      <h3 className="text-xl font-bold text-white mb-2">
        No listings yet for this host
      </h3>
      <p className="text-white/70">Add your first Nesta stay to start earning.</p>
      <Link
        to="/post/new"
        className="inline-block mt-4 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
      >
        + New listing
      </Link>
    </div>
  );
}

/* ---------- helpers ---------- */

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function isPaidOrConfirmed(status) {
  const s = safeLower(status);
  return s === "paid" || s === "confirmed" || s === "completed";
}

function isPendingLike(status) {
  const s = safeLower(status);
  return (
    s === "pending" ||
    s === "awaiting" ||
    s === "hold" ||
    s === "reserved_unpaid" ||
    s === "initialized"
  );
}

function isCancelledLike(status) {
  const s = safeLower(status);
  return s === "cancelled" || s === "canceled";
}

/* ---------- Main component ---------- */

export default function HostDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useUserProfile(user?.uid);

  // --- KYC status ---
  const kycStatusRaw =
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = String(kycStatusRaw).toLowerCase();
  const isKycApproved =
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  const [rows, setRows] = useState([]); // host listings
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [status, setStatus] = useState("all");

  // subscription (Host Pro)
  const [subInfo, setSubInfo] = useState({
    active: false,
    expiresAt: null,
    loading: true,
  });

  // ✅ wallet (backend truth)
  const [wallet, setWallet] = useState({
    loading: true,
    availableN: 0,
    pendingN: 0,
    lifetimeEarnedN: 0,
  });

  // revenue stats (booking-derived)
  const [rev, setRev] = useState({
    gross: 0,
    net: 0,
    bookingsConfirmed: 0,
    bookingsPending: 0,
    cancelled: 0,
    refunded: 0,
    needsAttention: 0,
  });

  // bookings for this host (for recent strip)
  const [hostBookings, setHostBookings] = useState([]);

  const now = Date.now();
  const isSubscribed =
    subInfo.active &&
    (!subInfo.expiresAt || new Date(subInfo.expiresAt).getTime() > now);

  const recentBookings = useMemo(() => hostBookings.slice(0, 5), [hostBookings]);

  const goManageListings = () => navigate("/manage-listings");
  const goReservations = () => navigate("/host-reservations");
  const goWithdrawals = () => navigate("/withdrawals");

  // ✅ Withdrawal gating
  const walletAvailable = Number(wallet.availableN || 0);
  const walletPending = Number(wallet.pendingN || 0);
  const walletLifetime = Number(wallet.lifetimeEarnedN || 0);

  const withdrawalLockedByKyc = !isKycApproved;
  const withdrawalLockedByZero = walletAvailable <= 0;
  const canWithdraw = !withdrawalLockedByKyc && !withdrawalLockedByZero;

  const showWalletLockBadge = !canWithdraw;

  const walletPrimaryHelper = wallet.loading
    ? "Loading…"
    : withdrawalLockedByKyc
    ? "Complete KYC to withdraw"
    : withdrawalLockedByZero
    ? "No withdrawable balance yet"
    : "Ready to withdraw";

  /* ---------- Load host listings ---------- */
  useEffect(() => {
    let alive = true;

    async function loadListings() {
      try {
        setLoading(true);
        setErr("");
        if (!user?.uid) return;

        const colRef = collection(db, "listings");

        // Primary: ownerId
        const qOwnerId = query(
          colRef,
          where("ownerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap1 = await getDocs(qOwnerId);
        let list = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fallback: ownerUid
        if (list.length === 0) {
          const qOwnerUid = query(
            colRef,
            where("ownerUid", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const snap2 = await getDocs(qOwnerUid);
          list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        // Fallback: hostUid
        if (list.length === 0) {
          const qHostUid = query(
            colRef,
            where("hostUid", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const snap3 = await getDocs(qHostUid);
          list = snap3.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        if (alive) setRows(list);
      } catch (e) {
        console.error("Error loading host listings:", e);
        if (alive) {
          setErr("Couldn’t load your listings right now.");
          setRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadListings();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  /* ---------- Subscription info (Host Pro) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid) {
        if (alive) setSubInfo((p) => ({ ...p, loading: false }));
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!alive || !snap.exists()) {
          if (alive) setSubInfo((p) => ({ ...p, loading: false }));
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
        if (alive) setSubInfo((p) => ({ ...p, loading: false }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  /* ---------- ✅ Wallet info (Host) ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.uid) {
        if (alive) setWallet((w) => ({ ...w, loading: false }));
        return;
      }
      try {
        setWallet((w) => ({ ...w, loading: true }));

        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.exists() ? snap.data() || {} : {};

        const availableN = Number(
          d.walletAvailableN ??
            d.availableBalanceN ??
            d.availableN ??
            d.wallet?.availableN ??
            0
        );

        const pendingN = Number(
          d.walletPendingN ??
            d.pendingBalanceN ??
            d.pendingN ??
            d.wallet?.pendingN ??
            0
        );

        const lifetimeEarnedN = Number(
          d.walletLifetimeEarnedN ??
            d.lifetimeEarnedN ??
            d.totalEarnedN ??
            d.wallet?.lifetimeEarnedN ??
            0
        );

        if (alive) {
          setWallet({
            loading: false,
            availableN: Number.isFinite(availableN) ? availableN : 0,
            pendingN: Number.isFinite(pendingN) ? pendingN : 0,
            lifetimeEarnedN: Number.isFinite(lifetimeEarnedN)
              ? lifetimeEarnedN
              : 0,
          });
        }
      } catch (e) {
        console.error("Error loading host wallet:", e);
        if (alive) setWallet((w) => ({ ...w, loading: false }));
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  /* ---------- Revenue + bookings for this host ---------- */
  useEffect(() => {
    let alive = true;

    async function runQuery(field, uid) {
      try {
        const qref = query(
          collection(db, "bookings"),
          where(field, "==", uid),
          orderBy("createdAt", "desc"),
          limit(200)
        );
        return await getDocs(qref);
      } catch (e) {
        console.warn(`[host dashboard] bookings query failed for ${field}:`, e?.message || e);
        return null;
      }
    }

    async function loadRevenueAndBookings() {
      if (!user?.uid) return;

      try {
        // ✅ IMPORTANT: your booking docs might store host in different fields depending on flow.
        // So we merge results from multiple fields safely.
        const snaps = await Promise.all([
          runQuery("hostId", user.uid),     // legacy
          runQuery("hostUid", user.uid),    // canonical
          runQuery("ownerUid", user.uid),   // some flows
          runQuery("partnerUid", user.uid), // partner-as-host flows
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

        // sort desc by createdAt (best effort)
        docs.sort((a, b) => {
          const av = a.data()?.createdAt;
          const bv = b.data()?.createdAt;
          const at =
            typeof av?.toDate === "function" ? av.toDate().getTime() : new Date(av || 0).getTime();
          const bt =
            typeof bv?.toDate === "function" ? bv.toDate().getTime() : new Date(bv || 0).getTime();
          return bt - at;
        });

        let grossSum = 0;
        let netSum = 0;
        let bookingsConfirmed = 0;
        let bookingsPending = 0;
        let cancelled = 0;
        let refunded = 0;

        const list = [];

        for (const docu of docs.slice(0, 300)) {
          const d = docu.data() || {};
          const s = safeLower(d.status || "");

          const gross = Number(d.amountLockedN ?? d.amountN ?? d.total ?? 0);
          const hostNet = Number(d.hostPayoutN ?? 0);

          if (isPaidOrConfirmed(s)) {
            grossSum += gross;
            // if hostNet not tracked yet, treat as 0 (wallet will be truth)
            netSum += hostNet;
            bookingsConfirmed++;
          } else if (isPendingLike(s)) {
            bookingsPending++;
          } else if (isCancelledLike(s)) {
            cancelled++;
          } else if (s === "refunded") {
            refunded++;
          }

          list.push({
            id: docu.id,
            listingTitle: d.listingTitle || d.listing?.title || d.title || "Listing",
            status: d.status || "pending",
            amount: gross,
            createdAt: d.createdAt || null,
          });
        }

        const needsAttention = bookingsPending + cancelled + refunded;

        if (alive) {
          setRev({
            gross: grossSum,
            net: netSum,
            bookingsConfirmed,
            bookingsPending,
            cancelled,
            refunded,
            needsAttention,
          });
          setHostBookings(list);
        }
      } catch (e) {
        console.error("Error loading host revenue:", e);
      }
    }

    loadRevenueAndBookings();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  /* ---------- Filters / derived stats ---------- */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
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
    // ✅ Nightly portfolio = sum of active listing prices, not bookings
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

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-12 px-4 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <div className="text-[11px] text-white/45">
          Loaded listings:{" "}
          <span className="text-white/70 font-semibold">{rows.length}</span>
        </div>

        <header className="mt-2 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300">
              Host Dashboard
            </h1>
            <p className="text-white/70 mt-2 max-w-2xl text-sm md:text-base">
              Manage your Nesta stay, see your bookings and{" "}
              <span className="font-semibold">what you’ve earned</span> — all in
              one calm, luxury view.
            </p>
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

        {!isKycApproved && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 flex items-center justify-between gap-3">
            <p>
              <span className="font-semibold">Finish your KYC</span> to unlock
              full visibility, payouts, and trust indicators on Nesta.
            </p>
            <button
              onClick={() => navigate("/onboarding/kyc/gate")}
              className="px-4 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300"
            >
              Continue KYC
            </button>
          </section>
        )}

        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            {err}
          </div>
        )}

        {/* KPI GRID 1 */}
        <section className="grid gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-6">
          <CardStat
            label="Active listing(s)"
            value={kpis.active}
            helper="Live stays on Nesta"
            onClick={goManageListings}
          />

          {/* ✅ NO MORE 3 duplicated “buttons” */}
          <CardStat
            label="Confirmed bookings"
            value={rev.bookingsConfirmed}
            helper="Paid / confirmed"
          />
          <CardStat
            label="Pending / upcoming"
            value={rev.bookingsPending}
            helper="Awaiting payment / arrival"
          />

          <CardStat
            label="Nightly portfolio"
            currency
            value={nightlyPortfolio}
            helper="Across active listings"
            onClick={goManageListings}
          />

          <CardStat
            label="Gross revenue"
            currency
            value={rev.gross}
            helper="All-time (before fees)"
          />

          <CardStat
            label="Host earnings (net)"
            currency
            value={rev.net}
            helper="All-time (if tracked)"
          />
        </section>

        {/* 🔒 Lock badge */}
        {showWalletLockBadge && (
          <div className="flex items-center gap-2 text-[11px] text-amber-200/90">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5">
              🔒
              <span className="font-semibold tracking-wide">
                {withdrawalLockedByKyc
                  ? "KYC REQUIRED FOR WITHDRAWALS"
                  : "NO WITHDRAWABLE BALANCE"}
              </span>
            </span>
            <span className="text-white/50">
              {withdrawalLockedByKyc
                ? "Complete verification to unlock payouts"
                : "Funds will unlock after payout window clears"}
            </span>
          </div>
        )}

        {/* ✅ HOST WALLET */}
        <section className="grid gap-3 md:gap-4 md:grid-cols-3">
          <CardStat
            label="Wallet available"
            currency
            value={walletAvailable}
            helper={walletPrimaryHelper}
            tone="amber"
            onClick={goWithdrawals}
            disabled={!canWithdraw}
          />

          <CardStat
            label="Pending"
            currency
            value={walletPending}
            helper={
              wallet.loading
                ? "Loading…"
                : withdrawalLockedByKyc
                ? "KYC required for payouts"
                : walletPending > 0
                ? "Clearing payout window"
                : "No pending balance"
            }
            onClick={goWithdrawals}
            disabled={withdrawalLockedByKyc}
          />

          <CardStat
            label="Lifetime earned"
            currency
            value={walletLifetime}
            helper={wallet.loading ? "Loading…" : "All-time host earnings"}
            onClick={goWithdrawals}
            disabled={withdrawalLockedByKyc}
          />
        </section>

        {/* KPI GRID 2 */}
        <section className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CardStat
            label="Needs attention"
            value={rev.needsAttention}
            helper="Pending / cancelled / refunded"
            tone="amber"
          />
          <CardStat label="Cancelled" value={rev.cancelled} />
          <CardStat label="Refunded" value={rev.refunded} />
          <CardStat
            label="KYC status"
            value={isKycApproved ? 1 : 0}
            helper={kycStatusRaw || (isKycApproved ? "approved" : "pending")}
          />
        </section>

        {/* ACTION BAR */}
        <section className="flex flex-wrap gap-3 items-center mt-1">
          <button
            type="button"
            onClick={goManageListings}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
          >
            Manage your listing
          </button>

          {/* ✅ single button for reservations */}
          <button
            type="button"
            onClick={goReservations}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
          >
            Open reservations
          </button>

          <Link
            to="/post/new"
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400"
          >
            + New listing
          </Link>

          <button
            type="button"
            disabled={!canWithdraw}
            onClick={goWithdrawals}
            className={`ml-auto px-4 py-2 rounded-xl text-sm font-semibold transition ${
              canWithdraw
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
            title={
              wallet.loading
                ? "Loading wallet…"
                : withdrawalLockedByKyc
                ? "Complete KYC to withdraw earnings"
                : "No withdrawable balance yet"
            }
          >
            Withdraw earnings
          </button>
        </section>

        {/* FILTERS */}
        <section className="rounded-3xl bg-[#090c12] border border-white/5 p-4 md:p-5 space-y-3">
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
        </section>

        {/* PORTFOLIO CARDS */}
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
                  className="rounded-2xl border border-white/10 bg-[#0f1419] overflow-hidden hover:border-amber-300/60 hover:-translate-y-1 transition-all duration-200 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
                >
                  <div className="h-36 bg-gradient-to-br from-[#202736] via-[#151924] to-black/90 border-b border-white/10 overflow-hidden">
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
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg flex-1 truncate">
                        {l.title || "Untitled"}
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/15 text-white/70 capitalize">
                        {l.status || "active"}
                      </span>
                    </div>
                    <div className="text-white/70 mt-1 text-sm">
                      {ngn(l.pricePerNight || 0)}/night • {l.area || "—"}
                      <br />
                      {l.city || "—"}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        to={`/listing/${l.id}`}
                        className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-center text-sm hover:bg-white/15"
                      >
                        View
                      </Link>
                      <Link
                        to={`/listing/${l.id}/edit`}
                        className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-center text-sm hover:bg-amber-400"
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

        {/* RECENT BOOKINGS STRIP */}
        <section className="mt-6 rounded-3xl bg-[#090c12] border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3">
            <h2 className="text-sm md:text-base font-semibold">Recent bookings</h2>
            <button
              onClick={goReservations}
              className="text-xs md:text-sm text-white/60 hover:text-white"
            >
              Open reservations →
            </button>
          </div>
          {recentBookings.length === 0 ? (
            <div className="px-4 md:px-5 pb-4 text-xs text-white/45">
              No bookings yet for this host account.
            </div>
          ) : (
            <ul className="divide-y divide-white/5 text-xs md:text-sm">
              {recentBookings.map((b) => (
                <li
                  key={b.id}
                  className="px-4 md:px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {b.listingTitle || "Listing"}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {formatDateTime(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-[13px]">
                      {ngn(b.amount)}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-semibold capitalize ${
                        isPaidOrConfirmed(b.status)
                          ? "bg-emerald-600/15 text-emerald-200 border border-emerald-500/30"
                          : isCancelledLike(b.status)
                          ? "bg-rose-600/15 text-rose-200 border border-rose-500/30"
                          : "bg-slate-500/15 text-slate-200 border border-slate-500/30"
                      }`}
                    >
                      {safeLower(b.status || "pending")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
