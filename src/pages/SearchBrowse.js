// src/pages/SearchBrowse.js
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  collection, getDocs, limit, orderBy,
  query as fsQuery, where, startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import FilterBar from "../components/FilterBar";

/* ─── Keyframes & shared styles injected once ─── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

    @keyframes sbShimmer {
      0%   { background-position: -1200px 0 }
      100% { background-position:  1200px 0 }
    }
    @keyframes sbFadeUp {
      from { opacity:0; transform:translateY(6px) }
      to   { opacity:1; transform:translateY(0)   }
    }
    .sb-shimmer {
      background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%);
      background-size: 1200px 100%;
      animation: sbShimmer 1.6s linear infinite;
    }
    .sb-fade-in { opacity:0; animation: sbFadeUp 0.32s ease-out forwards; }
    .sb-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
    .sb-card:hover {
      transform: translateY(-5px) !important;
      box-shadow: 0 24px 56px rgba(0,0,0,0.7) !important;
      border-color: rgba(201,168,76,0.28) !important;
    }
    .sb-card:hover .sb-card-img { transform: scale(1.05); }
    .sb-card-img { transition: transform 0.45s ease; }
    .sb-toast-wrap { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); display:grid; gap:8px; z-index:60; }
    .sb-toast {
      background: rgba(12,16,24,0.92);
      color: #e5e7eb;
      border: 1px solid rgba(201,168,76,0.30);
      padding: 10px 16px;
      border-radius: 14px;
      box-shadow: 0 14px 44px rgba(0,0,0,0.45);
      font-size: 13px;
      max-width: 90vw;
      backdrop-filter: blur(12px);
    }
    :focus-visible { outline: 2px solid rgba(201,168,76,0.7); outline-offset: 2px; border-radius: 10px; }
  `}</style>
);

/* ─── Toast hub ─── */
function ToastHub() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const onToast = (e) => {
      const detail = e?.detail || {};
      const id = Math.random().toString(36).slice(2);
      setToasts((p) => [...p, { id, msg: String(detail.msg || "Done") }]);
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), detail.timeoutMs || 2600);
    };
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="sb-toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="sb-toast" role="status" aria-live="polite">{t.msg}</div>
      ))}
    </div>
  );
}

/* ─── Helpers ─── */
const PAGE_LIMIT = 40;
const FAV_LS_KEY = "nesta:favs:v1";
const CORMORANT  = "'Cormorant Garamond', Georgia, serif";
const nf         = new Intl.NumberFormat("en-NG");

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.seconds) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  if (ts instanceof Date) return ts.getTime();
  if (ts?.toMillis) return ts.toMillis();
  return 0;
}

function digitsOnly(v) { return String(v || "").replace(/[^\d]/g, ""); }

function normalizeCityKey(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";
  if (["abuja","abuja fct","fct","f.c.t","abuja-fct","abuja, fct"].includes(s)) return "abuja fct";
  if (s === "portharcourt" || s === "port-harcourt") return "port harcourt";
  if (["any","all","any city","all cities"].includes(s)) return "";
  return s;
}

function listingKey(l) {
  return `${String(l.city||"").toLowerCase()}::${String(l.title||"").toLowerCase()}::${Number(l.pricePerNight||l.price||0)}`;
}

function extractIndexUrl(err) {
  const m = String(err?.message || "").match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
  return m?.[0] || null;
}

function isIndexError(err) {
  return String(err?.message || "").toLowerCase().includes("requires an index");
}

function getListingCover(l) {
  if (!l) return null;
  if (Array.isArray(l.photos)    && l.photos[0])    return l.photos[0];
  if (Array.isArray(l.imageUrls) && l.imageUrls[0]) return l.imageUrls[0];
  if (Array.isArray(l.images)    && l.images[0])    return l.images[0];
  return l.imageUrl || l.coverImage || null;
}

function getRatingData(l) {
  const avg =
    Number.isFinite(Number(l?.ratingAvg)) && Number(l?.ratingAvg) > 0 ? Number(l.ratingAvg) :
    Number.isFinite(Number(l?.rating))    && Number(l?.rating)    > 0 ? Number(l.rating)    : 0;
  const count = Number.isFinite(Number(l?.ratingCount)) ? Number(l.ratingCount) : 0;
  return { avg, count };
}

/* ─── Stars ─── */
function Stars({ value = 0, count = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  if (!v && !count) return (
    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>New</span>
  );
  const stars = Array.from({ length: 5 }).map((_, i) =>
    i < Math.floor(v) ? "★" : (i === Math.floor(v) && v - Math.floor(v) >= 0.5) ? "⯪" : "☆"
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#c9a84c", letterSpacing: 1 }}>{stars.join("")}</span>
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{v.toFixed(1)}</span>
      {count > 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>({count})</span>}
    </span>
  );
}

/* ─── Listing card ─── */
function ListingCard({ l, onView, onReserve, onFav, isFaved, animDelay }) {
  const img        = getListingCover(l);
  const price      = Number(l.pricePerNight || l.price || 0);
  const { avg, count } = getRatingData(l);
  const bedrooms   = l.bedrooms || l.beds;
  const guests     = l.maxGuests || l.guests;
  const type       = l.propertyType || l.type;

  return (
    <article
      className="sb-card sb-fade-in"
      style={{
        borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(160deg,rgba(14,18,28,0.96),rgba(8,11,18,0.92))",
        overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,0.42)",
        cursor: "pointer", animationDelay: animDelay,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${l.title || "listing"}`}
      onClick={onView}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView?.(); } }}
    >
      {/* Photo */}
      <div style={{ height: 190, background: "#0a0c12", overflow: "hidden", position: "relative" }}>
        {img ? (
          <img src={img} alt={l.title || "Listing"} className="sb-card-img"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>No photo</span>
          </div>
        )}
        {/* Gradient */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(8,11,18,0.7) 0%,transparent 55%)" }} />

        {/* Price pill */}
        <div style={{
          position:"absolute", bottom:10, left:12,
          padding:"4px 12px", borderRadius:999, fontSize:13, fontWeight:700,
          background:"rgba(5,7,10,0.80)", border:"1px solid rgba(255,255,255,0.12)",
          backdropFilter:"blur(8px)", color:"#fff",
        }}>
          ₦{nf.format(price)}<span style={{ fontWeight:300, color:"rgba(255,255,255,0.5)", fontSize:11 }}>/night</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.95)", marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {l.title || "Untitled listing"}
        </h3>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {[l.area, l.city ? String(l.city).trim() : null].filter(Boolean).join(" · ")}
        </p>

        <Stars value={avg} count={count} />

        {(bedrooms || guests || type) && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:7 }}>
            {bedrooms && <span style={pill}>{bedrooms} bed{bedrooms > 1 ? "s" : ""}</span>}
            {guests   && <span style={pill}>Sleeps {guests}</span>}
            {type     && <span style={pill}>{type}</span>}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>
          <button onClick={onView}    style={btnSecondary}>View</button>
          <button onClick={onReserve} style={btnPrimary}>Reserve</button>
          <button
            onClick={onFav}
            aria-pressed={isFaved ? "true" : "false"}
            style={{ marginLeft:"auto", ...btnFav(isFaved) }}
          >
            {isFaved ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
      </div>
    </article>
  );
}

const pill       = { padding:"2px 9px", borderRadius:999, fontSize:11, color:"rgba(255,255,255,0.45)", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)" };
const btnPrimary = { padding:"7px 16px", borderRadius:999, fontSize:13, fontWeight:600, cursor:"pointer", background:"linear-gradient(135deg,#e8c96b,#c9a84c)", color:"#120d02", border:"none", boxShadow:"0 4px 14px rgba(201,168,76,0.25)" };
const btnSecondary = { padding:"7px 14px", borderRadius:999, fontSize:13, cursor:"pointer", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.8)" };
const btnFav = (active) => ({ padding:"6px 12px", borderRadius:999, fontSize:12, cursor:"pointer", border:`1px solid ${active ? "rgba(201,168,76,0.5)":"rgba(255,255,255,0.12)"}`, background: active ? "rgba(201,168,76,0.10)":"rgba(255,255,255,0.04)", color: active ? "#c9a84c":"rgba(255,255,255,0.55)" });

/* ─── Skeleton ─── */
function SkeletonCard() {
  return (
    <div style={{ borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)", background:"rgba(12,15,22,0.9)" }}>
      <div className="sb-shimmer" style={{ height:190 }} />
      <div style={{ padding:"14px 16px", display:"grid", gap:10 }}>
        <div className="sb-shimmer" style={{ height:16, width:"70%", borderRadius:8 }} />
        <div className="sb-shimmer" style={{ height:12, width:"50%", borderRadius:8 }} />
        <div className="sb-shimmer" style={{ height:14, width:"35%", borderRadius:8 }} />
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <div className="sb-shimmer" style={{ height:32, flex:1, borderRadius:10 }} />
          <div className="sb-shimmer" style={{ height:32, width:72, borderRadius:10 }} />
          <div className="sb-shimmer" style={{ height:32, width:60, borderRadius:10 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function SearchBrowse() {
  const [params] = useSearchParams();
  const nav      = useNavigate();

  const rawLoc   = (params.get("loc") || params.get("location") || params.get("city") || "").trim();
  const q        = (params.get("q") || rawLoc || "").trim();
  const cityParam = (params.get("city") || "").trim();
  const cityKey  = normalizeCityKey(cityParam);

  const minRaw = params.get("min");
  const maxRaw = params.get("max");
  const min    = minRaw ? Number(digitsOnly(minRaw)) : undefined;
  const max    = maxRaw ? Number(digitsOnly(maxRaw)) : undefined;

  const [loading,       setLoading]       = useState(true);
  const [listings,      setListings]      = useState([]);
  const [error,         setError]         = useState(null);
  const [indexUrl,      setIndexUrl]      = useState(null);
  const [lastDoc,       setLastDoc]       = useState(null);
  const [hasMore,       setHasMore]       = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const seenIdsRef  = useRef(new Set());
  const seenKeysRef = useRef(new Set());
  const isLoadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);
  const ioRef       = useRef(null);

  const [favs, setFavs] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(FAV_LS_KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(FAV_LS_KEY, JSON.stringify([...favs])); } catch {}
  }, [favs]);

  const col = useMemo(() => collection(db, "listings"), []);
  const gridCls = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5";

  const clientMatch = useCallback((r) => {
    const st = String(r?.status || "active").toLowerCase();
    if (st && st !== "active") return false;
    if (cityKey) {
      if (normalizeCityKey(r.city) !== cityKey) return false;
    }
    if (q) {
      const needle = q.toLowerCase();
      if (!(
        (r.title || "").toString().toLowerCase().includes(needle) ||
        (r.city  || "").toString().toLowerCase().includes(needle) ||
        (r.area  || "").toString().toLowerCase().includes(needle)
      )) return false;
    }
    const price = Number(r.pricePerNight || r.price || 0);
    if (Number.isFinite(min) && price < min) return false;
    if (Number.isFinite(max) && price > max) return false;
    return true;
  }, [q, cityKey, min, max]);

  const buildIndexedQuery = useCallback((after = null) => {
    const parts = [where("status", "==", "active")];
    if (Number.isFinite(min)) parts.push(where("pricePerNight", ">=", min));
    if (Number.isFinite(max)) parts.push(where("pricePerNight", "<=", max));
    const order = (Number.isFinite(min) || Number.isFinite(max))
      ? orderBy("pricePerNight", "asc") : orderBy("updatedAt", "desc");
    return after
      ? fsQuery(col, ...parts, order, startAfter(after), limit(PAGE_LIMIT))
      : fsQuery(col, ...parts, order, limit(PAGE_LIMIT));
  }, [col, min, max]);

  const buildFallbackQuery = useCallback((after = null) => {
    return after
      ? fsQuery(col, startAfter(after), limit(PAGE_LIMIT))
      : fsQuery(col, limit(PAGE_LIMIT));
  }, [col]);

  const normalizeRows = useCallback((docs) => {
    let rows = docs.map((d) => ({ id: d.id, ...d.data() })).filter(clientMatch);
    const wantsPrice = Number.isFinite(min) || Number.isFinite(max);
    rows.sort((a, b) => wantsPrice
      ? Number(a.pricePerNight || a.price || 0) - Number(b.pricePerNight || b.price || 0)
      : toMillis(b?.updatedAt || b?.createdAt) - toMillis(a?.updatedAt || a?.createdAt)
    );
    const out = [];
    for (const r of rows) {
      const k = listingKey(r);
      if (seenKeysRef.current.has(k)) continue;
      seenKeysRef.current.add(k);
      out.push(r);
    }
    return out;
  }, [clientMatch, min, max]);

  async function safeGetDocs(primary, fallback) {
    try {
      return { snap: await getDocs(primary), usedFallback: false };
    } catch (err) {
      if (isIndexError(err)) {
        const url = extractIndexUrl(err);
        if (url) setIndexUrl(url);
        setUsingFallback(true);
        window.dispatchEvent(new CustomEvent("toast", { detail: { msg: "Search index missing — using fallback mode.", timeoutMs: 3500 } }));
        return { snap: await getDocs(fallback), usedFallback: true };
      }
      throw err;
    }
  }

  useEffect(() => {
    let mounted = true;
    setLastDoc(null); setHasMore(false); setUsingFallback(false);
    seenIdsRef.current = new Set(); seenKeysRef.current = new Set();

    (async () => {
      setLoading(true); setError(null); setIndexUrl(null);
      try {
        const { snap } = await safeGetDocs(buildIndexedQuery(), buildFallbackQuery());
        if (!mounted) return;
        const rows = normalizeRows(snap.docs);
        setListings(rows);
        const next = snap.docs[snap.docs.length - 1] || null;
        setLastDoc(next);
        setHasMore(snap.docs.length === PAGE_LIMIT);
      } catch (err) {
        console.error("[Search] load failed:", err);
        if (!mounted) return;
        const url = extractIndexUrl(err);
        if (url) setIndexUrl(url);
        setError("Couldn't load listings.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [buildIndexedQuery, buildFallbackQuery, normalizeRows, q, cityParam, min, max]); // eslint-disable-line

  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const primary  = usingFallback ? buildFallbackQuery(lastDoc) : buildIndexedQuery(lastDoc);
      const { snap } = await safeGetDocs(primary, buildFallbackQuery(lastDoc));
      const rows     = normalizeRows(snap.docs);
      const next     = snap.docs[snap.docs.length - 1] || null;
      setLastDoc(next);
      setHasMore(snap.docs.length === PAGE_LIMIT);
      setListings((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...rows.filter((x) => !seen.has(x.id))];
      });
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, lastDoc, buildIndexedQuery, buildFallbackQuery, normalizeRows, usingFallback]); // eslint-disable-line

  useEffect(() => {
    if (!sentinelRef.current) return;
    ioRef.current?.disconnect();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    ioRef.current = new IntersectionObserver(([e]) => { if (e?.isIntersecting) loadMore(); }, { rootMargin: "400px 0px" });
    ioRef.current.observe(sentinelRef.current);
    return () => ioRef.current?.disconnect();
  }, [loadMore]);

  function toggleFav(id) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        window.dispatchEvent(new CustomEvent("toast", { detail: { msg: "Removed from saved" } }));
      } else {
        next.add(id);
        window.dispatchEvent(new CustomEvent("toast", { detail: { msg: "Saved to favourites" } }));
      }
      return next;
    });
  }

  const getAnimDelay = (id, index) => {
    if (!seenIdsRef.current.has(id)) {
      seenIdsRef.current.add(id);
      return `${(index % 12) * 38}ms`;
    }
    return "0ms";
  };

  const filterSummary = [
    q        && `"${q}"`,
    cityParam && displayCity(cityParam),
    Number.isFinite(min) && `From ₦${nf.format(min)}`,
    Number.isFinite(max) && `Up to ₦${nf.format(max)}`,
  ].filter(Boolean).join(" · ");

  function displayCity(c) {
    const k = normalizeCityKey(c);
    if (k === "abuja fct") return "Abuja FCT";
    if (k === "port harcourt") return "Port Harcourt";
    return k.split(" ").map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#05070a", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <GlobalStyle />
      <ToastHub />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "88px 20px 48px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:18 }}>
            <button
              onClick={() => window.history.back()}
              style={{ padding:"7px 16px", borderRadius:999, fontSize:13, cursor:"pointer", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.75)" }}
            >
              ← Back
            </button>
            {listings.length > 0 && !loading && (
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                {listings.length} stay{listings.length === 1 ? "" : "s"} found
                {usingFallback ? " · fallback" : ""}
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: CORMORANT, fontSize: "clamp(28px,4vw,40px)", fontWeight:600, color:"#f5f0e8", margin:"0 0 8px", letterSpacing:0.3 }}>
            Explore signature stays
          </h1>
          <p style={{ fontSize:14, fontWeight:300, color:"rgba(255,255,255,0.45)", maxWidth:520, lineHeight:1.65 }}>
            Curated apartments, townhouses and villas across NestaNg's verified homes.
            Refine by location, price or keyword.
          </p>
        </div>

        {/* ── FilterBar ── */}
        <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(12,16,24,0.85)", backdropFilter:"blur(8px)", padding:"12px 16px", marginBottom:12 }}>
          <FilterBar />
        </div>

        {/* ── Active filter chips ── */}
        {filterSummary && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginBottom:16 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>Filters:</span>
            <span style={{ fontSize:12, padding:"4px 12px", borderRadius:999, background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", color:"#c9a84c" }}>
              {filterSummary}
            </span>
            <button
              onClick={() => nav("/search")}
              style={{ fontSize:12, color:"rgba(255,255,255,0.45)", cursor:"pointer", background:"transparent", border:"none", textDecoration:"underline", padding:0 }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className={gridCls} aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div style={{ borderRadius:16, padding:"14px 18px", border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:13, marginBottom:16 }} role="alert">
            {error}{" "}
            {indexUrl
              ? <><br /><a href={indexUrl} target="_blank" rel="noreferrer" style={{ color:"#c9a84c", textDecoration:"underline", fontWeight:600 }}>Create the missing Firestore index →</a></>
              : "Check your connection and try again."
            }
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && listings.length === 0 && (
          <div style={{ textAlign:"center", padding:"56px 0", color:"rgba(255,255,255,0.4)", fontSize:14 }}>
            <p style={{ fontSize:18, fontWeight:500, color:"rgba(255,255,255,0.7)", marginBottom:8 }}>No listings match your search</p>
            <p style={{ marginBottom:24 }}>Try a different location, keyword or price range.</p>
            <button onClick={() => nav("/search")} style={btnPrimary}>Clear all filters</button>
          </div>
        )}

        {/* ── Grid ── */}
        {!loading && !error && listings.length > 0 && (
          <>
            <div className={gridCls}>
              {listings.map((l, i) => (
                <div key={l.id} className="sb-fade-in" style={{ animationDelay: getAnimDelay(l.id, i) }}>
                  <ListingCard
                    l={l}
                    animDelay="0ms"
                    onView={() => nav(`/listing/${l.id}`)}
                    onReserve={(e) => { e?.stopPropagation?.(); nav(`/listing/${l.id}?tab=reserve`); }}
                    onFav={(e) => { e?.stopPropagation?.(); toggleFav(l.id); }}
                    isFaved={favs.has(l.id)}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true" />
            {hasMore && (
              <div style={{ display:"flex", justifyContent:"center", marginTop:24 }}>
                <button onClick={loadMore} style={{ ...btnSecondary, padding:"10px 28px", fontSize:14 }}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}