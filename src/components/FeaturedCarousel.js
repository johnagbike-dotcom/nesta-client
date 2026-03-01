// src/components/FeaturedCarousel.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* ───────────────── helpers ───────────────── */
function getSponsoredUntilMs(v) {
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    const ms = d?.getTime?.();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function pickHeroImage(curr) {
  if (!curr) return null;
  return (
    (Array.isArray(curr.photos) && curr.photos[0]) ||
    (Array.isArray(curr.images) && curr.images[0]) ||
    (Array.isArray(curr.imageUrls) && curr.imageUrls[0]) ||
    curr.primaryImageUrl ||
    curr.coverImage ||
    curr.coverUrl ||
    curr.imageUrl ||
    curr.image ||
    null
  );
}

function prefetchImage(url) {
  if (!url) return;
  try {
    const img = new Image();
    img.src = url;
  } catch {
    // ignore
  }
}

/**
* ✅ Your schema (from screenshots):
* - status: "active"
* - sponsored: boolean
* - featured: boolean
* - sponsoredUntil: timestamp | null
*
* Therefore homepage eligibility is simply: status === "active"
*/
function isListingEligibleForHomepage(r) {
  if (!r) return false;
  return String(r.status || "").toLowerCase() === "active";
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(v, min), max);
}

/* Swipe threshold (px). Increase for stronger swipe requirement */
const SWIPE_TRIGGER = 90;

export default function FeaturedCarousel({
  fallbackMode = "latest", // "latest" | "none"
  limit = 12,
  hideEmptyState = false,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState(1); // 1 next, -1 prev
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState("featured"); // "featured" | "recommended"

  const autoplayRef = useRef(null);

  const LIMIT = clamp(limit, 1, 24);

  /* ───────────── load from Firestore ───────────── */
  useEffect(() => {
    let alive = true;

    async function loadFS() {
      setLoading(true);

      try {
        const now = Date.now();

        // 1) Best query: sponsored + featured + sponsoredUntil > now
        // (May require composite index.)
        const bestQ = query(
          collection(db, "listings"),
          where("sponsored", "==", true),
          where("featured", "==", true),
          where("sponsoredUntil", ">", new Date(now)),
          orderBy("sponsoredUntil", "desc"),
          firestoreLimit(LIMIT)
        );

        // 2) Index-safe pull to filter client-side if composite index is missing
        const fallbackFeaturedQ = query(
          collection(db, "listings"),
          orderBy("updatedAt", "desc"),
          firestoreLimit(120)
        );

        // 3) Latest listings fallback (homepage should not look empty)
        const latestQ = query(
          collection(db, "listings"),
          orderBy("updatedAt", "desc"),
          firestoreLimit(160)
        );

        let rows = [];
        let pickedMode = "featured";

        // Try best featured query
        try {
          const snap = await getDocs(bestQ);
          if (!alive) return;

          rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => {
              if (!isListingEligibleForHomepage(r)) return false;
              const untilMs = getSponsoredUntilMs(r.sponsoredUntil);
              if (!untilMs || untilMs <= now) return false;
              if (r.sponsored !== true) return false;
              if (r.featured !== true) return false;
              return true;
            })
            .slice(0, LIMIT);

          pickedMode = rows.length ? "featured" : "featured";
        } catch (bestErr) {
          console.warn(
            "[FeaturedCarousel] Best query failed (index likely missing). Falling back:",
            bestErr?.message || bestErr
          );

          // Fall back: pull recent and filter locally
          const snap = await getDocs(fallbackFeaturedQ);
          if (!alive) return;

          rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => {
              if (!isListingEligibleForHomepage(r)) return false;
              const untilMs = getSponsoredUntilMs(r.sponsoredUntil);
              if (!untilMs || untilMs <= now) return false;
              if (r.sponsored !== true) return false;
              if (r.featured !== true) return false;
              return true;
            })
            .slice(0, LIMIT);

          pickedMode = rows.length ? "featured" : "featured";
        }

        // If no featured found, use latest active listings (recommended) if allowed
        if ((!rows || rows.length === 0) && fallbackMode === "latest") {
          try {
            const snap = await getDocs(latestQ);
            if (!alive) return;

            rows = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((r) => isListingEligibleForHomepage(r))
              .slice(0, LIMIT);

            pickedMode = rows.length ? "recommended" : "recommended";
          } catch (e) {
            console.warn("[FeaturedCarousel] Latest fallback failed:", e?.message || e);
          }
        }

        if (alive) {
          setItems(Array.isArray(rows) ? rows : []);
          setMode(pickedMode);
          setI(0);
        }
      } catch (e) {
        console.error("[FeaturedCarousel] load failed:", e);
        if (alive) {
          setItems([]);
          setMode("featured");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadFS();
    return () => {
      alive = false;
    };
  }, [fallbackMode, LIMIT]);

  /* ───────────── autoplay ───────────── */
  const total = items.length;

  const clearAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = null;
  }, []);

  const startAutoplay = useCallback(() => {
    clearAutoplay();
    if (!total) return;
    autoplayRef.current = setInterval(() => {
      if (paused) return;
      setDir(1);
      setI((prev) => (prev + 1) % total);
    }, 8000);
  }, [clearAutoplay, total, paused]);

  useEffect(() => {
    startAutoplay();
    return () => clearAutoplay();
  }, [startAutoplay, clearAutoplay]);

  // keep index in range
  useEffect(() => {
    if (!total) {
      setI(0);
      return;
    }
    if (i >= total) setI(0);
  }, [total, i]);

  /* ───────────── current + prefetch next ───────────── */
  const curr = useMemo(() => (total ? items[i] : null), [items, i, total]);
  const heroImage = pickHeroImage(curr);

  const nextIndex = useMemo(() => (total ? (i + 1) % total : 0), [i, total]);
  const nextHero = useMemo(
    () => (total ? pickHeroImage(items[nextIndex]) : null),
    [items, nextIndex, total]
  );

  useEffect(() => {
    if (nextHero) prefetchImage(nextHero);
  }, [nextHero]);

  /* ───────────── actions ───────────── */
  const goToListing = useCallback(() => {
    if (!curr?.id) return;
    navigate(`/listing/${curr.id}`);
  }, [curr, navigate]);

  const next = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!total) return;
      setDir(1);
      setI((v) => (v + 1) % total);
    },
    [total]
  );

  const prev = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!total) return;
      setDir(-1);
      setI((v) => (v - 1 + total) % total);
    },
    [total]
  );

  /* ───────────── swipe handling ───────────── */
  const onDragStart = () => setPaused(true);

  const onDragEnd = (_e, info) => {
    const offsetX = info?.offset?.x ?? 0;
    if (offsetX < -SWIPE_TRIGGER) {
      setDir(1);
      setI((v) => (v + 1) % (total || 1));
    } else if (offsetX > SWIPE_TRIGGER) {
      setDir(-1);
      setI((v) => (v - 1 + (total || 1)) % (total || 1));
    }
    window.setTimeout(() => setPaused(false), 650);
  };

  /* ───────────── skeleton / empty ───────────── */
  if (loading && !curr) {
    return (
      <div className="carousel">
        <div className="carousel-card skeleton" />
      </div>
    );
  }

  // Homepage-safe: if empty, show skeleton instead of a "dead platform" message
  if (!curr) {
    if (hideEmptyState) {
      return (
        <div className="carousel">
          <div className="carousel-card skeleton" />
        </div>
      );
    }

    // Keep explicit empty state for any non-home pages where you prefer it
    return (
      <div className="carousel">
        <div className="carousel-card empty">
          <div className="meta">
            <div className="title">No featured stays yet</div>
            <div className="sub">
              Premium listings will appear here once spotlight plans are active.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───────────── meta ───────────── */
  const title = curr.title || "Featured stay";
  const price = curr.pricePerNight || curr.nightlyRate || curr.price || 0;
  const area = curr.area || curr.neighbourhood || "—";
  const city = curr.city || "Nigeria";

  // Badge text adjusts subtly based on source
  const badgeText = mode === "featured" ? "Featured" : "Nesta Recommended";

  /* ───────────── motion variants ───────────── */
  const slideVariants = {
    enter: (direction) =>
      reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, x: direction > 0 ? 18 : -18, scale: 0.995 },
    center: reduceMotion
      ? { opacity: 1, transition: { duration: 0.12 } }
      : {
          opacity: 1,
          x: 0,
          scale: 1,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        },
    exit: (direction) =>
      reduceMotion
        ? { opacity: 0, transition: { duration: 0.12 } }
        : {
            opacity: 0,
            x: direction > 0 ? -18 : 18,
            scale: 0.995,
            transition: { duration: 0.25, ease: "easeInOut" },
          },
  };

  return (
    <div className="carousel">
      {/* Local polish: focus ring + safe click area */}
      <style>{`
        .fc-focus:focus-visible {
          outline: 2px solid rgba(255, 199, 64, .95);
          outline-offset: 3px;
          border-radius: 20px;
        }
      `}</style>

      <div
        className="carousel-card cursor-pointer transition fc-focus"
        onClick={goToListing}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") goToListing();
          if (e.key === "ArrowRight") next(e);
          if (e.key === "ArrowLeft") prev(e);
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        aria-label={`Featured listing: ${title}`}
      >
        <button className="nav left" onClick={prev} aria-label="Previous" type="button">
          ‹
        </button>

        <div className="media" style={{ position: "relative" }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={curr.id}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ width: "100%", height: "100%" }}
            >
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                style={{ width: "100%", height: "100%" }}
              >
                {heroImage ? <img src={heroImage} alt={title} /> : <div className="media-fallback" />}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* badge */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#151006",
              background:
                "linear-gradient(180deg, rgba(255,215,74,0.98), rgba(255,173,12,0.96))",
              border: "1px solid rgba(255,210,64,0.65)",
              boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {badgeText}
          </div>

          {/* hint */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.16)",
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
            }}
          >
            Swipe · View stay →
          </div>
        </div>

        <div className="meta">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${curr.id}-meta`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={
                reduceMotion
                  ? { opacity: 1, transition: { duration: 0.12 } }
                  : { opacity: 1, y: 0, transition: { duration: 0.25 } }
              }
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, transition: { duration: 0.18 } }
              }
            >
              <div className="title">{title}</div>
              <div className="sub">
                ₦{Number(price || 0).toLocaleString()}/night · {area} · {city}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <button className="nav right" onClick={next} aria-label="Next" type="button">
          ›
        </button>
      </div>

      {total > 1 && (
        <div className="dots" aria-label="Featured carousel dots">
          {items.map((_, idx) => (
            <span
              key={idx}
              className={idx === i ? "dot active" : "dot"}
              role="button"
              tabIndex={0}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => {
                setDir(idx > i ? 1 : -1);
                setI(idx);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setDir(idx > i ? 1 : -1);
                  setI(idx);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
} 