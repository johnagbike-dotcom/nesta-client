// src/pages/SearchBrowse.js
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
  where,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import FilterBar from "../components/FilterBar";

/* ---------------------- Inline styles & utilities ---------------------- */
const ShimmerAndFadeStyle = () => (
  <style>{`
@keyframes shimmer { 0%{background-position:-1000px 0} 100%{background-position:1000px 0} }
.shimmer{
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%);
  background-size: 1000px 100%;
  animation: shimmer 1.6s linear infinite;
}
@keyframes fadeInUp { from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:translateY(0)} }
.fade-in{ opacity:0; animation: fadeInUp .36s ease-out forwards; will-change: opacity, transform; }
.focus-outline:focus-visible{ outline:2px solid #facc15; outline-offset:2px; border-radius:14px; }

.toast-wrap{ position:fixed; left:50%; bottom:20px; transform:translateX(-50%); display:grid; gap:8px; z-index:60; }
.toast{
  background: rgba(17,24,39,.85);
  color:#e5e7eb;
  border:1px solid rgba(250,204,21,.35);
  padding:10px 14px;
  border-radius:12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.25);
  max-width: 90vw;
}
`}</style>
);

/* ---------------------- Tiny Toast Hub (no deps) ---------------------- */
function ToastHub() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    function onToast(e) {
      const detail = e?.detail || {};
      const id = Math.random().toString(36).slice(2);
      const t = { id, msg: String(detail.msg || "Done") };
      setToasts((prev) => [...prev, t]);
      setTimeout(
        () => setToasts((prev) => prev.filter((x) => x.id !== id)),
        detail.timeoutMs || 2500
      );
    }
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="status" aria-live="polite">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ------------------------ Listing Card (accessible) ------------------------ */
function ListingCard({ l, onView, onReserve, onFav, isFaved, tabIndex = 0 }) {
  const img =
    Array.isArray(l.photos) && l.photos[0]
      ? l.photos[0]
      : Array.isArray(l.imageUrls) && l.imageUrls[0]
      ? l.imageUrls[0]
      : null;

  const rating = Number(l.rating || 4.8).toFixed(1);
  const price = Number(l.pricePerNight || l.price || 0).toLocaleString("en-NG");

  const onKey = (e) => {
    if (e.key === "Enter") onView?.();
    if (e.key === " ") {
      e.preventDefault();
      onView?.();
    }
  };

  return (
    <article
      className="group relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden
                 hover:bg-white/10 transition-all duration-200 hover:shadow-[0_12px_40px_rgba(250,204,21,.15)]
                 hover:-translate-y-0.5 focus-outline"
      role="button"
      tabIndex={tabIndex}
      aria-label={`Open ${l.title || "listing"}`}
      onKeyDown={onKey}
      onClick={onView}
    >
      <div className="aspect-[16/11] bg-black/30 overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={l.title || "Listing photo"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
            No photo
          </div>
        )}
      </div>

      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-white font-semibold leading-snug line-clamp-2">
            {l.title || "Untitled listing"}
          </h3>
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300">
            ★ {rating}
          </span>
        </div>

        <div className="mt-1 text-sm text-white/70">
          {l.city ? String(l.city).trim() : ""}
          {l.area ? ` • ${String(l.area).trim()}` : ""}
        </div>

        <div className="mt-2 text-white font-semibold">
          ₦{price} <span className="text-white/60 font-normal">/ night</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-xl text-sm border border-white/15 bg-white/10 hover:bg-white/15"
          >
            View
          </button>
          <button
            onClick={onReserve}
            className="px-3 py-1.5 rounded-xl text-sm bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            Reserve
          </button>
          <button
            onClick={onFav}
            className={`ml-auto px-3 py-1.5 rounded-xl text-sm border border-white/10 hover:bg-white/10 ${
              isFaved ? "text-amber-300 border-amber-300/40" : "text-white/80"
            }`}
            aria-pressed={isFaved ? "true" : "false"}
          >
            {isFaved ? "✓ Favourited" : "❤ Favourite"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
      <div className="relative aspect-[16/11] shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded shimmer" />
        <div className="h-4 w-1/2 rounded shimmer" />
        <div className="h-5 w-24 rounded shimmer" />
        <div className="flex items-center gap-2 pt-1">
          <div className="h-8 w-16 rounded-xl shimmer" />
          <div className="h-8 w-24 rounded-xl shimmer" />
          <div className="ml-auto h-8 w-24 rounded-xl shimmer" />
        </div>
      </div>
    </div>
  );
}

const PAGE_LIMIT = 40;
const FAV_LS_KEY = "nesta:favs:v1";

/* -------------------------- helpers -------------------------- */
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.seconds) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  if (ts instanceof Date) return ts.getTime();
  if (ts?.toMillis) return ts.toMillis();
  return 0;
}

function digitsOnly(v) {
  return String(v || "").replace(/[^\d]/g, "");
}

function normalizeCityKey(cityRaw) {
  const s = String(cityRaw || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";

  if (
    s === "abuja" ||
    s === "abuja fct" ||
    s === "fct" ||
    s === "f.c.t" ||
    s === "abuja-fct" ||
    s === "abuja, fct"
  ) {
    return "abuja fct";
  }

  if (s === "portharcourt" || s === "port-harcourt") return "port harcourt";

  if (s === "any" || s === "all" || s === "any city" || s === "all cities") return "";
  return s;
}

// Defensive dedupe key (in case Firestore has duplicate docs / imports)
function listingKey(l) {
  const city = String(l.city || "").trim().toLowerCase();
  const title = String(l.title || "").trim().toLowerCase();
  const price = Number(l.pricePerNight || l.price || 0);
  const firstImg =
    (Array.isArray(l.photos) && l.photos[0]) ||
    (Array.isArray(l.imageUrls) && l.imageUrls[0]) ||
    "";
  return `${city}::${title}::${price}::${String(firstImg).slice(0, 60)}`;
}

function extractIndexUrl(err) {
  const msg = String(err?.message || "");
  const m = msg.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
  return m && m[0] ? m[0] : null;
}

function isIndexRequiredError(err) {
  const msg = String(err?.message || "");
  // Firestore typically throws "FAILED_PRECONDITION" + "requires an index"
  return msg.toLowerCase().includes("requires an index");
}

export default function SearchBrowse() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  // ✅ Accept multiple keys from HomePage / older links
  const rawLoc =
    (params.get("loc") || "").trim() ||
    (params.get("location") || "").trim() ||
    (params.get("city") || "").trim();

  const q = (params.get("q") || rawLoc || "").trim();
  const cityParam = (params.get("city") || "").trim(); // only treat explicit ?city as exact city
  const cityKey = normalizeCityKey(cityParam);

  const minRaw = params.get("min");
  const maxRaw = params.get("max");
  const min = minRaw ? Number(digitsOnly(minRaw)) : undefined;
  const max = maxRaw ? Number(digitsOnly(maxRaw)) : undefined;

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState(null);
  const [indexUrl, setIndexUrl] = useState(null);

  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // If Firestore index is missing, we fall back to a query that does NOT require composite indexes.
  const [usingFallback, setUsingFallback] = useState(false);

  const seenIdsRef = useRef(new Set());
  const seenKeysRef = useRef(new Set());

  const [favs, setFavs] = useState(() => {
    try {
      const raw = localStorage.getItem(FAV_LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAV_LS_KEY, JSON.stringify(Array.from(favs)));
    } catch {}
  }, [favs]);

  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  const isLoadingMoreRef = useRef(false);

  const col = useMemo(() => collection(db, "listings"), []);
  const gridCls = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";

  const clientMatch = useCallback(
    (r) => {
      // ✅ Only show active listings (client-side safety too)
      // If you don’t store status, this will still pass.
      const st = String(r?.status || "active").toLowerCase();
      if (st && st !== "active") return false;

      // ✅ Exact city filter ONLY when ?city is present
      if (cityKey) {
        const listingCityKey = normalizeCityKey(r.city);
        if (listingCityKey !== cityKey) return false;
      }

      // ✅ Keyword search (title/city/area)
      if (q) {
        const needle = q.toLowerCase();
        const title = (r.title || "").toString().toLowerCase();
        const cityStr = (r.city || "").toString().toLowerCase();
        const area = (r.area || "").toString().toLowerCase();

        const ok = title.includes(needle) || cityStr.includes(needle) || area.includes(needle);
        if (!ok) return false;
      }

      // ✅ price filter (client-side guard, because fallback query may not apply it server-side)
      const price = Number(r.pricePerNight || r.price || 0);
      if (Number.isFinite(min) && price < min) return false;
      if (Number.isFinite(max) && price > max) return false;

      return true;
    },
    [q, cityKey, min, max]
  );

  /**
   * Preferred query (FAST, but requires composite index for:
   * - status == active + orderBy(updatedAt)
   * - status == active + orderBy(pricePerNight) (when min/max provided)
   */
  const buildIndexedQuery = useCallback(
    (after = null) => {
      const parts = [];

      // ✅ server-side active filter
      parts.push(where("status", "==", "active"));

      // price filters
      if (Number.isFinite(min)) parts.push(where("pricePerNight", ">=", min));
      if (Number.isFinite(max)) parts.push(where("pricePerNight", "<=", max));

      // order
      const order =
        Number.isFinite(min) || Number.isFinite(max)
          ? orderBy("pricePerNight", "asc")
          : orderBy("updatedAt", "desc");

      let qx = fsQuery(col, ...parts, order, limit(PAGE_LIMIT));
      if (after) qx = fsQuery(col, ...parts, order, startAfter(after), limit(PAGE_LIMIT));
      return qx;
    },
    [col, min, max]
  );

  /**
   * Fallback query (NO composite index required):
   * - no where(status) and no orderBy(updatedAt/pricePerNight)
   * - paginate by default __name__ ordering, then filter/sort on client
   *
   * NOTE: This is just a temporary “works even without indexes” mode.
   */
  const buildFallbackQuery = useCallback(
    (after = null) => {
      let qx = fsQuery(col, limit(PAGE_LIMIT));
      if (after) qx = fsQuery(col, startAfter(after), limit(PAGE_LIMIT));
      return qx;
    },
    [col]
  );

  const normalizeRows = useCallback(
    (docs, mode) => {
      let rows = docs.map((d) => ({ id: d.id, ...d.data() }));

      // client-side filters (q/city/min/max/status)
      rows = rows.filter(clientMatch);

      // sort client-side (both indexed + fallback end up stable)
      const usingPrice =
        Number.isFinite(min) || Number.isFinite(max) || String(mode) === "price";
      if (usingPrice) {
        rows.sort((a, b) => {
          const pa = Number(a.pricePerNight || a.price || 0);
          const pb = Number(b.pricePerNight || b.price || 0);
          return pa - pb;
        });
      } else {
        rows.sort((a, b) => {
          const at = toMillis(a?.updatedAt || a?.createdAt);
          const bt = toMillis(b?.updatedAt || b?.createdAt);
          return bt - at;
        });
      }

      // content dedupe
      const next = [];
      for (const r of rows) {
        const k = listingKey(r);
        if (seenKeysRef.current.has(k)) continue;
        seenKeysRef.current.add(k);
        next.push(r);
      }

      return next;
    },
    [clientMatch, min, max]
  );

  async function safeGetDocs(primaryQuery, fallbackQuery) {
    try {
      const snap = await getDocs(primaryQuery);
      return { snap, usedFallback: false, err: null };
    } catch (err) {
      // If missing index, fall back automatically so your page still works.
      if (isIndexRequiredError(err)) {
        const url = extractIndexUrl(err);
        if (url) setIndexUrl(url);
        setUsingFallback(true);
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: {
              msg: "Search index missing — using fallback mode (slower).",
              timeoutMs: 3200,
            },
          })
        );

        const snap = await getDocs(fallbackQuery);
        return { snap, usedFallback: true, err };
      }
      throw err;
    }
  }

  /* -------------------------- Firestore fetch (first page) -------------------------- */
  useEffect(() => {
    let mounted = true;

    // reset paging + animation memory + content dedupe memory
    setLastDoc(null);
    setHasMore(false);
    setUsingFallback(false);
    seenIdsRef.current = new Set();
    seenKeysRef.current = new Set();

    async function run() {
      setLoading(true);
      setError(null);
      setIndexUrl(null);

      try {
        const wantsPrice = Number.isFinite(min) || Number.isFinite(max);
        const primary = buildIndexedQuery(null);
        const fallback = buildFallbackQuery(null);

        const { snap, usedFallback } = await safeGetDocs(primary, fallback);
        if (!mounted) return;

        const rows = normalizeRows(snap.docs, wantsPrice ? "price" : "updated");
        setListings(rows);

        const nextLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
        setLastDoc(nextLast);

        // We can keep paging in both modes:
        // - indexed mode: hasMore if page full
        // - fallback mode: also page full (but results are client-filtered, so may appear less)
        setHasMore(snap.docs.length === PAGE_LIMIT);

        if (!usedFallback) setUsingFallback(false);
      } catch (err) {
        console.error("[Search] load failed:", err);
        if (!mounted) return;

        const url = extractIndexUrl(err);
        if (url) setIndexUrl(url);

        setError("Couldn't load listings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [
    buildIndexedQuery,
    buildFallbackQuery,
    normalizeRows,
    q,
    cityParam,
    min,
    max,
  ]);

  /* -------------------------- Load more -------------------------- */
  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;

    try {
      const wantsPrice = Number.isFinite(min) || Number.isFinite(max);

      const primary = usingFallback
        ? buildFallbackQuery(lastDoc) // keep fallback once it’s activated
        : buildIndexedQuery(lastDoc);

      const fallback = buildFallbackQuery(lastDoc);

      const { snap, usedFallback } = await safeGetDocs(primary, fallback);

      const rows = normalizeRows(snap.docs, wantsPrice ? "price" : "updated");

      const nextLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      setLastDoc(nextLast);
      setHasMore(snap.docs.length === PAGE_LIMIT);

      setListings((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev, ...rows.filter((x) => !seen.has(x.id))];
        return merged;
      });

      if (!usedFallback) setUsingFallback(false);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [
    hasMore,
    lastDoc,
    buildIndexedQuery,
    buildFallbackQuery,
    normalizeRows,
    min,
    max,
    usingFallback,
  ]);

  /* ---------------------- IntersectionObserver hook-up ---------------------- */
  useEffect(() => {
    if (!sentinelRef.current) return;

    if (ioRef.current) {
      ioRef.current.disconnect();
      ioRef.current = null;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) return;

    ioRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" }
    );

    ioRef.current.observe(sentinelRef.current);

    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
    };
  }, [loadMore]);

  /* -------------------------- Actions -------------------------- */
  function clearFilters() {
    nav("/search");
  }

  function toggleFav(id) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        window.dispatchEvent(
          new CustomEvent("toast", { detail: { msg: "Removed from favourites" } })
        );
      } else {
        next.add(id);
        window.dispatchEvent(
          new CustomEvent("toast", { detail: { msg: "Added to favourites" } })
        );
      }
      return next;
    });
  }

  const filterChips = [
    { label: "Search", value: q || "Any" },
    // Only show “City” chip when user actually set ?city=
    { label: "City", value: cityParam || "Any" },
    { label: "Min ₦", value: Number.isFinite(min) ? min.toLocaleString("en-NG") : "Any" },
    { label: "Max ₦", value: Number.isFinite(max) ? max.toLocaleString("en-NG") : "Any" },
  ];

  // animate only *new* cards without state updates during render
  const getAnimDelay = (id, index) => {
    if (!seenIdsRef.current.has(id)) {
      seenIdsRef.current.add(id);
      return `${(index % 12) * 40}ms`;
    }
    return "0ms";
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white">
      <ShimmerAndFadeStyle />
      <ToastHub />

      <div className="max-w-6xl mx-auto" style={{ marginTop: 80, padding: "0 16px 32px" }}>
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => window.history.back()} className="btn" style={btnGhost}>
              ← Back
            </button>

            {listings.length > 0 && !loading && (
              <span className="text-xs text-white/60">
                {listings.length} stay{listings.length === 1 ? "" : "s"} found
                {usingFallback ? " • fallback" : ""}
              </span>
            )}
          </div>

          <div>
            <h1
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: 0.4,
                marginBottom: 4,
              }}
            >
              Explore signature stays
            </h1>
            <p className="text-sm text-white/70 max-w-xl">
              Refine your search to find curated apartments, townhouses, and villas across Nesta’s verified homes.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 mb-3">
          <FilterBar />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {filterChips.map((chip) => (
            <span
              key={chip.label}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80"
            >
              <span className="text-white/40 mr-1">{chip.label}:</span>
              {chip.value}
            </span>
          ))}
          <button onClick={clearFilters} style={linkReset}>
            Reset filters
          </button>
        </div>

        {loading && (
          <div className={gridCls} aria-busy="true" aria-live="polite">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={alertError} role="alert">
            {error}{" "}
            {indexUrl ? (
              <>
                Firestore needs a composite index.{" "}
                <a href={indexUrl} target="_blank" rel="noreferrer" style={link}>
                  Open the index link
                </a>{" "}
                to auto-create it, then refresh.
              </>
            ) : (
              <>Check your Firestore rules and network.</>
            )}
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <Muted>No listings match your current filters.</Muted>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            <div className={gridCls}>
              {listings.map((l, i) => (
                <div
                  key={l.id}
                  className="fade-in"
                  style={{ animationDelay: getAnimDelay(l.id, i) }}
                >
                  <ListingCard
                    l={l}
                    onView={() => nav(`/listing/${l.id}`)}
                    onReserve={() => nav(`/listing/${l.id}?tab=reserve`)}
                    onFav={(e) => {
                      e?.stopPropagation?.();
                      toggleFav(l.id);
                    }}
                    isFaved={favs.has(l.id)}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true" />
            {hasMore && (
              <div style={{ display: "grid", placeItems: "center", marginTop: 16 }}>
                <button onClick={loadMore} style={btnGhost} aria-label="Load more results">
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

/* -------------------------- legacy inline bits kept -------------------------- */
const alertError = {
  color: "#fecaca",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.35)",
  padding: "12px 14px",
  borderRadius: 14,
  margin: "8px 0 16px",
};
const link = { color: "#facc15", textDecoration: "underline", fontWeight: 700 };
const linkReset = {
  color: "#facc15",
  marginLeft: 8,
  textDecoration: "underline",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
};
const btnGhost = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#e5e7eb",
  padding: "6px 14px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 13,
};

function Muted({ children }) {
  return (
    <div style={{ color: "#9aa4b2", padding: "20px 0", textAlign: "center", fontSize: 14 }}>
      {children}
    </div>
  );
}
