// src/pages/GuestExplorePage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";

// ✅ single source of truth (shared across app)
import { isFeaturedActive, getSponsoredUntilMs } from "../utils/featured";

// ✅ favourites
import FavButton from "../components/FavButton";

const nf = new Intl.NumberFormat("en-NG");
const FALLBACK =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60";

/* ───────────────────────── helpers ───────────────────────── */

function getListingCover(listing) {
  if (!listing) return null;

  if (Array.isArray(listing.images) && listing.images[0]) return listing.images[0];
  if (Array.isArray(listing.imageUrls) && listing.imageUrls[0]) return listing.imageUrls[0];
  if (Array.isArray(listing.photos) && listing.photos[0]) return listing.photos[0];
  if (Array.isArray(listing.media) && listing.media[0]?.url) return listing.media[0].url;

  if (listing.imageUrl) return listing.imageUrl;
  if (listing.coverImage) return listing.coverImage;
  if (listing.heroImage) return listing.heroImage;
  if (listing.photo) return listing.photo;

  return null;
}

function isManagerOfListing(listing, uid) {
  if (!listing || !uid) return false;
  return (
    uid === listing.ownerId ||
    uid === listing.ownerUid ||
    uid === listing.hostId ||
    uid === listing.hostUid ||
    uid === listing.partnerUid ||
    uid === listing.partnerId
  );
}

function normalizeCityKey(cityRaw) {
  const s = String(cityRaw || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";

  // Abuja variants
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

  // Port Harcourt variants
  if (s === "portharcourt" || s === "port-harcourt") return "port harcourt";

  return s;
}

function displayCityLabel(cityKeyOrRaw) {
  const key = normalizeCityKey(cityKeyOrRaw);
  if (!key) return "";

  if (key === "abuja fct") return "Abuja FCT";
  if (key === "port harcourt") return "Port Harcourt";

  return key
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * ✅ Rating source of truth:
 * - New: ratingAvg + ratingCount (from reviews aggregation)
 * - Fallback: rating (legacy)
 */
function getRatingData(l) {
  const avg =
    Number.isFinite(Number(l?.ratingAvg)) && Number(l?.ratingAvg) > 0
      ? Number(l.ratingAvg)
      : Number.isFinite(Number(l?.rating)) && Number(l?.rating) > 0
      ? Number(l.rating)
      : 0;

  const count =
    Number.isFinite(Number(l?.ratingCount)) && Number(l?.ratingCount) >= 0
      ? Number(l.ratingCount)
      : 0;

  return { avg, count };
}

function Stars({ value = 0, count = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const full = Math.floor(v);
  const hasHalf = v - full >= 0.5;

  const stars = Array.from({ length: 5 }).map((_, i) => {
    if (i < full) return "★";
    if (i === full && hasHalf) return "⯪";
    return "☆";
  });

  if (!v && !count) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-1 rounded-full bg-black/40 border border-white/10 text-white/85">
        <span className="text-amber-300">{stars.join("")}</span>{" "}
        <span className="text-white/80">{v.toFixed(1)}</span>
      </span>
      {count > 0 ? (
        <span className="text-white/55">
          {count} review{count === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-white/45">New</span>
      )}
    </div>
  );
}

function FeaturedRow({ items, onOpen }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-amber-200/70">
            Premium
          </div>
          <h2 className="text-lg md:text-xl font-bold">Featured in your search</h2>
          <p className="text-xs text-white/60 mt-1">
            Sponsored placements — verified luxury picks.
          </p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 pr-2 snap-x snap-mandatory">
        {items.map((l) => {
          const cover = getListingCover(l);
          const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);
          const { avg, count } = getRatingData(l);

          return (
            <button
              key={l.id}
              onClick={() => onOpen(l)}
              className="snap-start shrink-0 w-[260px] md:w-[320px] text-left rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-300/40 transition"
              style={{ cursor: "pointer" }}
              aria-label={`Open featured listing ${l.title || "listing"}`}
            >
              <div className="h-36 md:h-40 bg-black/30 overflow-hidden relative">
                <img
                  src={cover || FALLBACK}
                  alt={l.title || "Featured listing"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-amber-400 text-black font-semibold shadow">
                  Featured
                </span>
              </div>

              <div className="p-3">
                <div className="text-sm font-semibold truncate">
                  {l.title || "Luxury stay"}
                </div>
                <div className="text-xs text-white/60 truncate">
                  {l.area || "—"}, {displayCityLabel(l.city) || "Nigeria"}
                </div>

                <div className="mt-2 text-sm font-bold">
                  ₦{nf.format(price)}
                  <span className="text-xs text-white/50 font-normal"> / night</span>
                </div>

                <div className="mt-2">
                  <Stars value={avg} count={count} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── component ───────────────────────── */

export default function GuestExplorePage() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [kw, setKw] = useState("");
  const [cityKey, setCityKey] = useState("all");
  const [minN, setMinN] = useState("");
  const [maxN, setMaxN] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | price_low | price_high | premium
  const [minRating, setMinRating] = useState("all"); // all | 4.5 | 4.0 | 3.0

  // ✅ used by FavButton when not logged in
  const requireLogin = useCallback(() => {
    nav("/login", { state: { from: "/explore", intent: "favourites" } });
  }, [nav]);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const qRef = query(
          collection(db, "listings"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          limit(150)
        );

        const snap = await getDocs(qRef);
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        if (live) setRows(list);
      } catch (e) {
        console.error("GuestExplorePage listings error:", e);
        if (live) {
          setRows([]);
          setError(e);
        }
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
    // eslint-disable-next-line
  }, []);

  const cityOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = normalizeCityKey(r?.city);
      if (!key) return;
      if (!map.has(key)) map.set(key, displayCityLabel(key));
    });

    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const text = kw.trim().toLowerCase();
    const min = minN ? Number(minN) : null;
    const max = maxN ? Number(maxN) : null;

    const ratingFloor =
      minRating === "all" ? null : Number.isFinite(Number(minRating)) ? Number(minRating) : null;

    const base = rows.filter((r) => {
      const price = Number(r.pricePerNight || r.nightlyRate || r.price || 0);

      const rCityKey = normalizeCityKey(r.city);
      const inCity = cityKey === "all" || rCityKey === cityKey;

      const inText =
        !text ||
        (r.title || "").toLowerCase().includes(text) ||
        (r.area || "").toLowerCase().includes(text) ||
        displayCityLabel(r.city).toLowerCase().includes(text);

      const okMin = min == null || price >= min;
      const okMax = max == null || price <= max;

      const { avg } = getRatingData(r);
      const okRating = ratingFloor == null || (avg > 0 && avg >= ratingFloor);

      return inCity && inText && okMin && okMax && okRating;
    });

    base.sort((a, b) => {
      const priceA = Number(a.pricePerNight || a.nightlyRate || a.price || 0);
      const priceB = Number(b.pricePerNight || b.nightlyRate || b.price || 0);
      const tsA = a.createdAt?.toMillis?.() ?? 0;
      const tsB = b.createdAt?.toMillis?.() ?? 0;

      if (sortBy === "price_low") return priceA - priceB;
      if (sortBy === "price_high") return priceB - priceA;

      if (sortBy === "premium") {
        const fa = isFeaturedActive(a, nowMs) ? 1 : 0;
        const fb = isFeaturedActive(b, nowMs) ? 1 : 0;
        if (fa !== fb) return fb - fa;

        const ua = getSponsoredUntilMs(a.sponsoredUntil) ?? 0;
        const ub = getSponsoredUntilMs(b.sponsoredUntil) ?? 0;
        if (ua !== ub) return ub - ua;

        return tsB - tsA;
      }

      return tsB - tsA;
    });

    return base;
  }, [rows, kw, cityKey, minN, maxN, sortBy, minRating]);

  const featuredInSearch = useMemo(() => {
    const nowMs = Date.now();
    const onlyFeatured = filtered.filter((l) => isFeaturedActive(l, nowMs));

    onlyFeatured.sort((a, b) => {
      const ua = getSponsoredUntilMs(a.sponsoredUntil) ?? 0;
      const ub = getSponsoredUntilMs(b.sponsoredUntil) ?? 0;
      if (ua !== ub) return ub - ua;

      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    return onlyFeatured.slice(0, 12);
  }, [filtered]);

  // ✅ prevent duplicates: hide featured from the main grid
  const featuredIds = useMemo(() => new Set(featuredInSearch.map((x) => x.id)), [featuredInSearch]);
  const gridRows = useMemo(() => filtered.filter((x) => !featuredIds.has(x.id)), [filtered, featuredIds]);

  const resultCount = filtered.length;

  const resetFilters = () => {
    setKw("");
    setCityKey("all");
    setMinN("");
    setMaxN("");
    setSortBy("newest");
    setMinRating("all");
  };

  const nowMsForBadges = Date.now();

  const subtitleText = loading
    ? "Loading listings…"
    : error && !user
    ? "Sign in to view Nesta’s verified stays."
    : `${resultCount} stay${resultCount === 1 ? "" : "s"} found`;

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-12 px-4 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* hero / header */}
        <section className="rounded-3xl bg-gradient-to-br from-[#141824] via-[#090c12] to-black/95 border border-white/5 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-xs tracking-[0.35em] uppercase text-amber-200/75">
            Nesta • Luxury stays
          </p>

          <div className="flex flex-col md:flex-row md:items-end gap-4 mt-3">
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Browse verified apartments across Nigeria.
              </h1>
              <p className="text-gray-200/80 max-w-2xl">
                Lekki high-rises, Ikoyi penthouses, Abuja retreats. Filter by city,
                budget, and rating — then reserve in a few taps.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => nav("/favourites")}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/90 hover:bg-white/10 text-sm"
                  title="Open favourites"
                >
                  Favourites
                </button>

                <button
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
                >
                  Clear filters
                </button>
              </div>

              <div className="text-xs text-white/60">{subtitleText}</div>
            </div>
          </div>

          {/* filters row */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1.4fr,1fr,1fr,1fr,auto,auto] gap-3">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="Search (title, area, city)…"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-amber-400/70 text-sm"
            />

            <select
              value={cityKey}
              onChange={(e) => setCityKey(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-amber-400/70 text-sm"
            >
              <option value="all">Any city</option>
              {cityOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              value={minN}
              onChange={(e) => setMinN(e.target.value)}
              placeholder="Min ₦/night"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-amber-400/70 text-sm"
            />

            <input
              type="number"
              min={0}
              value={maxN}
              onChange={(e) => setMaxN(e.target.value)}
              placeholder="Max ₦/night"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-amber-400/70 text-sm"
            />

            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none focus:border-amber-400/70"
              title="Minimum rating"
            >
              <option value="all">Any rating</option>
              <option value="4.5">4.5+ stars</option>
              <option value="4.0">4.0+ stars</option>
              <option value="3.0">3.0+ stars</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none focus:border-amber-400/70"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: low → high</option>
              <option value="price_high">Price: high → low</option>
              <option value="premium">Premium first</option>
            </select>
          </div>

          {/* quick chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {["Ikoyi", "Lekki", "VI", "Gwarinpa", "Asokoro", "Wuse 2"].map((c) => (
              <button
                key={c}
                onClick={() => setKw(c)}
                className={`px-3 py-1.5 rounded-full text-xs md:text-sm border ${
                  kw.toLowerCase() === c.toLowerCase()
                    ? "bg-amber-400 text-black border-amber-300"
                    : "bg-black/20 border-white/10 text-white/80 hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* content */}
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.article
                key={`skeleton-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.25)] animate-pulse"
              >
                <div className="h-40 bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-5 bg-white/10 rounded w-1/3 mt-2" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-8 bg-white/5 rounded-xl flex-1" />
                    <div className="h-8 bg-white/5 rounded-xl w-16" />
                    <div className="h-8 bg-white/5 rounded-xl w-16" />
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-6 text-center">
            <h2 className="text-lg font-semibold mb-1">No listings match your filters.</h2>
            <p className="text-gray-200 text-sm">Try another city, rating, or clear min/max price.</p>
          </div>
        ) : (
          <>
            <FeaturedRow items={featuredInSearch} onOpen={(l) => nav(`/listing/${l.id}`)} />
            {featuredInSearch.length ? <div className="h-2" /> : null}

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {gridRows.map((l, idx) => {
                const featuredActive = isFeaturedActive(l, nowMsForBadges);
                const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);
                const tag =
                  l.channelLabel || l.hostType || (l.partnerUid ? "Partner-managed" : "Host-managed");

                const bedrooms = l.bedrooms || l.beds;
                const guests = l.maxGuests || l.guests;
                const type = l.propertyType || l.type;

                const cover = getListingCover(l);
                const isManager = isManagerOfListing(l, user?.uid);

                const { avg, count } = getRatingData(l);

                return (
                  <motion.article
                    key={l.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.35, ease: "easeOut" }}
                    className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden hover:border-amber-300/50 hover:-translate-y-1 transition-all duration-200 shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
                  >
                    <div className="relative h-40 bg-black/40 overflow-hidden">
                      <img
                        src={cover || FALLBACK}
                        alt={l.title || "Listing"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      <div className="absolute top-2 right-2 z-10">
                        <FavButton listingId={l.id} compact onRequireLogin={requireLogin} />
                      </div>

                      {featuredActive && (
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-400 text-black shadow">
                          Featured
                        </div>
                      )}

                      {tag && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-[10px] bg-black/65 border border-white/15 text-white/85 backdrop-blur">
                          {tag}
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{l.title || "Luxury stay"}</h3>
                        <p className="text-gray-300 text-xs md:text-sm truncate">
                          {l.area || "—"}, {displayCityLabel(l.city) || "Nigeria"}
                        </p>
                      </div>

                      {/* ✅ stars visible on every card (if any reviews exist) */}
                      <Stars value={avg} count={count} />

                      <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                        {bedrooms ? (
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                            {bedrooms} bedroom{bedrooms > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {guests ? (
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                            Sleeps {guests}
                          </span>
                        ) : null}
                        {type ? (
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                            {type}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-lg font-bold mt-1">
                        ₦{nf.format(price)}
                        <span className="text-xs text-gray-400 ml-1">/ night</span>
                      </p>

                      <div className="flex gap-2 mt-3">
                        <Link
                          to={`/listing/${l.id}`}
                          className="flex-1 text-center px-3 py-1.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                        >
                          View
                        </Link>

                        {isManager ? (
                          <Link
                            to={`/listing/${l.id}/edit`}
                            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
                          >
                            Edit
                          </Link>
                        ) : (
                          <button
                            onClick={() =>
                              nav(`/reserve/${l.id}`, {
                                state: {
                                  id: l.id,
                                  title: l.title,
                                  price,
                                  hostId: l.ownerId || l.hostId || l.partnerUid || null,
                                },
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
                          >
                            Reserve
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
