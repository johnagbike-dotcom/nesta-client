// src/pages/PartnerDashboard.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import "../styles/polish.css";
import "../styles/motion.css";

const formatNgn = (n) => `₦${Number(n || 0).toLocaleString()}`;

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
  if (!d || isNaN(d.getTime())) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

function isAttentionStatus(statusRaw, row = {}) {
  const s = String(statusRaw || "").toLowerCase();

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

export default function PartnerDashboard() {
  const nav = useNavigate();

  const { user, profile: authProfile } = useAuth();
  const uid = user?.uid || null;

  // live profile (hook signature = no args)
  const { profile: liveProfile, loading: profileLoading } = useUserProfile();
  const profile = liveProfile || authProfile || {};

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [myListings, setMyListings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);

  // payout setup flag (tolerate different naming)
  const payoutSetupDone =
    !!profile?.payoutSetupDone ||
    !!profile?.payoutConfigured ||
    !!profile?.payoutReady ||
    !!profile?.payoutSetupComplete;

  // wallet available (tolerate different naming)
  const walletBalanceN =
    Number(
      profile?.walletBalanceN ??
        profile?.wallet?.balanceN ??
        profile?.balanceN ??
        profile?.wallet?.available ??
        0
    ) || 0;

  // partner commission (tolerate naming)
  const partnerCommissionPct =
    Number(
      profile?.partnerCommissionPct ??
        profile?.commissionPct ??
        profile?.commissionRatePct ??
        profile?.partnerCommission ??
        10
    ) || 10;

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
        limit(50)
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

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const activeListings = myListings.length;

    const confirmed = myBookings.filter((b) =>
      ["confirmed", "paid", "completed"].includes(String(b.status || "").toLowerCase())
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
    };
  }, [myListings, myBookings, partnerCommissionPct]);

  // ROUTES
  const goAddListing = () => nav("/post/new");
  const goManageListings = () => nav("/manage-listings");

  // ✅ View a specific listing (instead of "manage all")
  // Assumes your public listing details route is /listing/:id
  const goViewListing = (listingId) => {
    if (!listingId) return;
    nav(`/listing/${listingId}`);
  };

  const goReservationsAll = () => nav("/reservations?tab=all");
  const goReservationsAttention = () => nav("/reservations?tab=attention");
  const goInbox = () => nav("/inbox");

  // ✅ Wallet UX:
  // - Partner clicks Wallet/Withdraw => if setup missing, route to setup.
  // - Otherwise route to withdrawals (wallet page).
  const goWallet = () => {
    if (!payoutSetupDone) return nav("/payout-setup");
    return nav("/withdrawals");
  };

  const canWithdraw = payoutSetupDone && walletBalanceN > 0;

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4 pb-10 motion-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6 motion-slide-up">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.28em] text-amber-200/90 uppercase">
              Partner
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
              Partner Dashboard
            </h1>
            <p className="text-white/70 mt-2">
              Manage listings, reservations, wallet and partner operations.
            </p>
            <p className="text-white/45 text-sm mt-2">
              Signed in as {headerName}
              {profileLoading ? <span className="ml-2 text-[11px] text-white/35">(syncing…)</span> : null}
            </p>
          </div>

          {/* Primary actions (no duplicates) */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={goManageListings}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              Manage listings
            </button>

            <button
              onClick={goReservationsAll}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              Reservations
            </button>

            <button
              onClick={goWallet}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              Wallet &amp; withdrawals
            </button>

            <button
              onClick={goAddListing}
              className="px-5 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
            >
              Add listing
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        {/* KPI cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 motion-pop">
          <KpiCard
            label="Active listings"
            value={stats.activeListings}
            sub="Listings under your partner portfolio."
          />
          <KpiCard
            label="Confirmed bookings"
            value={stats.confirmedCount}
            sub="Confirmed/paid bookings count."
          />
          <KpiCard
            label="Revenue (30 days)"
            value={formatNgn(stats.revenue30)}
            sub="Confirmed bookings in the last 30 days."
          />
        </section>

        {/* Wallet & earnings (no duplicate buttons) */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6 mb-6 motion-pop">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.28em] text-white/50 uppercase">
                Wallet & earnings
              </div>
              <h2 className="text-2xl font-extrabold mt-1">Partner earnings</h2>
              <p className="text-white/65 mt-1">
                Withdraw triggers payout setup only when needed.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-white/55">Partner commission</div>
              <div className="text-lg font-extrabold text-amber-200">
                {partnerCommissionPct}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <StatPill label="Wallet balance (available)" value={formatNgn(walletBalanceN)} />
            <StatPill label="Est. partner earnings (30d)" value={formatNgn(stats.partnerEarnings30)} />
            <StatPill
              label="Payout status"
              value={payoutSetupDone ? "Set" : "Not set"}
              tone={payoutSetupDone ? "ok" : "warn"}
            />
          </div>

          {/* Single entry point + withdraw (no extra payout setup button) */}
          <div className="flex flex-wrap gap-2 mt-4 items-center">
            <button
              onClick={goWallet}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              Wallet &amp; withdrawals
            </button>

            <button
              onClick={goWallet}
              className={`ml-auto px-5 py-2 rounded-full text-sm border transition ${
                canWithdraw
                  ? "bg-amber-500 border-amber-400 text-black font-semibold hover:bg-amber-400"
                  : "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
              }`}
              disabled={!canWithdraw}
              title={
                !payoutSetupDone
                  ? "Complete payout setup first (opens automatically when you click Wallet)"
                  : walletBalanceN <= 0
                  ? "No available balance to withdraw"
                  : "Withdraw"
              }
            >
              Withdraw
            </button>
          </div>
        </section>

        {/* Needs attention */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6 mb-6 motion-pop">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] tracking-[0.28em] text-amber-200/80 uppercase">
                Needs attention
              </div>
              <h2 className="text-2xl font-extrabold mt-1">Bookings to review</h2>
              <p className="text-white/65 mt-1">
                Date changes, cancellations, mismatches and holds are grouped here.
              </p>
            </div>

            <button
              onClick={goReservationsAll}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
            >
              Open bookings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <ActionCard
              title="Needs attention"
              count={stats.attentionCount}
              desc="View bookings flagged for review."
              cta="Review attention"
              onClick={goReservationsAttention}
            />
            <ActionCard
              title="All reservations"
              count={myBookings.length}
              desc="All partner bookings in one place."
              cta="Open reservations"
              onClick={goReservationsAll}
            />
            <ActionCard
              title="Inbox"
              count={null}
              desc="Reply to guests and hosts quickly."
              cta="Open inbox"
              onClick={goInbox}
            />
          </div>
        </section>

        {/* Listings + Recent bookings */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 motion-pop">
          {/* Listings */}
          <div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.28em] text-white/50 uppercase">
                  Listings
                </div>
                <h3 className="text-xl font-extrabold mt-1">Your portfolio</h3>
                <p className="text-white/60 text-sm mt-1">
                  Add, edit and manage your partner listings.
                </p>
              </div>

              <button
                onClick={goManageListings}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
              >
                View all
              </button>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-white/60">Loading…</div>
            ) : myListings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-semibold">No listings yet.</p>
                <p className="text-white/60 text-sm mt-1">
                  Add your first listing to start receiving bookings.
                </p>
                <button
                  onClick={goAddListing}
                  className="mt-3 px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
                >
                  Add listing
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
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

                    {/* ✅ Open now views that specific listing */}
                    <button
                      onClick={() => goViewListing(l.id)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
                      title="View listing"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent bookings */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.28em] text-white/50 uppercase">
                  Recent bookings
                </div>
                <h3 className="text-xl font-extrabold mt-1">Activity</h3>
                <p className="text-white/60 text-sm mt-1">
                  Quick view before you open reservations.
                </p>
              </div>
              <button
                onClick={goReservationsAll}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
              >
                View all
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Loading…
                </div>
              ) : stats.recentBookings.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No bookings yet.
                </div>
              ) : (
                stats.recentBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{b.listingTitle}</div>
                      <div className="text-xs text-white/55 mt-1 truncate">
                        {String(b.status || "pending")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatNgn(b.amount || 0)}</div>
                      <button
                        onClick={goReservationsAll}
                        className="mt-2 text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/15 hover:bg-white/10"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => nav("/reservations?tab=upcoming")}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
              >
                Upcoming
              </button>
              <button
                onClick={() => nav("/reservations?tab=past")}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
              >
                Past
              </button>
              <button
                onClick={goReservationsAttention}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
              >
                Attention
              </button>
            </div>
          </div>
        </section>

        <div className="text-xs text-white/45 mt-5">
          Contact details stay hidden by policy; they reveal only when booking status and subscription permit.
        </div>
      </div>
    </main>
  );
}

/* ---------- small UI bits ---------- */

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
      <div className="text-[11px] tracking-[0.28em] text-white/55 uppercase">
        {label}
      </div>
      <div className="text-3xl font-extrabold mt-2">{value}</div>
      <div className="text-sm text-white/60 mt-2">{sub}</div>
    </div>
  );
}

function StatPill({ label, value, tone }) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : tone === "warn"
      ? "border-amber-400/30 bg-amber-500/10"
      : "border-white/10 bg-black/20";

  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <div className="text-xs text-white/55">{label}</div>
      <div className="text-lg font-extrabold mt-1">{value}</div>
    </div>
  );
}

function ActionCard({ title, desc, cta, onClick, count }) {
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-white/70 mt-1">{desc}</div>
        </div>
        {typeof count === "number" ? (
          <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/15 bg-black/20 text-[11px]">
            {count}
          </span>
        ) : null}
      </div>

      <button
        onClick={onClick}
        className="mt-4 w-full px-4 py-2 rounded-full bg-black/20 border border-white/15 hover:bg-black/30 text-sm font-semibold"
      >
        {cta}
      </button>
    </div>
  );
}
