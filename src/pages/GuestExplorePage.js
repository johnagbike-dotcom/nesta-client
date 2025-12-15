import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";

// ✅ single source of truth (shared across app)
import { isFeaturedActive, getSponsoredUntilMs } from "../utils/featured";

const nf = new Intl.NumberFormat("en-NG");
const FALLBACK =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60";

/* ───────────────────────── helpers ───────────────────────── */

function getListingCover(listing) {
  if (!listing) return null;

  if (Array.isArray(listing.images) && listing.images[0]) return listing.images[0];
  if (Array.isArray(listing.imageUrls) && listing.imageUrls[0]) return listing.imageUrls[0];
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
    uid === listing.hostId ||
    uid === listing.hostUid ||
    uid === listing.partnerUid ||
    uid === listing.partnerId
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
  const [city, setCity] = useState("all");
  const [minN, setMinN] = useState("");
  const [maxN, setMaxN] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | price_low | price_high | premium

  /* ───────────────────────── load listings ───────────────────────── */

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
          limit(120)
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
  }, []);

  /* ───────────────────────── derived: cities ───────────────────────── */

  const cities = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.city && s.add(r.city));
    return Array.from(s).sort();
  }, [rows]);

  /* ───────────────────────── derived: filtered + sorted ───────────────────────── */

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const text = kw.trim().toLowerCase();
    const min = minN ? Number(minN) : null;
    const max = maxN ? Number(maxN) : null;

    const base = rows.filter((r) => {
      const price = Number(r.pricePerNight || r.nightlyRate || r.price || 0);

      const inCity =
        city === "all" || (r.city || "").toLowerCase() === city.toLowerCase();

      const inText =
        !text ||
        (r.title || "").toLowerCase().includes(text) ||
        (r.area || "").toLowerCase().includes(text) ||
        (r.city || "").toLowerCase().includes(text);

      const okMin = min == null || price >= min;
      const okMax = max == null || price <= max;

      return inCity && inText && okMin && okMax;
    });

    base.sort((a, b) => {
      const priceA = Number(a.pricePerNight || a.nightlyRate || a.price || 0);
      const priceB = Number(b.pricePerNight || b.nightlyRate || b.price || 0);
      const tsA = a.createdAt?.toMillis?.() ?? 0;
      const tsB = b.createdAt?.toMillis?.() ?? 0;

      if (sortBy === "price_low") return priceA - priceB;
      if (sortBy === "price_high") return priceB - priceA;

      if (sortBy === "premium") {
        // ✅ only featured if ACTIVE (not expired)
        const fa = isFeaturedActive(a, nowMs) ? 1 : 0;
        const fb = isFeaturedActive(b, nowMs) ? 1 : 0;
        if (fa !== fb) return fb - fa;

        // tie-break: later expiry first (keeps high-value placements prominent)
        const ua = getSponsoredUntilMs(a.sponsoredUntil) ?? 0;
        const ub = getSponsoredUntilMs(b.sponsoredUntil) ?? 0;
        if (ua !== ub) return ub - ua;

        return tsB - tsA;
      }

      // default: newest
      return tsB - tsA;
    });

    return base;
  }, [rows, kw, city, minN, maxN, sortBy]);

  const resultCount = filtered.length;

  const resetFilters = () => {
    setKw("");
    setCity("all");
    setMinN("");
    setMaxN("");
    setSortBy("newest");
  };

  const renderSkeletonCard = (i) => (
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
  );

  const subtitleText = loading
    ? "Loading listings…"
    : error && !user
    ? "Sign in to view Nesta’s verified stays."
    : `${resultCount} stay${resultCount === 1 ? "" : "s"} found`;

  // ✅ compute once per render (not inside each map)
  const nowMsForBadges = Date.now();

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
                Lekki high-rises, Ikoyi penthouses, Abuja retreats. Filter by
                city, budget, and vibe — then reserve in a few taps.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
              >
                Clear filters
              </button>
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
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-amber-400/70 text-sm"
            >
              <option value="all">Any city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
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
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none focus:border-amber-400/70"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: low → high</option>
              <option value="price_high">Price: high → low</option>
              <option value="premium">Premium first</option>
            </select>
            <button
              type="button"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs md:text-sm hover:bg-white/10"
            >
              Advanced
            </button>
          </div>

          {/* quick chips (areas) */}
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
            {Array.from({ length: 6 }).map((_, i) => renderSkeletonCard(i))}
          </div>
        ) : error && !user ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-6 text-center space-y-3">
            <h2 className="text-lg font-semibold">
              Create an account to view Nesta listings.
            </h2>
            <p className="text-gray-200 text-sm max-w-xl mx-auto">
              To protect hosts and partners, our full catalogue is available to
              signed-in guests only. It takes less than a minute to get started.
            </p>
            <div className="flex justify-center gap-3 mt-2 flex-wrap">
              <button
                onClick={() => nav("/login?next=/explore")}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
              >
                Log in
              </button>
              <button
                onClick={() => nav("/signup?next=/explore")}
                className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 text-sm"
              >
                Get started
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-6 text-center">
            <h2 className="text-lg font-semibold mb-1">
              No listings match your filters.
            </h2>
            <p className="text-gray-200 text-sm">
              Try another city or clear the min/max price.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l, idx) => {
              const featuredActive = isFeaturedActive(l, nowMsForBadges);

              const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);
              const tag =
                l.channelLabel ||
                l.hostType ||
                (l.partnerUid ? "Partner-managed" : "Host-managed");

              const bedrooms = l.bedrooms || l.beds;
              const guests = l.maxGuests || l.guests;
              const type = l.propertyType || l.type;

              const cover = getListingCover(l);

              const isManager = isManagerOfListing(l, user?.uid);

              return (
                <motion.article
                  key={l.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: idx * 0.05,
                    duration: 0.4,
                    ease: "easeOut",
                  }}
                  className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden hover:border-amber-300/50 hover:-translate-y-1 transition-all duration-200 shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="relative h-40 bg-black/40 overflow-hidden">
                    <img
                      src={cover || FALLBACK}
                      alt={l.title || "Listing"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">
                          {l.title || "Luxury stay"}
                        </h3>
                        <p className="text-gray-300 text-xs md:text-sm truncate">
                          {l.area || "—"}, {l.city || "Nigeria"}
                        </p>
                      </div>
                      {l.rating && (
                        <div className="flex items-center gap-1 text-xs bg-black/40 px-2 py-1 rounded-full">
                          <span>★</span>
                          <span>{Number(l.rating).toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                      {bedrooms && (
                        <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                          {bedrooms} bedroom{bedrooms > 1 ? "s" : ""}
                        </span>
                      )}
                      {guests && (
                        <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                          Sleeps {guests}
                        </span>
                      )}
                      {type && (
                        <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                          {type}
                        </span>
                      )}
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
                        <>
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

                          <button
                            onClick={() =>
                              nav("/chat", {
                                state: {
                                  partnerUid: l.partnerUid || l.hostId || l.ownerId || null,
                                  listing: { id: l.id, title: l.title || "Listing" },
                                  from: "explore",
                                },
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-white/0 border border-white/5 text-sm hover:bg-white/5"
                          >
                            Chat
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
