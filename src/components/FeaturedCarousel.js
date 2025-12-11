// src/components/FeaturedCarousel.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

export default function FeaturedCarousel() {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ─────────────── load from Firestore ─────────────── */

  useEffect(() => {
    let alive = true;

    async function loadFS() {
      setLoading(true);
      try {
        if (!db) throw new Error("Firestore db not initialised");

        // Grab a recent window, then filter in JS
        const qRef = query(
          collection(db, "listings"),
          orderBy("updatedAt", "desc"),
          limit(30)
        );
        const snap = await getDocs(qRef);
        if (!alive) return;

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const now = Date.now();

        const featured = rows.filter((r) => {
          // Must be sponsored/featured
          if (!r.sponsored && !r.featured) return false;

          // Optional sponsored window support
          if (r.sponsoredUntil && typeof r.sponsoredUntil.toMillis === "function") {
            const untilMs = r.sponsoredUntil.toMillis();
            if (untilMs < now) return false;
          }

          // Hide inactive / hidden
          const status = String(r.status || "").toLowerCase();
          if (status === "inactive" || status === "hidden") return false;

          return true;
        });

        // Helpful debug if needed
        console.log(
          "[FeaturedCarousel] rows=",
          rows.length,
          "featured=",
          featured.length
        );

        setItems(featured);
      } catch (e) {
        console.error("[FeaturedCarousel] load failed:", e);
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadFS();
    return () => {
      alive = false;
    };
  }, []);

  /* ─────────────── autoplay & index safety ─────────────── */

  const total = items.length;

  // keep index in range whenever items change
  useEffect(() => {
    if (total === 0) {
      setI(0);
      return;
    }
    if (i >= total) setI(0);
  }, [total, i]);

  // simple autoplay every 8s
  useEffect(() => {
    if (!total) return;
    const t = setInterval(() => {
      setI((prev) => ((prev + 1) % total));
    }, 8000);
    return () => clearInterval(t);
  }, [total]);

  const curr = useMemo(() => (total ? items[i] : null), [items, i, total]);

  function next() {
    if (!total) return;
    setI((v) => (v + 1) % total);
  }

  function prev() {
    if (!total) return;
    setI((v) => (v - 1 + total) % total);
  }

  /* ─────────────── skeleton / empty states ─────────────── */

  if (loading && !curr) {
    return (
      <div className="carousel">
        <div className="carousel-card skeleton" />
      </div>
    );
  }

  if (!curr) {
    return (
      <div className="carousel">
        <div className="carousel-card empty">
          <div className="meta">
            <div className="title">No featured stays yet</div>
            <div className="sub">
              As hosts start booking spotlight plans, their best listings will
              appear here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── image + meta helpers ─────────────── */

  const heroImage =
    (Array.isArray(curr.photos) && curr.photos[0]) ||
    (Array.isArray(curr.images) && curr.images[0]) ||
    (Array.isArray(curr.imageUrls) && curr.imageUrls[0]) ||
    curr.primaryImageUrl ||
    curr.coverImage ||
    curr.imageUrl ||
    curr.image ||
    null;

  const title = curr.title || "Featured stay";

  const price =
    curr.pricePerNight ||
    curr.nightlyRate ||
    curr.total ||
    curr.price ||
    0;

  const area = curr.area || "—";
  const city = curr.city || "Nigeria";

  return (
    <div className="carousel">
      <div className="carousel-card">
        <button
          className="nav left"
          onClick={prev}
          aria-label="Previous"
          type="button"
        >
          ‹
        </button>

        <div className="media">
          {heroImage ? (
            <img src={heroImage} alt={title} />
          ) : (
            <div className="media-fallback" />
          )}
        </div>

        <div className="meta">
          <div className="title">{title}</div>
          <div className="sub">
            ₦{Number(price || 0).toLocaleString()}/night · {area} · {city}
          </div>
        </div>

        <button
          className="nav right"
          onClick={next}
          aria-label="Next"
          type="button"
        >
          ›
        </button>
      </div>

      {total > 1 && (
        <div className="dots">
          {items.map((_, idx) => (
            <span
              key={idx}
              className={idx === i ? "dot active" : "dot"}
              onClick={() => setI(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
