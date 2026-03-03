// src/pages/PartnerDashboard.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import axios from "axios";
import { getAuth } from "firebase/auth";

import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import { useToast } from "../context/ToastContext";

import "../styles/polish.css";
import "../styles/motion.css";

/* ===================== Formatting ===================== */
const formatNgn = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function toDateObj(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

function inLastDays(v, days = 30) {
  const d = toDateObj(v);
  if (!d || Number.isNaN(d.getTime())) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

function isAttentionStatus(statusRaw, row = {}) {
  const s = safeLower(statusRaw);

  const flags =
    !!row?.cancelRequested ||
    !!row?.cancellationRequested ||
    s === "cancel_request" ||
    s === "refund_requested" ||
    s === "date-change" ||
    s === "change-request" ||
    s === "paid-needs-review" ||
    !!row?.paymentMismatch;

  if (flags) return true;

  return [
    "pending",
    "hold",
    "hold-pending",
    "awaiting_payment",
    "reserved_unpaid",
    "change-request",
    "date-change",
    "cancel-request",
    "cancel_request",
    "refund_requested",
    "paid-needs-review",
  ].includes(s);
}

function normalizeBooking(d) {
  const data = d?.data ? d.data() : d;
  const id = d?.id || data?.id;

  const amount =
    Number(
      data.amountLockedN ??
        data.amountN ??
        data.total ??
        data.totalAmount ??
        data.amount ??
        0
    ) || 0;

  const listingTitle =
    data.listingTitle || data.listing?.title || data.title || "Listing";

  return {
    id,
    ...data,
    listingTitle,
    amount,
    createdAt: data.createdAt ?? data.created ?? data.created_on,
    checkIn: data.checkIn ?? data.checkin ?? data.startDate ?? data.from,
    checkOut: data.checkOut ?? data.checkout ?? data.endDate ?? data.to,
  };
}

/* ===================== API (same normalization you use elsewhere) ===================== */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
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
function Card({ title, sub, right, children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6 shadow-[0_18px_70px_rgba(0,0,0,0.55)] ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.28em] text-white/55 uppercase">{title}</div>
          {sub ? <div className="text-sm text-white/65 mt-2">{sub}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MiniKpi({ label, value, tone = "default" }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
      : tone === "rose"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-black/20 text-white/80";

  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <div className="text-[11px] tracking-[0.22em] uppercase opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function AccentButton({ children, onClick, disabled, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2 rounded-full text-sm border transition ${
        disabled
          ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
          : "bg-amber-500 border-amber-400 text-black font-semibold hover:bg-amber-400"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SoftButton({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm ${className}`}
    >
      {children}
    </button>
  );
}

export default function PartnerDashboard() {
  const nav = useNavigate();
  const location = useLocation();

  const { user, profile: authProfile } = useAuth();
  const uid = user?.uid || null;

  const { profile: liveProfile, loading: profileLoading } = useUserProfile();
  const profile = liveProfile || authProfile || {};

  const { showToast } = useToast();
  const notify = useCallback(
    (msg, type = "info") => {
      try {
        showToast?.(msg, type);
      } catch {}
    },
    [showToast]
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [myListings, setMyListings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);

  // Wallet (SERVER TRUTH) — same pattern as HostDashboard + Withdrawals
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

  // UI state (calm)
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  // partner commission (tolerate naming)
  const partnerCommissionPct =
    Number(
      profile?.partnerCommissionPct ??
        profile?.commissionPct ??
        profile?.commissionRatePct ??
        profile?.partnerCommission ??
        10
    ) || 10;

  const goAddListing = () => nav("/post/new");
  const goManageListings = () => nav("/manage-listings");
  const goViewListing = (listingId) => listingId && nav(`/listing/${listingId}`);
  const goReservationsAll = () => nav("/reservations?tab=all");
  const goReservationsAttention = () => nav("/reservations?tab=attention");
  const goInbox = () => nav("/inbox");

  const goWallet = () => {
    // Withdrawals page already handles policy truth and prompts setup/kyc, so it’s safe.
    nav("/withdrawals");
  };

  const load = useCallback(async () => {
    if (!uid) return;

    setLoading(true);
    setErr("");

    try {
      const lq = query(
        collection(db, "listings"),
        where("partnerUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(12)
      );

      const bq = query(
        collection(db, "bookings"),
        where("partnerUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(80)
      );

      const [ls, bs] = await Promise.all([getDocs(lq), getDocs(bq)]);

      const listings = ls.docs.map((d) => ({ id: d.id, ...d.data() }));
      const bookings = bs.docs.map((d) => normalizeBooking(d));

      setMyListings(listings);
      setMyBookings(bookings);
    } catch (e) {
      console.error("[PartnerDashboard] load failed:", e);
      setErr("Could not load partner dashboard right now.");
      setMyListings([]);
      setMyBookings([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const loadWallet = useCallback(async () => {
    if (!uid) {
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
      console.error("[PartnerDashboard] wallet load failed:", e);
      setWallet((w) => ({
        ...w,
        loading: false,
        canWithdraw: false,
        reason: e?.response?.data?.error || "Failed to load wallet",
      }));
    }
  }, [uid]);

  useEffect(() => {
    load();
    loadWallet();
  }, [load, loadWallet]);

  // optional refresh via query (?refresh=1)
  useEffect(() => {
    const sp = new URLSearchParams(location.search || "");
    const refresh = sp.get("refresh");
    if (refresh === "1") {
      (async () => {
        await Promise.all([load(), loadWallet()]);
        notify("Dashboard refreshed ✅", "success");
        sp.delete("refresh");
        nav({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : "" }, { replace: true });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const stats = useMemo(() => {
    const activeListings = myListings.length;

    const confirmed = myBookings.filter((b) =>
      ["confirmed", "paid", "completed", "released", "paid_pending_release"].includes(
        safeLower(b.status || "")
      )
    );

    const confirmed30 = confirmed.filter((b) => inLastDays(b.createdAt, 30));
    const revenue30 = confirmed30.reduce((sum, b) => sum + (b.amount || 0), 0);

    const attentionCount = myBookings.filter((b) => isAttentionStatus(b.status, b)).length;

    const partnerEarnings30 = (revenue30 * partnerCommissionPct) / 100;

    const recentBookings = myBookings.slice(0, 6);

    return {
      activeListings,
      confirmedCount: confirmed.length,
      revenue30,
      attentionCount,
      partnerEarnings30,
      recentBookings,
      totalBookings: myBookings.length,
    };
  }, [myListings, myBookings, partnerCommissionPct]);

  if (!user) {
    return (
      <main className="min-h-[70vh] px-4 py-6 text-white bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] motion-fade-in">
        <div className="max-w-5xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 motion-pop">
          <h2 className="text-2xl font-bold mb-2">Partner</h2>
          <p className="text-gray-300">Please sign in to view your dashboard.</p>
        </div>
      </main>
    );
  }

  const headerName = profile?.displayName || profile?.name || profile?.email || "Partner";

  const payoutLabel = wallet.payoutPreview?.bankName
    ? `${wallet.payoutPreview.bankName} ${wallet.payoutPreview.accountNumberMasked || ""}`.trim()
    : "No payout method yet";

  const canWithdraw = wallet.canWithdraw === true && Number(wallet.availableN || 0) > 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 pb-10 motion-fade-in">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap motion-slide-up">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.28em] text-amber-200/90 uppercase">
              Partner
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
              Partner Dashboard
            </h1>
            <p className="text-white/70 mt-2">
              A calm view of portfolio, bookings, and payouts — built for premium operations.
            </p>
            <p className="text-white/45 text-sm mt-2">
              Signed in as {headerName}
              {profileLoading ? (
                <span className="ml-2 text-[11px] text-white/35">(syncing…)</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <SoftButton onClick={goManageListings}>Manage listings</SoftButton>
            <SoftButton onClick={goReservationsAll}>Reservations</SoftButton>
            <SoftButton onClick={goInbox}>Inbox</SoftButton>
            <AccentButton onClick={goAddListing}>Add listing</AccentButton>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        {/* Above the fold: only 3 calm cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 motion-pop">
          <Card
            title="Portfolio"
            sub="Your partner listings and quick actions."
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi label="Active listings" value={stats.activeListings.toLocaleString("en-NG")} />
              <MiniKpi label="Bookings" value={stats.totalBookings.toLocaleString("en-NG")} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <SoftButton onClick={goManageListings}>View portfolio</SoftButton>
              <AccentButton onClick={goAddListing}>+ Add</AccentButton>
            </div>
          </Card>

          <Card
            title="Bookings"
            sub="Confirmed, pending signals, and attention queue."
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi label="Confirmed" value={stats.confirmedCount.toLocaleString("en-NG")} tone="emerald" />
              <MiniKpi label="Needs attention" value={stats.attentionCount.toLocaleString("en-NG")} tone="amber" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <SoftButton onClick={goReservationsAll}>Open reservations</SoftButton>
              <SoftButton onClick={goReservationsAttention}>Review attention</SoftButton>
            </div>
          </Card>

          <Card
            title="Wallet & payouts"
            sub="Server-truth balance with payout destination."
            right={
              <span className="text-[11px] text-white/50">
                Status: <span className="text-white/80 font-semibold">{String(wallet.payoutStatus || "—")}</span>
              </span>
            }
          >
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-white/65 text-sm">Available (withdrawable)</div>
                <div className="text-2xl font-semibold">
                  {wallet.loading ? "—" : formatNgn(wallet.availableN)}
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-white/55 text-xs">Pending (releases after check-in)</div>
                <div className="text-sm text-white/70">
                  {wallet.loading ? "—" : formatNgn(wallet.pendingN)}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/70">
                <div className="font-semibold text-white/80">Payout destination</div>
                <div className="mt-1">{payoutLabel}</div>
                <div className="mt-2 text-white/60">
                  {wallet.loading ? "Loading…" : wallet.canWithdraw === false ? (wallet.reason || "Withdrawals locked") : "Ready when available funds exist."}
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <SoftButton onClick={() => nav("/payout-setup")}>Payout setup</SoftButton>
                <AccentButton onClick={goWallet} disabled={!canWithdraw}>
                  Withdraw
                </AccentButton>
              </div>
            </div>
          </Card>
        </section>

        {/* Insights accordion */}
        <section className="rounded-3xl border border-white/10 bg-[#090c12] overflow-hidden motion-pop">
          <button
            onClick={() => setInsightsOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-white">Insights</div>
              <div className="text-xs text-white/50 mt-1">
                Revenue (30d), partner commission estimate, and key operational signals.
              </div>
            </div>
            <div className="text-white/70 text-sm">{insightsOpen ? "Hide" : "Show"} ▾</div>
          </button>

          {insightsOpen ? (
            <div className="px-5 pb-5">
              <div className="grid gap-3 md:grid-cols-3">
                <MiniKpi label="Revenue (30 days)" value={formatNgn(stats.revenue30)} />
                <MiniKpi label={`Est. earnings (30d) • ${partnerCommissionPct}%`} value={formatNgn(stats.partnerEarnings30)} tone="emerald" />
                <MiniKpi label="Attention queue" value={stats.attentionCount.toLocaleString("en-NG")} tone="amber" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <SoftButton onClick={goReservationsAll}>Open reservations →</SoftButton>
                <SoftButton onClick={goReservationsAttention}>Review attention →</SoftButton>
              </div>
            </div>
          ) : null}
        </section>

        {/* Listings + Recent bookings (recent collapsed) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 motion-pop">
          {/* Listings */}
          <div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.28em] text-white/55 uppercase">Listings</div>
                <h3 className="text-xl font-extrabold mt-1">Your portfolio</h3>
                <p className="text-white/60 text-sm mt-1">View and manage your partner listings.</p>
              </div>

              <div className="flex gap-2">
                <SoftButton onClick={goManageListings}>View all</SoftButton>
                <AccentButton onClick={goAddListing}>Add</AccentButton>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-white/60">Loading…</div>
            ) : myListings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-semibold">No listings yet.</p>
                <p className="text-white/60 text-sm mt-1">
                  Add your first listing to start receiving bookings.
                </p>
                <AccentButton onClick={goAddListing} className="mt-3">
                  Add listing
                </AccentButton>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {myListings.slice(0, 6).map((l) => (
                  <div
                    key={l.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {l.title || l.name || "Listing"}
                      </div>
                      <div className="text-xs text-white/55 mt-1 truncate">
                        {l.city || l.location || "—"} • {l.status || "active"}
                      </div>
                    </div>

                    <SoftButton onClick={() => goViewListing(l.id)}>View</SoftButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent bookings (collapsed) */}
          <div className="rounded-3xl border border-white/10 bg-[#090c12] overflow-hidden">
            <button
              onClick={() => setRecentOpen((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-semibold text-white">Recent bookings</div>
                <div className="text-xs text-white/50 mt-1">
                  Kept tidy — open only when needed.
                </div>
              </div>
              <div className="text-white/70 text-sm">{recentOpen ? "Hide" : "Show"} ▾</div>
            </button>

            {recentOpen ? (
              <div className="px-5 pb-5">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    Loading…
                  </div>
                ) : stats.recentBookings.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    No bookings yet.
                  </div>
                ) : (
                  <div className="space-y-3 mt-2">
                    {stats.recentBookings.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{b.listingTitle}</div>
                          <div className="text-xs text-white/55 mt-1 truncate">
                            {String(b.status || "pending")}
                            {isAttentionStatus(b.status, b) ? " • needs attention" : ""}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-semibold">{formatNgn(b.amount || 0)}</div>
                          <button
                            onClick={goReservationsAll}
                            className="mt-2 text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/15 hover:bg-white/10"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <SoftButton onClick={() => nav("/reservations?tab=upcoming")}>Upcoming</SoftButton>
                  <SoftButton onClick={() => nav("/reservations?tab=past")}>Past</SoftButton>
                  <SoftButton onClick={goReservationsAttention}>Attention</SoftButton>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="text-xs text-white/45">
          Contact details remain protected and reveal only when booking status and policy allow.
        </div>
      </div>
    </main>
  );
}