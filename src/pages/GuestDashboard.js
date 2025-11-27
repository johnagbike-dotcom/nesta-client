// src/pages/GuestDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import KycBanner from "../components/KycBanner";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import FavButton from "../components/FavButton";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import { expireStaleBookings } from "../api/bookings";

const CITY_CHIPS = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Owerri"];
const PAGE_SIZE = 12;

export default function GuestDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const role = (profile?.role || "").toLowerCase();
  const isGuest = !role || role === "guest";
  const isHostOrPartner = role === "host" || role === "partner";

  // Filters
  const [qText, setQText] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [city, setCity] = useState("");

  // Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cursors, setCursors] = useState([]);
  // Auto expire
    useEffect(() => {
  expireStaleBookings();
}, []);
  // Reset paging when filters change
  useEffect(() => {
    setPage(1);
    setCursors([]);
    setTotalPages(1);
  }, [city, min, max]);

  // Load current page when page or filters change
  useEffect(() => {
    loadPage(page);
   
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, city, min, max]);

  // Count docs for pagination
  useEffect(() => {
    (async () => {
      try {
        const { qRef } = await buildQuery({ justForCount: true });
        const snap = await getCountFromServer(qRef);
        const count = snap.data().count || 0;
        setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
      } catch (e) {
        console.warn("[GuestDashboard] count failed", e);
        setTotalPages(1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, min, max]);

  // Build query
  async function buildQuery({ after = null, justForCount = false }) {
    const base = collection(db, "listings");
    const hasMin = min !== "" && !Number.isNaN(Number(min));
    const hasMax = max !== "" && !Number.isNaN(Number(max));
    const clauses = [];
    if (city) clauses.push(where("city", "==", city));
    if (hasMin) clauses.push(where("pricePerNight", ">=", Number(min)));
    if (hasMax) clauses.push(where("pricePerNight", "<=", Number(max)));
    const needsPriceOrder = hasMin || hasMax;

    if (justForCount) {
      const qRef = needsPriceOrder
        ? query(base, ...clauses, orderBy("pricePerNight", "asc"))
        : query(base, ...clauses, orderBy("createdAt", "desc"));
      return { qRef };
    }

    const qRef = needsPriceOrder
      ? query(
          base,
          ...clauses,
          orderBy("pricePerNight", "asc"),
          ...(after ? [startAfter(after)] : []),
          limit(PAGE_SIZE)
        )
      : query(
          base,
          ...clauses,
          orderBy("createdAt", "desc"),
          ...(after ? [startAfter(after)] : []),
          limit(PAGE_SIZE)
        );
    return { qRef };
  }

  // Load a specific page
  async function loadPage(toPage) {
    setLoading(true);
    setErr("");
    try {
      const startCursor = toPage > 1 ? cursors[toPage - 2] || null : null;
      const { qRef } = await buildQuery({ after: startCursor });
      const snap = await getDocs(qRef);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data(), __doc: d }));
      setRows(docs);

      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      setCursors((prev) => {
        const copy = [...prev];
        copy[toPage - 1] = lastDoc;
        return copy;
      });
    } catch (e) {
      console.error("[GuestDashboard] loadPage error", e);
      setErr(
        "Couldn't load listings. If the console shows a Firestore index URL, open it to auto-create the index, then refresh."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Client-side keyword filter
  const filtered = useMemo(() => {
    const kw = qText.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((l) => {
      const title = (l.title || "").toLowerCase();
      const area = (l.area || "").toLowerCase();
      const cityL = (l.city || "").toLowerCase();
      return title.includes(kw) || area.includes(kw) || cityL.includes(kw);
    });
  }, [rows, qText]);

  const resetAll = () => {
    setQText("");
    setMin("");
    setMax("");
    setCity("");
  };

  return (
    <main style={pageWrap}>
      <div className="container dash-wrap">
        <KycBanner />
        <button className="btn ghost" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>
          ← Back
        </button>

        {/* HERO */}
        <div style={heroWrap}>
          <div>
            <h2 style={heroTitle}>Explore Stays</h2>
            <p style={heroSub}>Curated luxury apartments and suites — refined for comfort.</p>
          </div>

          {/* Quick city chips */}
          <div style={chipRow}>
            {CITY_CHIPS.map((c) => {
              const active = city === c;
              return (
                <button
                  key={c}
                  className="btn"
                  onClick={() => setCity(active ? "" : c)}
                  style={chip(active)}
                >
                  {c}
                </button>
              );
            })}
            <div style={{ marginLeft: "auto" }}>
              <button className="btn ghost" onClick={() => setCity("")} style={linkGhost}>
                Explore all →
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={filtersRow}>
            <input
              className="input"
              placeholder="Search (title, city, area)"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              style={darkInput}
            />
            <select
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={darkSelect}
            >
              <option value="">Any city</option>
              {CITY_CHIPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              placeholder="Min ₦/night"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              style={darkInput}
            />
            <input
              className="input"
              type="number"
              placeholder="Max ₦/night"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              style={darkInput}
            />
            <button className="btn ghost" onClick={resetAll}>
              Reset
            </button>
          </div>
        </div>

        {/* Error */}
        {err && <div style={errorBanner}>{err}</div>}

        {/* Results */}
        {loading ? (
          <div style={gridWrap}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={skeletonCard} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p style={muted}>No listings on this page match your search.</p>
        ) : (
          <>
            <div style={gridWrap}>
              {filtered.map((l) => {
                const price = Number(l.pricePerNight || 0);
                const img = l.imageUrl || (Array.isArray(l.images) ? l.images[0] : null);
                const rating = Number(l.rating || l.ratingsAvg || 4.8);
                const partnerUid = l.partnerUid || l.hostUid || "";
                return (
                  <article key={l.id} style={card}>
                    <div
                      style={{
                        ...thumb,
                        background: img
                          ? `url(${img}) center/cover no-repeat`
                          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                      }}
                    />
                    <h3 style={titleRow}>
                      <span>{l.title || "Untitled"}</span>
                      {l.featured ? <Badge>Featured</Badge> : null}
                      {l.isFeatured ? <Badge>Staff pick</Badge> : null}
                    </h3>
                    <div style={metaLine}>
                      <span style={{ fontWeight: 700 }}>₦{price.toLocaleString()}</span>
                      <span style={{ opacity: 0.8 }}>/night</span>
                      <span style={{ opacity: 0.8, marginLeft: 10 }}>
                        • {l.city || "—"}{l.area ? ` • ${l.area}` : ""}
                      </span>
                    </div>
                    <div style={ratingLine}>
                      <Stars value={rating} />
                      <span style={{ marginLeft: 6, opacity: 0.9 }}>{rating.toFixed(1)}</span>
                    </div>

                    {/* CTA row */}
                    <div style={{ ...ctaRow, justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Link className="btn" to={`/listing/${l.id}`} style={btnSecondary}>
                          View
                        </Link>

                        {isGuest ? (
                          <>
                            <Link
                              className="btn"
                              to={`/reserve/${l.id}`}
                              state={{ listing: { id: l.id, title: l.title, pricePerNight: l.pricePerNight, hostId: l.hostUid || l.ownerId, city: l.city, area: l.area } }}
                              style={btnPrimary}
                            >
                              Reserve
                            </Link>
                            {partnerUid ? (
                              <Link
                                className="btn"
                                to={`/chat/${partnerUid}`}
                                state={{ listingId: l.id, listingTitle: l.title, hostId: l.hostUid, partnerUid: l.partnerUid }}
                                style={btnGhost}
                              >
                                {l.partnerUid ? "Chat Partner" : "Chat Host"}
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          // Host/Partner experience: manage own stock; no Reserve / no Favourite
                          <>
                            <Link className="btn" to={`/listing/${l.id}/edit`} style={btnPrimary}>
                              Edit
                            </Link>
                          </>
                        )}
                      </div>

                      {isGuest ? <FavButton listingId={l.id} /> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>
    </main>
  );
}

/* ---------------- Pagination ---------------- */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const windowSize = 7;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div style={pagerWrap}>
      <button className="btn" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} style={pagerBtn}>
        ← Prev
      </button>
      {start > 1 && (
        <>
          <button className="btn" onClick={() => onPage(1)} style={numBtn(page === 1)}>1</button>
          {start > 2 && <span style={{ opacity: 0.6, margin: "0 6px" }}>…</span>}
        </>
      )}
      {nums.map((n) => (
        <button key={n} className="btn" onClick={() => onPage(n)} style={numBtn(page === n)}>
          {n}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ opacity: 0.6, margin: "0 6px" }}>…</span>}
          <button className="btn" onClick={() => onPage(totalPages)} style={numBtn(page === totalPages)}>
            {totalPages}
          </button>
        </>
      )}
      <button className="btn" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pagerBtn}>
        Next →
      </button>
    </div>
  );
}

/* ---------------- UI atoms ---------------- */
function Badge({ children }) {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        fontSize: 12,
        borderRadius: 999,
        border: "1px solid rgba(212,175,55,0.55)",
        color: "#d4af37",
        background: "rgba(212,175,55,0.10)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
function Stars({ value = 4.8 }) {
  const out = [];
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    let fill = i < full ? 1 : i === full && hasHalf ? 0.5 : 0;
    out.push(
      <span key={i} style={{ color: "#d4af37", marginRight: 2 }}>
        {fill === 1 ? "★" : "☆"}
      </span>
    );
  }
  return <span>{out}</span>;
}

/* ---------------- Styles ---------------- */
const gold = "#d4af37";
const pageWrap = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 600px at 20% -10%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(120deg,#0b0f14,#10161c)",
  color: "#fff",
  paddingBottom: 56,
};
const heroWrap = {
  marginTop: 12,
  padding: 18,
  borderRadius: 16,
  border: "1px solid rgba(212,175,55,0.25)",
  background: "linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.04))",
};
const heroTitle = { margin: "0 0 6px", letterSpacing: 0.2 };
const heroSub = { margin: 0, opacity: 0.85 };
const chipRow = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 };
const chip = (active) => ({
  padding: "6px 12px",
  borderRadius: 999,
  background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.06)",
  border: `1px solid ${active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.18)"}`,
  color: active ? gold : "#fff",
});
const linkGhost = { color: "#fff", opacity: 0.8 };
const filtersRow = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
  gap: 12,
  marginTop: 12,
};
const darkInput = {
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 12,
  padding: "10px 12px",
};
const darkSelect = {
  ...darkInput,
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.65) 50%), linear-gradient(135deg, rgba(255,255,255,0.65) 50%, transparent 50%)",
  backgroundPosition:
    "calc(100% - 18px) calc(1em + 2px), calc(100% - 14px) calc(1em + 2px)",
  backgroundSize: "4px 4px, 4px 4px",
  backgroundRepeat: "no-repeat",
};
const errorBanner = {
  marginTop: 12,
  borderRadius: 10,
  padding: 10,
  color: "#fca5a5",
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.1)",
};
const muted = { marginTop: 16, opacity: 0.8 };
const gridWrap = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 18,
};
const card = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(31,41,55,0.52), rgba(31,41,55,0.32))",
  backdropFilter: "blur(6px)",
  boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
};
const thumb = { borderRadius: 12, height: 150, marginBottom: 12 };
const titleRow = { display: "flex", alignItems: "center", gap: 8, margin: "4px 0 6px", fontWeight: 600 };
const metaLine = { marginBottom: 6 };
const ratingLine = { display: "flex", alignItems: "center", marginBottom: 12, opacity: 0.95 };
const ctaRow = { display: "flex", gap: 10 };
const btnPrimary = {
  borderRadius: 999,
  padding: "8px 14px",
  background: "linear-gradient(180deg, rgba(212,175,55,0.22), rgba(212,175,55,0.12))",
  border: "1px solid rgba(212,175,55,0.55)",
  color: gold,
};
const btnSecondary = {
  borderRadius: 999,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#fff",
};
const btnGhost = {
  borderRadius: 999,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
};
const pagerWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  marginTop: 22,
};
const pagerBtn = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
};
const numBtn = (active) => ({
  borderRadius: 10,
  padding: "6px 10px",
  border: `1px solid ${active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.18)"}`,
  background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.06)",
  color: active ? gold : "#fff",
});

// Skeleton loader style
const skeletonCard = {
  borderRadius: 16,
  height: 220,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)",
  backgroundSize: "400% 100%",
  animation: "loadingShimmer 1.4s ease infinite",
};