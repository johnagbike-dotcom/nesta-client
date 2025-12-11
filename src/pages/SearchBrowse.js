// src/pages/SearchBrowse.js
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import FilterBar from "../components/FilterBar";

/* ---------------------- Inline styles & utilities ---------------------- */
const ShimmerAndFadeStyle = () => (
  <style>{`
/* --- Shimmer for skeletons --- */
@keyframes shimmer {
  0%   { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
.shimmer {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.06) 25%,
    rgba(255,255,255,0.12) 37%,
    rgba(255,255,255,0.06) 63%
  );
  background-size: 1000px 100%;
  animation: shimmer 1.6s linear infinite;
}

/* --- Fade-in handoff (staggered) --- */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in {
  opacity: 0;
  animation: fadeInUp .36s ease-out forwards;
  will-change: opacity, transform;
}

/* --- Accessible focus ring helper when using custom elements --- */
.focus-outline:focus-visible {
  outline: 2px solid #facc15;
  outline-offset: 2px;
  border-radius: 14px;
}

/* --- Toast styles --- */
.toast-wrap {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  display: grid;
  gap: 8px;
  z-index: 60;
}
.toast {
  background: rgba(17, 24, 39, .85);
  color: #e5e7eb;
  border: 1px solid rgba(250, 204, 21, .35);
  padding: 10px 14px;
  border-radius: 12px;
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
      const t = { id, msg: String(detail.msg || "Done"), type: detail.type || "info" };
      setToasts((prev) => [...prev, t]);
      // auto-dismiss
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, detail.timeoutMs || 2500);
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
  const img = Array.isArray(l.photos) && l.photos[0] ? l.photos[0] : null;
  const rating = Number(l.rating || 4.8).toFixed(1);
  const price = Number(l.pricePerNight || 0).toLocaleString();

  const onKey = (e) => {
    if (e.key === "Enter") onView?.();
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
      {/* Image */}
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

      {/* Body */}
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
          {(l.city ? `${String(l.city).trim()}` : "")}
          {l.area ? ` • ${String(l.area).trim()}` : ""}
        </div>
        <div className="mt-2 text-white font-semibold">
          ₦{price} <span className="text-white/60 font-normal">/ night</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-xl text-sm border border-white/15 bg-white/10 hover:bg-white/15"
            aria-label="View details"
          >
            View
          </button>
          <button
            onClick={onReserve}
            className="px-3 py-1.5 rounded-xl text-sm bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            aria-label="Reserve"
          >
            Reserve
          </button>
          <button
            onClick={onFav}
            className={`ml-auto px-3 py-1.5 rounded-xl text-sm border border-white/10 hover:bg-white/10 ${
              isFaved ? "text-amber-300 border-amber-300/40" : "text-white/80"
            }`}
            title={isFaved ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={isFaved ? "true" : "false"}
            aria-label={isFaved ? "Remove from favourites" : "Add to favourites"}
          >
            {isFaved ? "✓ Favourited" : "❤ Favourite"}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Shimmer Skeleton (same footprint) ---------------- */
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

export default function SearchBrowse() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const q = (params.get("q") || "").trim();
  const city = (params.get("city") || "").trim();
  const min = params.get("min") ? Number(params.get("min")) : undefined;
  const max = params.get("max") ? Number(params.get("max")) : undefined;

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState(null);
  const [indexUrl, setIndexUrl] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // for fade-in: remember what we have already shown
  const [seenIds, setSeenIds] = useState(() => new Set());

  // simple local favourites (wire to backend later)
  const [favs, setFavs] = useState(() => new Set());

  // infinite scroll sentinel
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  const isLoadingMoreRef = useRef(false);

  const col = useMemo(() => collection(db, "listings"), []);

  const gridCls =
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";

  /* -------------------------- Firestore fetch -------------------------- */
  useEffect(() => {
    let mounted = true;
    setLastDoc(null); // reset pagination on filter change
    setSeenIds(new Set()); // reset fade-in memory when filters change

    async function run(firstPage = true, afterDoc = null) {
      setLoading(true);
      setError(null);
      setIndexUrl(null);
      try {
        const parts = [];
        if (city) parts.push(where("city", "==", city));
        if (Number.isFinite(min)) parts.push(where("pricePerNight", ">=", min));
        if (Number.isFinite(max)) parts.push(where("pricePerNight", "<=", max));

        const order =
          Number.isFinite(min) || Number.isFinite(max)
            ? orderBy("pricePerNight", "asc")
            : orderBy("updatedAt", "desc");

        let baseQ = query(col, ...parts, order, limit(PAGE_LIMIT));
        if (!firstPage && afterDoc) {
          baseQ = query(col, ...parts, order, startAfter(afterDoc), limit(PAGE_LIMIT));
        }

        const snap = await getDocs(baseQ);
        let rows = snap.docs.map((d) => ({ id: d.id, ...d.data(), _snap: d }));

        if (q) {
          const needle = q.toLowerCase();
          rows = rows.filter((r) => {
            const title = (r.title || "").toString().toLowerCase();
            const cityStr = (r.city || "").toString().toLowerCase();
            const area = (r.area || "").toString().toLowerCase();
            return title.includes(needle) || cityStr.includes(needle) || area.includes(needle);
          });
        }

        if (!(Number.isFinite(min) || Number.isFinite(max))) {
          rows.sort((a, b) => {
            const at = toMillis(a?.updatedAt || a?.createdAt);
            const bt = toMillis(b?.updatedAt || b?.createdAt);
            return bt - at;
          });
        }

        if (!mounted) return;

        const nextLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
        setLastDoc(nextLast);
        setHasMore(Boolean(nextLast));

        setListings((prev) => (firstPage ? rows : [...prev, ...rows]));
        setLoading(false);
      } catch (err) {
        console.error("[Search] load failed:", err);
        if (!mounted) return;
        const m = (err?.message || "").match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
        if (m && m[0]) setIndexUrl(m[0]);
        setError("Couldn't load listings.");
        setLoading(false);
      }
    }

    run(true, null);
    return () => {
      mounted = false;
    };
  }, [city, q, min, max, col]);

  /* -------------------------- Load more (manual) -------------------------- */
  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const parts = [];
      if (city) parts.push(where("city", "==", city));
      if (Number.isFinite(min)) parts.push(where("pricePerNight", ">=", min));
      if (Number.isFinite(max)) parts.push(where("pricePerNight", "<=", max));
      const order =
        Number.isFinite(min) || Number.isFinite(max)
          ? orderBy("pricePerNight", "asc")
          : orderBy("updatedAt", "desc");
      const qMore = query(col, ...parts, order, startAfter(lastDoc), limit(PAGE_LIMIT));
      const snap = await getDocs(qMore);
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data(), _snap: d }));

      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter((r) => {
          const title = (r.title || "").toLowerCase();
          const cityStr = (r.city || "").toLowerCase();
          const area = (r.area || "").toLowerCase();
          return title.includes(needle) || cityStr.includes(needle) || area.includes(needle);
        });
      }
      if (!(Number.isFinite(min) || Number.isFinite(max))) {
        rows.sort((a, b) => {
          const at = toMillis(a?.updatedAt || a?.createdAt);
          const bt = toMillis(b?.updatedAt || b?.createdAt);
          return bt - at;
        });
      }
      const nextLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      setLastDoc(nextLast);
      setHasMore(Boolean(nextLast));
      setListings((prev) => [...prev, ...rows]);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [city, min, max, col, hasMore, lastDoc, q]);

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
        if (first && first.isIntersecting) {
          loadMore();
        }
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
        try {
          window.dispatchEvent(
            new CustomEvent("toast", { detail: { type: "info", msg: "Removed from favourites" } })
          );
        } catch {}
      } else {
        next.add(id);
        try {
          window.dispatchEvent(
            new CustomEvent("toast", { detail: { type: "info", msg: "Added to favourites" } })
          );
        } catch {}
      }
      return next;
    });
  }

  const filterChips = [
    { label: "Search", value: q || "Any" },
    { label: "City", value: city || "Any" },
    {
      label: "Min ₦",
      value: Number.isFinite(min) ? min.toLocaleString() : "Any",
    },
    {
      label: "Max ₦",
      value: Number.isFinite(max) ? max.toLocaleString() : "Any",
    },
  ];

  /* -------------------------- Render -------------------------- */
  return (
    <main
      className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white"
    >
      <ShimmerAndFadeStyle />
      <ToastHub />

      <div
        className="max-w-6xl mx-auto"
        style={{ marginTop: 80, padding: "0 16px 32px" }}
      >
        {/* Header row */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => window.history.back()} className="btn" style={btnGhost}>
              ← Back
            </button>
            {listings.length > 0 && !loading && (
              <span className="text-xs text-white/60">
                {listings.length} stay{listings.length === 1 ? "" : "s"} found
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
              Refine your search to find curated apartments, townhouses, and villas across
              Nesta’s verified homes.
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 mb-3">
          <FilterBar />
        </div>

        {/* Filter summary chips */}
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

        {/* Loading -> shimmer skeleton grid */}
        {loading && (
          <div className={gridCls} aria-busy="true" aria-live="polite">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={alertError} role="alert">
            {error}{" "}
            {indexUrl ? (
              <>
                If the console shows an index URL, click it or{" "}
                <a href={indexUrl} target="_blank" rel="noreferrer" style={link}>
                  open this link
                </a>{" "}
                to auto-create the index, then refresh.
              </>
            ) : (
              <>Check your Firestore rules and network.</>
            )}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && listings.length === 0 && (
          <Muted>No listings match your current filters.</Muted>
        )}

        {/* Results */}
        {!loading && !error && listings.length > 0 && (
          <>
            <div className={gridCls}>
              {listings.map((l, i) => {
                // mark as seen for fade-in stagger
                if (!seenIds.has(l.id)) {
                  setTimeout(() => {
                    setSeenIds((prev) => {
                      if (prev.has(l.id)) return prev;
                      const next = new Set(prev);
                      next.add(l.id);
                      return next;
                    });
                  }, 0);
                }
                const delayMs = (i % 12) * 40; // gentle stagger
                return (
                  <div
                    key={l.id}
                    className="fade-in"
                    style={{ animationDelay: `${delayMs}ms` }}
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
                );
              })}
            </div>

            {/* Infinite scroll sentinel + accessible fallback button */}
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

/* -------------------------- helpers -------------------------- */
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.seconds) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  if (ts instanceof Date) return ts.getTime();
  return 0;
}
function fmtTime(ts) {
  const ms = toMillis(ts);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}
function safe(v) {
  return typeof v === "string" ? v : "";
}
function cap(s) {
  if (!s) return "";
  const t = String(s);
  return t.charAt(0).toUpperCase() + t.slice(1);
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
const link = {
  color: "#facc15",
  textDecoration: "underline",
  fontWeight: 700,
};
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
    <div
      style={{
        color: "#9aa4b2",
        padding: "20px 0",
        textAlign: "center",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}
