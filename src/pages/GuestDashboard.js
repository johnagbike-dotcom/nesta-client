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
const PAGE_SIZE  = 12;
const CORMORANT  = "'Cormorant Garamond', Georgia, serif";

/* ─── Ghost booking filter ─── */
const GHOST_STATUSES = new Set([
  "initialized","pending","hold","hold-pending",
  "awaiting_payment","reserved_unpaid","pending_payment",
]);
function isRealBooking(row) {
  if (row.archived === true) return false;
  const s      = String(row.status || "").toLowerCase();
  const hasRef = !!(row.reference || row.paymentRef || row.paymentReference || row.transactionId);
  const isPaid = String(row.paymentStatus || "").toLowerCase() === "paid" || row.paid === true;
  if (hasRef || isPaid) return true;
  if (GHOST_STATUSES.has(s)) return false;
  return true;
}

function nf(n) { return Number(n || 0).toLocaleString("en-NG"); }

function getListingCover(l) {
  if (!l) return null;
  if (Array.isArray(l.images)    && l.images[0])    return l.images[0];
  if (Array.isArray(l.imageUrls) && l.imageUrls[0]) return l.imageUrls[0];
  if (Array.isArray(l.photos)    && l.photos[0])    return l.photos[0];
  return l.imageUrl || l.coverImage || null;
}

function getRatingData(l) {
  const avg =
    Number.isFinite(Number(l?.ratingAvg)) && Number(l?.ratingAvg) > 0 ? Number(l.ratingAvg) :
    Number.isFinite(Number(l?.rating))    && Number(l?.rating)    > 0 ? Number(l.rating)    : 0;
  const count = Number.isFinite(Number(l?.ratingCount)) ? Number(l.ratingCount) : 0;
  return { avg, count };
}

function Stars({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const stars = Array.from({ length: 5 }).map((_, i) =>
    i < Math.floor(v) ? "★" : (i === Math.floor(v) && v - Math.floor(v) >= 0.5) ? "⯪" : "☆"
  );
  if (!v) return <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>New</span>;
  return (
    <span style={{ color: "#c9a84c", fontSize: 13, letterSpacing: 1 }}>{stars.join("")}
      <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: 5, fontSize: 12 }}>{v.toFixed(1)}</span>
    </span>
  );
}

function Badge({ children }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 999,
      border: "1px solid rgba(201,168,76,0.45)", color: "#c9a84c",
      background: "rgba(201,168,76,0.08)", whiteSpace: "nowrap", fontWeight: 600,
      letterSpacing: "0.04em",
    }}>
      {children}
    </span>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const half  = 3;
  let start   = Math.max(1, page - half);
  let end     = Math.min(totalPages, start + (half * 2));
  if (end - start < (half * 2)) start = Math.max(1, end - (half * 2));
  const nums  = [];
  for (let i = start; i <= end; i++) nums.push(i);

  const pgBtn = (active) => ({
    minWidth: 34, height: 34, borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.12)"}`,
    background: active ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#c9a84c" : "rgba(255,255,255,0.7)",
    cursor: active ? "default" : "pointer",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 28 }}>
      <button disabled={page === 1} onClick={() => onPage(Math.max(1, page - 1))} style={{ ...pgBtn(false), padding: "0 14px" }}>← Prev</button>
      {start > 1 && <><button onClick={() => onPage(1)} style={pgBtn(page === 1)}>1</button>{start > 2 && <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 2px" }}>…</span>}</>}
      {nums.map((n) => <button key={n} onClick={() => onPage(n)} style={pgBtn(page === n)}>{n}</button>)}
      {end < totalPages && <>{end < totalPages - 1 && <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 2px" }}>…</span>}<button onClick={() => onPage(totalPages)} style={pgBtn(page === totalPages)}>{totalPages}</button></>}
      <button disabled={page === totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))} style={{ ...pgBtn(false), padding: "0 14px" }}>Next →</button>
    </div>
  );
}

export default function GuestDashboard() {
  const navigate = useNavigate();
  const { user }    = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role            = (profile?.role || "").toLowerCase();
  const isGuest         = !role || role === "guest";
  const isHostOrPartner = role === "host" || role === "partner";
  const firstName       = profile?.displayName?.split(" ")[0] || profile?.firstName || null;

  // Filters
  const [qText, setQText] = useState("");
  const [min,   setMin]   = useState("");
  const [max,   setMax]   = useState("");
  const [city,  setCity]  = useState("");

  // Data
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  // Pagination
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cursors,    setCursors]    = useState([]);

  // Auto expire stale bookings
  useEffect(() => { expireStaleBookings(); }, []);

  // Reset paging on filter change
  useEffect(() => { setPage(1); setCursors([]); setTotalPages(1); }, [city, min, max]);

  // Load page
  useEffect(() => { loadPage(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, city, min, max]);

  // Count total (price filters only — city is client-side)
  useEffect(() => {
    (async () => {
      try {
        const { qRef } = await buildQuery({ justForCount: true });
        const snap = await getCountFromServer(qRef);
        setTotalPages(Math.max(1, Math.ceil((snap.data().count || 0) / PAGE_SIZE)));
      } catch (e) {
        console.warn("[GuestDashboard] count failed", e);
        setTotalPages(1);
      }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [min, max]); // intentionally excludes city — city is filtered client-side

  async function buildQuery({ after = null, justForCount = false }) {
    const base       = collection(db, "listings");
    const hasMin     = min !== "" && !Number.isNaN(Number(min));
    const hasMax     = max !== "" && !Number.isNaN(Number(max));
    const clauses    = [];
    // NOTE: city is NOT filtered in Firestore — hosts enter free text so
    // "Abuja", "Abuja FCT", "ABUJA" would all miss an exact-match query.
    // City is filtered client-side using case-insensitive includes() below.
    if (hasMin) clauses.push(where("pricePerNight", ">=", Number(min)));
    if (hasMax) clauses.push(where("pricePerNight", "<=", Number(max)));
    const needsPrice = hasMin || hasMax;

    if (justForCount) {
      return { qRef: needsPrice
        ? query(base, ...clauses, orderBy("pricePerNight", "asc"))
        : query(base, ...clauses, orderBy("createdAt", "desc")) };
    }
    return {
      qRef: needsPrice
        ? query(base, ...clauses, orderBy("pricePerNight", "asc"),  ...(after ? [startAfter(after)] : []), limit(PAGE_SIZE))
        : query(base, ...clauses, orderBy("createdAt",    "desc"), ...(after ? [startAfter(after)] : []), limit(PAGE_SIZE)),
    };
  }

  async function loadPage(toPage) {
    setLoading(true); setErr("");
    try {
      const startCursor = toPage > 1 ? cursors[toPage - 2] || null : null;
      const { qRef }    = await buildQuery({ after: startCursor });
      const snap        = await getDocs(qRef);
      const docs        = snap.docs.map((d) => ({ id: d.id, ...d.data(), __doc: d }));
      setRows(docs);
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      setCursors((prev) => { const c = [...prev]; c[toPage - 1] = lastDoc; return c; });
    } catch (e) {
      console.error("[GuestDashboard] loadPage error", e);
      setErr("Couldn't load listings. If the console shows a Firestore index URL, open it to auto-create the index, then refresh.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Client-side filter — city chip uses case-insensitive includes to handle
  // "Abuja", "Abuja FCT", "ABUJA", "FCT Abuja" etc. + keyword search
  const filtered = useMemo(() => {
    const kw         = qText.trim().toLowerCase();
    const cityFilter = city.trim().toLowerCase();
    return rows.filter((l) => {
      const titleL = (l.title || "").toLowerCase();
      const areaL  = (l.area  || "").toLowerCase();
      const cityL  = (l.city  || "").toLowerCase();
      // City chip: listing city must contain the selected city name
      if (cityFilter && !cityL.includes(cityFilter)) return false;
      // Keyword search
      if (kw) return titleL.includes(kw) || areaL.includes(kw) || cityL.includes(kw);
      return true;
    });
  }, [rows, qText, city]);

  const resetAll = () => { setQText(""); setMin(""); setMax(""); setCity(""); };

  /* ── Styles ── */
  const S = {
    page: {
      minHeight: "100vh",
      background: "radial-gradient(1400px 600px at 20% -5%, rgba(201,168,76,0.05), transparent 55%), #05070a",
      color: "#fff",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      paddingBottom: 64,
    },
    container: { maxWidth: 1180, margin: "0 auto", padding: "0 20px" },
    welcome: {
      padding: "36px 0 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 28,
    },
    welcomeEyebrow: {
      fontSize: 10, fontWeight: 600, letterSpacing: "0.36em",
      textTransform: "uppercase", color: "#c9a84c", marginBottom: 8,
    },
    welcomeH1: {
      fontFamily: CORMORANT, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600,
      color: "#f5f0e8", margin: "0 0 8px", lineHeight: 1.15,
    },
    welcomeSub: { fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.45)", marginBottom: 24 },
    filterPanel: {
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(12,16,24,0.8)", padding: "18px 20px", marginBottom: 24,
    },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    chip: (active) => ({
      padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
      border: `1px solid ${active ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.12)"}`,
      background: active ? "rgba(201,168,76,0.10)" : "rgba(255,255,255,0.04)",
      color: active ? "#c9a84c" : "rgba(255,255,255,0.7)",
    }),
    filterRow: {
      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10,
    },
    input: {
      height: 42, borderRadius: 12, padding: "0 14px", fontSize: 14,
      border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
      color: "#fff", outline: "none",
    },
    grid: {
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18,
    },
    card: {
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)",
      background: "linear-gradient(160deg, rgba(16,20,30,0.95), rgba(10,13,20,0.90))",
      overflow: "hidden", boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    },
    thumb: { height: 170, background: "#0a0c10", overflow: "hidden", position: "relative" },
    cardBody: { padding: "14px 16px 16px" },
    cardTitle: { fontWeight: 600, fontSize: 15, marginBottom: 4, color: "rgba(255,255,255,0.95)" },
    cardMeta: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8, fontWeight: 300 },
    cardPrice: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 },
    ctaRow: { display: "flex", gap: 8, marginTop: 12, alignItems: "center", justifyContent: "space-between" },
    btnPrimary: {
      padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
      background: "linear-gradient(135deg, #e8c96b, #c9a84c)", color: "#120d02", border: "none",
      boxShadow: "0 4px 14px rgba(201,168,76,0.28)",
    },
    btnSecondary: {
      padding: "7px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
    },
    btnGhost: {
      padding: "7px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)",
    },
    skeleton: {
      borderRadius: 20, height: 260,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
      backgroundSize: "400% 100%", animation: "shimmerDash 1.5s ease infinite",
    },
    errorBanner: {
      borderRadius: 14, padding: "12px 16px", marginBottom: 16,
      border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
      color: "#fca5a5", fontSize: 13,
    },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes shimmerDash {
          0%   { background-position: -800px 0 }
          100% { background-position:  800px 0 }
        }
        .dash-card:hover { transform: translateY(-4px) !important; box-shadow: 0 22px 55px rgba(0,0,0,0.65) !important; border-color: rgba(201,168,76,0.22) !important; }
        .dash-img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s ease; }
        .dash-card:hover .dash-img { transform: scale(1.05); }
        @media (max-width:860px) { .filter-row { grid-template-columns:1fr 1fr !important; } .filter-row > *:last-child { grid-column:1/-1; } }
        @media (max-width:640px) { .filter-row { grid-template-columns:1fr !important; } }
      `}</style>

      <main style={S.page}>
        <div style={S.container}>
          <KycBanner />

          {/* Welcome header */}
          <div style={S.welcome}>
            <div style={S.welcomeEyebrow}>NestaNg · Guest Dashboard</div>
            <h1 style={S.welcomeH1}>
              {firstName ? `Welcome back, ${firstName}.` : "Find your next stay."}
            </h1>
            <p style={S.welcomeSub}>
              Browse verified apartments and villas across Nigeria — filtered to your preferences.
            </p>
          </div>

          {/* Filter panel */}
          <div style={S.filterPanel}>
            {/* City chips */}
            <div style={S.chipRow}>
              {CITY_CHIPS.map((c) => (
                <button key={c} style={S.chip(city === c)} onClick={() => setCity(city === c ? "" : c)}>
                  {c}
                </button>
              ))}
              {city && (
                <button style={S.chip(false)} onClick={() => setCity("")}>All cities ×</button>
              )}
            </div>

            {/* Filter inputs */}
            <div style={S.filterRow} className="filter-row">
              <input
                style={S.input} placeholder="Search by title, city, area…"
                value={qText} onChange={(e) => setQText(e.target.value)}
              />
              <select
                style={{ ...S.input, appearance: "none" }}
                value={city} onChange={(e) => setCity(e.target.value)}
              >
                <option value="">Any city</option>
                {CITY_CHIPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                style={S.input} type="number" placeholder="Min ₦/night"
                value={min} onChange={(e) => setMin(e.target.value)}
              />
              <input
                style={S.input} type="number" placeholder="Max ₦/night"
                value={max} onChange={(e) => setMax(e.target.value)}
              />
              <button
                style={{ ...S.btnSecondary, height: 42, padding: "0 16px", whiteSpace: "nowrap" }}
                onClick={resetAll}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Error */}
          {err && <div style={S.errorBanner}>{err}</div>}

          {/* Grid */}
          {loading ? (
            <div style={S.grid}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={S.skeleton} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>No listings found</p>
              <p>{city ? `No listings found in ${city}. Try browsing all cities.` : "Try adjusting your price range or search term."}</p>
              <button style={{ ...S.btnPrimary, marginTop: 20 }} onClick={resetAll}>Clear filters</button>
            </div>
          ) : (
            <>
              <div style={S.grid}>
                {filtered.map((l) => {
                  const price      = Number(l.pricePerNight || 0);
                  const img        = getListingCover(l);
                  const { avg }    = getRatingData(l);
                  const partnerUid = l.partnerUid || l.hostUid || "";

                  return (
                    <article key={l.id} style={S.card} className="dash-card">
                      {/* Thumbnail */}
                      <div style={S.thumb}>
                        {img
                          ? <img src={img} alt={l.title || "Listing"} className="dash-img" loading="lazy" />
                          : <div style={{ width:"100%", height:"100%", background:"rgba(255,255,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <span style={{ color:"rgba(255,255,255,0.2)", fontSize:13 }}>No photo</span>
                            </div>
                        }
                        {/* Price pill */}
                        <div style={{
                          position:"absolute", bottom:10, left:12,
                          padding:"4px 12px", borderRadius:999, fontSize:13, fontWeight:700,
                          background:"rgba(5,7,10,0.78)", border:"1px solid rgba(255,255,255,0.12)",
                          backdropFilter:"blur(6px)", color:"#fff",
                        }}>
                          ₦{nf(price)}<span style={{ fontWeight:300, color:"rgba(255,255,255,0.5)", fontSize:11 }}>/night</span>
                        </div>
                        {/* Badges */}
                        <div style={{ position:"absolute", top:10, right:10, display:"flex", gap:6 }}>
                          {l.featured   && <Badge>Featured</Badge>}
                          {l.isFeatured && <Badge>Staff pick</Badge>}
                        </div>
                      </div>

                      {/* Body */}
                      <div style={S.cardBody}>
                        <h3 style={S.cardTitle}>{l.title || "Untitled"}</h3>
                        <div style={S.cardMeta}>
                          {l.city || "—"}{l.area ? ` · ${l.area}` : ""}
                        </div>
                        <Stars value={avg} />

                        <div style={S.ctaRow}>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                            <Link to={`/listing/${l.id}`} style={{ ...S.btnSecondary, textDecoration:"none", display:"inline-flex", alignItems:"center" }}>
                              View
                            </Link>
                            {isGuest && (
                              <Link
                                to={`/reserve/${l.id}`}
                                state={{ listing: { id:l.id, title:l.title, pricePerNight:l.pricePerNight, hostId:l.hostUid||l.ownerId, city:l.city, area:l.area } }}
                                style={{ ...S.btnPrimary, textDecoration:"none", display:"inline-flex", alignItems:"center" }}
                              >
                                Reserve
                              </Link>
                            )}
                            {isGuest && partnerUid && (
                              <Link
                                to={`/chat/${partnerUid}`}
                                state={{ listingId:l.id, listingTitle:l.title, hostId:l.hostUid, partnerUid:l.partnerUid }}
                                style={{ ...S.btnGhost, textDecoration:"none", display:"inline-flex", alignItems:"center" }}
                              >
                                {l.partnerUid ? "Chat partner" : "Chat host"}
                              </Link>
                            )}
                            {!isGuest && (
                              <Link to={`/listing/${l.id}/edit`} style={{ ...S.btnPrimary, textDecoration:"none", display:"inline-flex", alignItems:"center" }}>
                                Edit
                              </Link>
                            )}
                          </div>
                          {isGuest && <FavButton listingId={l.id} compact />}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Only show pagination when no city filter active — city filters client-side across all loaded pages */}
              {!city && <Pagination page={page} totalPages={totalPages} onPage={(p) => setPage(p)} />}
            </>
          )}
        </div>
      </main>
    </>
  );
}