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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import VerifiedRoleBadge from "../components/VerifiedRoleBadge";

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

function Stat({ label, value, hint, onClick }) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center ${
        onClick
          ? "cursor-pointer hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400"
          : ""
      }`}
      title={onClick ? `View ${label.toLowerCase()}` : undefined}
    >
      <div className="text-[11px] tracking-wide text-white/60">{label}</div>
      <div className="font-extrabold text-white text-xl mt-1">{value}</div>
      {hint ? (
        <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>
      ) : null}
    </Cmp>
  );
}

function Field({ children }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white/90 focus-within:border-yellow-400 transition-colors">
      {children}
    </div>
  );
}

const Input = (props) => (
  <input
    {...props}
    className="w-full bg-transparent outline-none placeholder-white/30"
  />
);

const Select = (props) => (
  <select
    {...props}
    className="w-full bg-transparent outline-none placeholder-white/30"
  />
);

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
      <h3 className="text-xl font-bold text-white mb-2">
        No listings yet for this host
      </h3>
      <p className="text-white/70">
        Add your first Nesta stay to start earning.
      </p>
      <Link
        to="/post/new"
        className="inline-block mt-4 px-5 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500"
      >
        + New listing
      </Link>
    </div>
  );
}

export default function HostDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useUserProfile(user?.uid);

  // --- KYC status ---
  const kycStatusRaw =
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = kycStatusRaw.toLowerCase();
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

  // revenue stats
  const [rev, setRev] = useState({
    gross: 0,
    net: 0,
    bookingsConfirmed: 0,
    bookingsPending: 0,
    cancelled: 0,
    refunded: 0,
    needsAttention: 0,
  });

  const now = Date.now();
  const isSubscribed =
    subInfo.active &&
    (!subInfo.expiresAt || new Date(subInfo.expiresAt).getTime() > now);

  // --- Load host listings (owner / host) ---
  useEffect(() => {
    let alive = true;

    async function loadListings() {
      try {
        setLoading(true);
        setErr("");
        if (!user?.uid) return;

        const colRef = collection(db, "listings");
        const qref = query(
          colRef,
          where("ownerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(qref);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  // --- Subscription info (Host Pro) ---
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

  // --- Revenue for this host ---
  useEffect(() => {
    let alive = true;

    async function loadRevenue() {
      if (!user?.uid) return;
      try {
        const qref = query(
          collection(db, "bookings"),
          where("hostId", "==", user.uid)
        );
        const snap = await getDocs(qref);

        let gross = 0;
        let net = 0;
        let bookingsConfirmed = 0;
        let bookingsPending = 0;
        let cancelled = 0;
        let refunded = 0;

        snap.forEach((docu) => {
          const d = docu.data();
          const amt = Number(d.amountN || d.total || 0);
          const s = String(d.status || "").toLowerCase();

          const nestaFee = amt * 0.1;
          const hostTake = amt - nestaFee;

          if (["confirmed", "completed", "paid"].includes(s)) {
            gross += amt;
            net += hostTake;
            bookingsConfirmed++;
          } else if (
            s === "pending" ||
            s === "awaiting" ||
            s === "hold" ||
            s === "reserved_unpaid"
          ) {
            bookingsPending++;
          } else if (s === "cancelled") {
            cancelled++;
          } else if (s === "refunded") {
            refunded++;
          }
        });

        const needsAttention = bookingsPending + cancelled + refunded;

        if (alive) {
          setRev({
            gross,
            net,
            bookingsConfirmed,
            bookingsPending,
            cancelled,
            refunded,
            needsAttention,
          });
        }
      } catch (e) {
        console.error("Error loading host revenue:", e);
      }
    }

    loadRevenue();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // --- Filters / derived stats ---
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
    return filtered
      .filter(
        (l) => String(l.status || "active").toLowerCase() === "active"
      )
      .reduce((sum, l) => sum + Number(l.pricePerNight || 0), 0);
  }, [filtered]);

  const kpis = useMemo(() => {
    const active = filtered.filter(
      (r) => (r.status || "active").toLowerCase() === "active"
    ).length;
    return { active };
  }, [filtered]);

  const goManageListings = () => navigate("/manage-listings");
  const goReservations = () => navigate("/bookings");

  return (
    <main className="container mx-auto px-4 py-6 text-white">
      <button
        className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      {/* HEADER */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-extrabold text-yellow-400">
          Host Dashboard
        </h1>

        {/* KYC badge */}
        <VerifiedRoleBadge role="Host" verified={isKycApproved} />

        {/* Host Pro pill (unchanged) */}
        {!subInfo.loading && isSubscribed && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-300">
            Host Pro
            {subInfo.expiresAt
              ? ` • until ${new Date(
                  subInfo.expiresAt
                ).toLocaleDateString()}`
              : ""}
          </span>
        )}
      </div>

      <p className="text-white/70 mt-2 max-w-2xl">
        Manage your Nesta stay, see your bookings, and track what you’ve earned —
        all in one calm, luxury view.
      </p>

      {err && (
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {err}
        </div>
      )}

      {/* TOP KPI ROW */}
      <div className="mt-6 grid gap-3 grid-cols-1 md:grid-cols-4">
        <Stat
          label="Active listing(s)"
          value={kpis.active.toLocaleString()}
          hint="Your live stay on Nesta"
          onClick={goManageListings}
        />
        <Stat
          label="Confirmed bookings"
          value={rev.bookingsConfirmed.toLocaleString()}
          hint="Completed & paid"
          onClick={goReservations}
        />
        <Stat
          label="Pending / upcoming"
          value={rev.bookingsPending.toLocaleString()}
          hint="Awaiting payment or arrival"
          onClick={goReservations}
        />
        <Stat
          label="Total earnings (net)"
          value={ngn(rev.net)}
          hint="After Nesta fee"
          onClick={goReservations}
        />
      </div>

      {/* SECOND ROW */}
      <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-4">
        <Stat
          label="Needs attention"
          value={rev.needsAttention.toLocaleString()}
          hint="Pending / cancelled / refunded"
          onClick={goReservations}
        />
        <Stat
          label="Confirmed"
          value={rev.bookingsConfirmed.toLocaleString()}
          onClick={goReservations}
        />
        <Stat
          label="Cancelled"
          value={rev.cancelled.toLocaleString()}
          onClick={goReservations}
        />
        <Stat
          label="Refunded"
          value={rev.refunded.toLocaleString()}
          onClick={goReservations}
        />
      </div>

      {/* THIRD ROW */}
      <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
        <Stat
          label="Nightly portfolio"
          value={ngn(nightlyPortfolio)}
          hint="Across active listings"
          onClick={goManageListings}
        />
        <Stat
          label="Gross Revenue"
          value={ngn(rev.gross)}
          hint="Before Nesta fees"
          onClick={goReservations}
        />
      </div>

      {/* Actions + KYC label */}
      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={goManageListings}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
        >
          Manage your listing
        </button>
        <Link
          to="/post/new"
          className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500"
        >
          + New listing
        </Link>
        <div className="ml-auto text-white/60 text-sm">
          KYC: <strong>{kycStatusRaw || "approved"}</strong>
        </div>
      </div>

      {/* Listing filters */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3">
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
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Any status</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="review">under review</option>
          </Select>
        </Field>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setMin("");
            setMax("");
            setStatus("all");
          }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      {/* Portfolio cards */}
      <div className="mt-6">
        {loading ? (
          <p className="text-white/70">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <article
                key={l.id}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
              >
                <div className="h-36 bg-white/5 border-b border-white/10" />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-lg flex-1 truncate">
                      {l.title || "Untitled"}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/15 text-white/70 capitalize">
                      {l.status || "active"}
                    </span>
                  </div>
                  <div className="text-white/70 mt-1">
                    ₦{Number(l.pricePerNight || 0).toLocaleString()}/night •{" "}
                    {l.area || "—"}
                    <br />
                    {l.city || "—"}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      to={`/listing/${l.id}`}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-center hover:bg-white/15"
                    >
                      View
                    </Link>
                    <Link
                      to={`/listing/${l.id}/edit`}
                      className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold text-center hover:bg-yellow-500"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
