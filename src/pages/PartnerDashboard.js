// src/pages/PartnerDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import VerifiedRoleBadge from "../components/VerifiedRoleBadge";
import SubscriptionBanner from "../components/SubscriptionBanner";

const nf = new Intl.NumberFormat("en-NG");

function fmtMoney(n) {
  const num = Number(n || 0);
  return `₦${nf.format(Math.round(num))}`;
}

function fmtNum(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-NG");
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

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [err, setErr] = useState("");

  // raw listings and bookings for this partner
  const [listings, setListings] = useState([]);
  const [reservations, setReservations] = useState([]);

  // filters
  const [kw, setKw] = useState("");
  const [minN, setMinN] = useState("");
  const [maxN, setMaxN] = useState("");
  const [status, setStatus] = useState("all");

  // ---- KYC status for partner ----
  const kycStatusRaw = profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = String(kycStatusRaw).toLowerCase();
  const isKycApproved = kycStatus === "approved" || kycStatus === "verified" || kycStatus === "complete";

  // subscription (Partner Pro)
  const [subInfo, setSubInfo] = useState({
    active: false,
    expiresAt: null,
    loading: true,
  });
  const now = Date.now();
  const isSubscribed =
    subInfo.active && (!subInfo.expiresAt || new Date(subInfo.expiresAt).getTime() > now);

  const recentBookings = useMemo(() => reservations.slice(0, 5), [reservations]);

  // ---------- LOAD LISTINGS ----------
  useEffect(() => {
    let alive = true;
    if (!user?.uid) return;

    (async () => {
      try {
        setLoadingListings(true);
        setErr("");

        const colRef = collection(db, "listings");

        // Primary: partnerUid
        let out = [];
        try {
          const qRef = query(colRef, where("partnerUid", "==", user.uid), orderBy("createdAt", "desc"));
          const snap = await getDocs(qRef);
          snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        } catch (e) {
          // If index missing for orderBy, fallback without orderBy
          console.warn("[PartnerDashboard] partnerUid ordered query failed, retry without orderBy:", e?.message);
          const qRef = query(colRef, where("partnerUid", "==", user.uid));
          const snap = await getDocs(qRef);
          snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        }

        // ✅ Fallback: managers array (you set managers: [uid] in CreateListing partners)
        if (out.length === 0) {
          try {
            const qRef2 = query(colRef, where("managers", "array-contains", user.uid), orderBy("createdAt", "desc"));
            const snap2 = await getDocs(qRef2);
            snap2.forEach((d) => out.push({ id: d.id, ...d.data() }));
          } catch (e) {
            console.warn("[PartnerDashboard] managers ordered query failed, retry without orderBy:", e?.message);
            const qRef2 = query(colRef, where("managers", "array-contains", user.uid));
            const snap2 = await getDocs(qRef2);
            snap2.forEach((d) => out.push({ id: d.id, ...d.data() }));
          }
        }

        // de-dupe by id
        const map = new Map();
        out.forEach((x) => map.set(x.id, x));
        const unique = Array.from(map.values());

        if (alive) setListings(unique);
      } catch (e) {
        console.error(e);
        if (alive) {
          setErr("Could not load your portfolio listings.");
          setListings([]);
        }
      } finally {
        if (alive) setLoadingListings(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // ---------- LOAD BOOKINGS / STATS ----------
  useEffect(() => {
    let alive = true;
    if (!user?.uid) return;

    (async () => {
      try {
        setLoadingStats(true);
        setErr("");

        const qRef = query(
          collection(db, "bookings"),
          where("partnerUid", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(200)
        );
        const snap = await getDocs(qRef);
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        if (alive) setReservations(out);
      } catch (e) {
        console.error(e);
        if (alive) {
          setErr("Could not load your partner stats.");
          setReservations([]);
        }
      } finally {
        if (alive) setLoadingStats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // ---------- SUBSCRIPTION INFO (Partner Pro) ----------
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

  // ---------- COMPUTED STATS ----------
  const stats = useMemo(() => {
    const s = {
      portfolioUnits: 0,
      portfolioNightly: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      cancelled: 0,
      refunded: 0,
      needsAttention: 0,
      grossRevenue: 0,
      partnerEarnings: 0,
      nestaCommission: 0,
    };

    const activeListings = listings.filter((l) => (l.status || "active").toLowerCase() === "active");
    s.portfolioUnits = activeListings.length;
    s.portfolioNightly = activeListings.reduce((acc, l) => acc + Number(l.pricePerNight || l.price || 0), 0);

    reservations.forEach((r) => {
      const status = String(r.status || "").toLowerCase();
      const total = Number(r.totalAmount || r.total || r.amountN || 0);
      const partnerTake = Number(r.partnerPayout || r.partnerShare || r.partnerAmount || 0);
      const nestaTake = Number(r.nestaFee || r.platformFee || r.commissionNesta || 0);

      if (status === "confirmed" || status === "completed" || status === "paid") {
        s.confirmedBookings += 1;
        s.grossRevenue += total;
        s.partnerEarnings += partnerTake || total * 0.9;
        s.nestaCommission += nestaTake || total * 0.1;
      } else if (status === "pending" || status === "upcoming" || status === "reserved_unpaid" || status === "awaiting_payment") {
        s.pendingBookings += 1;
      } else if (status === "cancelled" || status === "canceled") {
        s.cancelled += 1;
      } else if (status === "refunded") {
        s.refunded += 1;
      }

      if (status === "pending" || status === "cancelled" || status === "canceled" || status === "refunded") {
        s.needsAttention += 1;
      }
    });

    return s;
  }, [listings, reservations]);

  // ---------- FILTERED LISTINGS ----------
  const filteredListings = useMemo(() => {
    const text = kw.trim().toLowerCase();
    const min = minN ? Number(minN) : null;
    const max = maxN ? Number(maxN) : null;

    return listings.filter((l) => {
      const price = Number(l.pricePerNight || l.price || 0);
      const st = String(l.status || "active").toLowerCase();

      const matchStatus = status === "all" || st === status;
      const matchText =
        !text ||
        (l.title || "").toLowerCase().includes(text) ||
        (l.city || "").toLowerCase().includes(text) ||
        (l.area || "").toLowerCase().includes(text);

      const okMin = min == null || price >= min;
      const okMax = max == null || price <= max;

      return matchStatus && matchText && okMin && okMax;
    });
  }, [listings, kw, minN, maxN, status]);

  const resetFilters = () => {
    setKw("");
    setMinN("");
    setMaxN("");
    setStatus("all");
  };

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-12 px-4 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* DEBUG LINE */}
        <div className="text-[11px] text-white/45">
          Loaded portfolio listings: <span className="text-white/70 font-semibold">{listings.length}</span>
        </div>

        {/* Header / hero */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Partner Dashboard</h1>
            <p className="text-white/70 max-w-2xl mt-2 text-sm md:text-base">
              Manage bulk/portfolio listings, monitor reservations, and track{" "}
              <span className="font-semibold">partner earnings</span> in one calm, luxury view.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <VerifiedRoleBadge role="Partner" verified={isKycApproved} />
            <SubscriptionBanner />
            {!subInfo.loading && isSubscribed && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs md:text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold">Partner Pro</span>
                {subInfo.expiresAt && (
                  <span className="opacity-70">• until {new Date(subInfo.expiresAt).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        </header>

        {!isKycApproved && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 flex items-center justify-between gap-3">
            <p>
              <span className="font-semibold">KYC pending:</span> complete your verification to unlock full portfolio visibility and trust.
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
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</div>
        )}

        <section className="rounded-3xl border border-white/5 bg-[#090b10] px-4 py-3 text-sm text-white/70">
          No payouts yet. Once bookings complete and clear payout windows, your partner earnings will surface here.
        </section>

        {/* STATS GRID */}
        <section className="grid gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-6">
          <CardStat label="Portfolio units" value={stats.portfolioUnits} helper="Active listings you manage" />
          <CardStat label="Confirmed bookings" value={stats.confirmedBookings} helper="Completed / paid" />
          <CardStat label="Pending bookings" value={stats.pendingBookings} helper="Awaiting payment or arrival" />
          <CardStat label="Portfolio value (Nightly)" currency value={stats.portfolioNightly} helper="Across active listings" />
          <CardStat label="Gross revenue" currency value={stats.grossRevenue} helper="Confirmed / paid bookings" />
          <CardStat label="Partner earnings" currency value={stats.partnerEarnings} helper="After Nesta fee (est.)" />
        </section>

        <section className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CardStat label="Needs attention" value={stats.needsAttention} helper="Pending / cancelled / refunded" tone="amber" />
          <CardStat label="Cancelled" value={stats.cancelled} />
          <CardStat label="Refunded" value={stats.refunded} />
          <CardStat label="Commission (Nesta est.)" currency value={stats.nestaCommission} helper="Estimated Nesta share" />
        </section>

        {/* ACTION BAR */}
        <section className="flex flex-wrap items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate("/manage-listings")}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
          >
            Manage Inventory
          </button>

          <button
            type="button"
            onClick={() => navigate("/reservations")}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
          >
            View reservations
          </button>

          <Link to="/post/new" className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400">
            + Add Inventory
          </Link>

          <button
            type="button"
            disabled={!isKycApproved}
            onClick={() => navigate("/withdrawals")}
            className={`ml-auto px-5 py-2 rounded-xl text-sm font-semibold transition ${
              isKycApproved ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-white/5 border border-white/15 text-white/40 cursor-not-allowed"
            }`}
            title={!isKycApproved ? "Complete KYC to withdraw earnings" : undefined}
          >
            Withdraw earnings
          </button>
        </section>

        {/* FILTERS */}
        <section className="rounded-3xl bg-[#090c12] border border-white/5 p-4 md:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="Search (title, city, area)…"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-400/70"
            />
            <input
              type="number"
              min={0}
              value={minN}
              onChange={(e) => setMinN(e.target.value)}
              placeholder="Min ₦/night"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-400/70"
            />
            <input
              type="number"
              min={0}
              value={maxN}
              onChange={(e) => setMaxN(e.target.value)}
              placeholder="Max ₦/night"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-400/70"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/70"
            >
              <option value="all">Any status</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="review">under review</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </section>

        {/* LISTING GRID */}
        <section className="mt-4">
          {loadingListings ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-6 text-center">
              <h2 className="text-lg font-semibold mb-1">No inventory yet</h2>
              <p className="text-sm text-gray-200">Add your first portfolio or bulk units to start earning.</p>
              <Link
                to="/post/new"
                className="inline-flex mt-4 px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400"
              >
                + Add inventory
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((l) => {
                const price = Number(l.pricePerNight || l.price || 0);
                const st = String(l.status || "active").toLowerCase();
                const tag = l.channelLabel || l.hostType || "Partner-managed";
                const img = (Array.isArray(l.imageUrls) && l.imageUrls[0]) || l.primaryImageUrl || null;

                return (
                  <article
                    key={l.id}
                    className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden hover:border-amber-300/60 hover:-translate-y-1 transition-all duration-200 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
                  >
                    <div className="relative h-40 bg-black/40 overflow-hidden">
                      {img ? (
                        <img src={img} alt={l.title || "Listing"} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#202736] via-[#151924] to-black/90" />
                      )}

                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black/70 border border-white/20 backdrop-blur">
                          {tag}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] border backdrop-blur ${
                            st === "active"
                              ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-100"
                              : st === "inactive"
                              ? "bg-white/10 border-white/25 text-white/80"
                              : "bg-amber-500/20 border-amber-300/70 text-amber-100"
                          }`}
                        >
                          {st}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{l.title || "Portfolio unit"}</h3>
                        <p className="text-xs md:text-sm text-white/70 truncate">
                          {(l.area || "—") + (l.city ? ` • ${l.city}` : "")}
                        </p>
                      </div>

                      <p className="text-lg font-bold mt-1">
                        ₦{nf.format(price)}
                        <span className="text-xs text-gray-400 ml-1">/ night</span>
                      </p>

                      <div className="flex gap-2 mt-3">
                        <Link
                          to={`/listing/${l.id}`}
                          className="flex-1 text-center px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-sm hover:bg-white/15"
                        >
                          View
                        </Link>
                        <Link
                          to={`/listing/${l.id}/edit`}
                          className="flex-1 text-center px-3 py-1.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* RECENT BOOKINGS STRIP (Partner) */}
        <section className="mt-6 rounded-3xl bg-[#090c12] border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3">
            <h2 className="text-sm md:text-base font-semibold">Recent bookings</h2>
            <button onClick={() => navigate("/reservations")} className="text-xs md:text-sm text-white/60 hover:text-white">
              Open reservations →
            </button>
          </div>
          {recentBookings.length === 0 ? (
            <div className="px-4 md:px-5 pb-4 text-xs text-white/45">No bookings yet tied to this partner.</div>
          ) : (
            <ul className="divide-y divide-white/5 text-xs md:text-sm">
              {recentBookings.map((b) => {
                const status = String(b.status || "pending").toLowerCase();
                const amount = b.totalAmount || b.total || b.amountN || 0;
                const listingTitle = b.listingTitle || b.listing?.title || b.title || "Listing";

                return (
                  <li key={b.id} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{listingTitle}</p>
                      <p className="text-[11px] text-white/45">{formatDateTime(b.createdAt?.toDate?.() || b.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-[13px]">{fmtMoney(amount)}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold capitalize ${
                          status === "confirmed" || status === "paid"
                            ? "bg-emerald-600/15 text-emerald-200 border border-emerald-500/30"
                            : status === "cancelled" || status === "canceled"
                            ? "bg-rose-600/15 text-rose-200 border border-rose-500/30"
                            : "bg-slate-500/15 text-slate-200 border border-slate-500/30"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- Small reusable components ---------- */

function CardStat({ label, value, helper, currency = false, tone }) {
  const safeValue = typeof value === "number" ? value : Number(value || 0) || 0;
  const formatted = currency ? fmtMoney(safeValue) : fmtNum(safeValue);

  const toneClasses = tone === "amber" ? "border-amber-400/40 bg-amber-500/10" : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-2xl px-4 py-3 border ${toneClasses} flex flex-col justify-between min-h-[84px]`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{formatted}</div>
      {helper && <div className="mt-1 text-[11px] text-white/55 truncate">{helper}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.25)] animate-pulse">
      <div className="h-40 bg-white/5" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="h-5 bg-white/10 rounded w-1/3 mt-2" />
        <div className="flex gap-2 mt-3">
          <div className="h-8 bg-white/5 rounded-xl flex-1" />
          <div className="h-8 bg-white/5 rounded-xl flex-1" />
        </div>
      </div>
    </div>
  );
}
