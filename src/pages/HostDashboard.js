// src/pages/HostDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/** Fallback demo data (shown if Firestore is empty or not wired yet) */
const sampleListings = [
  {
    id: "host-vi-loft",
    title: "Elegant Loft in Victoria Island",
    city: "Lagos",
    area: "Victoria Island",
    pricePerNight: 45000,
    status: "active",
    createdAt: { seconds: Date.now() / 1000 - 86400 * 2 },
  },
  {
    id: "host-woji-suite",
    title: "Quiet Suite in Woji",
    city: "Port Harcourt",
    area: "Woji",
    pricePerNight: 28000,
    status: "inactive",
    createdAt: { seconds: Date.now() / 1000 - 86400 * 5 },
  },
];

/** Optional fallback bookings—if Firestore bookings are not present */
const sampleBookings = [
  {
    id: "b1",
    listingId: "host-vi-loft",
    nights: 3,
    totalAmount: 135000,
    createdAt: { seconds: Date.now() / 1000 - 86400 * 1 },
  },
  {
    id: "b2",
    listingId: "host-vi-loft",
    nights: 2,
    totalAmount: 90000,
    createdAt: { seconds: Date.now() / 1000 - 86400 * 6 },
  },
];

export default function HostDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        if (!user) {
          setListings([]);
          setBookings([]);
          return;
        }

        // --- Listings by this host ---
        let results = [];
        try {
          const q1 = query(
            collection(db, "listings"),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const s1 = await getDocs(q1);
          s1.forEach((d) => results.push({ id: d.id, ...d.data() }));
        } catch {
          // ignore — index may be missing or schema differs
        }

        // If no results from Firestore, use sample
        if (results.length === 0) results = sampleListings;

        // --- Bookings for this host (optional) ---
        // If you store hostId on bookings:
        let bookingRows = [];
        try {
          const qb = query(
            collection(db, "bookings"),
            where("hostId", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const sb = await getDocs(qb);
          sb.forEach((d) => bookingRows.push({ id: d.id, ...d.data() }));
        } catch {
          // ignore
        }
        if (bookingRows.length === 0) bookingRows = sampleBookings;

        if (mounted) {
          setListings(results);
          setBookings(bookingRows);
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setErr("Could not load your host data right now.");
          setListings(sampleListings);
          setBookings(sampleBookings);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Filter listings
  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const kw = q.trim().toLowerCase();
      const matchQ =
        !kw ||
        (l.title || "").toLowerCase().includes(kw) ||
        (l.city || "").toLowerCase().includes(kw) ||
        (l.area || "").toLowerCase().includes(kw);

      const price = Number(l.pricePerNight || 0);
      const passMin = !min || price >= Number(min);
      const passMax = !max || price <= Number(max);
      const passStatus = status === "all" || (l.status || "active") === status;

      return matchQ && passMin && passMax && passStatus;
    });
  }, [listings, q, min, max, status]);

  // Quick booking metrics
  const bookingsByListing = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const arr = map.get(b.listingId) || [];
      arr.push(b);
      map.set(b.listingId, arr);
    });
    return map;
  }, [bookings]);

  const totals = useMemo(() => {
    const count = filtered.length;
    const activeCount = filtered.filter((l) => (l.status || "active") === "active").length;

    // Revenue projection (simple): sum of historic bookings (fallbacks used if no Firestore)
    const revenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

    // Occupancy hint (rough): bookings count for active listings
    const bookingCount = bookings.length;

    return {
      listings: count,
      activeListings: activeCount,
      bookingCount,
      revenue,
    };
  }, [filtered, bookings]);

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>

        <h1 style={{ margin: "16px 0 12px" }}>Host Dashboard</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Manage your listings, view booking activity, and keep tabs on revenue.
        </p>

        {err && <div className="alert-error" style={{ marginTop: 12 }}>{err}</div>}

        {/* Filters */}
        <div className="form-card" style={{ marginTop: 16 }}>
          <div
            className="filter-grid"
            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto" }}
          >
            <input
              type="text"
              placeholder="Search (title, city, area)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              type="number"
              placeholder="Min ₦/night"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              min={0}
            />
            <input
              type="number"
              placeholder="Max ₦/night"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              min={0}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setQ("");
                setMin("");
                setMax("");
                setStatus("all");
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Totals */}
        <div
          className="card"
          style={{
            marginTop: 8,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <Stat label="Your listings" value={totals.listings.toLocaleString()} />
          <Stat label="Active listings" value={totals.activeListings.toLocaleString()} />
          <Stat label="Total bookings" value={totals.bookingCount.toLocaleString()} />
          <Stat label="Revenue (historic)" value={`₦${totals.revenue.toLocaleString()}`} />
        </div>

        {/* Listings */}
        {loading ? (
          <p className="muted" style={{ marginTop: 18 }}>Loading your listings…</p>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="results-grid"
            style={{ marginTop: 18, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {filtered.map((l) => {
              const b = bookingsByListing.get(l.id) || [];
              const bookingCount = b.length;
              const revenue = b.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);

              return (
                <article key={l.id} className="listing-card">
                  <div
                    style={{
                      borderRadius: 12,
                      height: 140,
                      background: "rgba(255,255,255,0.06)",
                      marginBottom: 10,
                    }}
                  />
                  <h3>{l.title || "Untitled listing"}</h3>
                  <div className="muted" style={{ marginBottom: 10 }}>
                    ₦{Number(l.pricePerNight || 0).toLocaleString()}/night • {l.area || "—"}
                    <br />
                    {l.city || "—"} • {(l.status || "active")}
                  </div>

                  {/* tiny stats row */}
                  <div
                    className="fact-chip"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Bookings</div>
                      <div style={{ fontWeight: 700 }}>{bookingCount}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Revenue</div>
                      <div style={{ fontWeight: 700 }}>₦{revenue.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <Link className="btn view-btn" to={`/listing/${l.id}`}>View</Link>
                    <Link className="btn ghost" to={`/listing/${l.id}/edit`}>Edit</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <Link to="/post/new" className="btn">
            + Post a New Listing
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div
      className="fact-chip"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        textAlign: "center",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card" style={{ marginTop: 18, textAlign: "center", padding: 26 }}>
      <h2 style={{ marginTop: 0 }}>No listings yet</h2>
      <p className="muted">
        Create your first listing to start welcoming guests and earning on Nesta.
      </p>
      <Link to="/post/new" className="btn" style={{ marginTop: 10 }}>
        + Post a Listing
      </Link>
    </div>
  );
}