// src/pages/GuestExplorePage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { isFeaturedActive, getSponsoredUntilMs } from "../utils/featured";
import FavButton from "../components/FavButton";

const nf = new Intl.NumberFormat("en-NG");
const FALLBACK = "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60";

/* ─── Helpers ─── */
function digitsOnly(v) { return String(v || "").replace(/[^\d]/g, ""); }

function getListingCover(l) {
  if (!l) return null;
  if (Array.isArray(l.images)    && l.images[0])           return l.images[0];
  if (Array.isArray(l.imageUrls) && l.imageUrls[0])        return l.imageUrls[0];
  if (Array.isArray(l.photos)    && l.photos[0])           return l.photos[0];
  if (Array.isArray(l.media)     && l.media[0]?.url)       return l.media[0].url;
  return l.imageUrl || l.coverImage || l.heroImage || l.photo || null;
}

function isManagerOfListing(l, uid) {
  if (!l || !uid) return false;
  return [l.ownerId, l.ownerUid, l.hostId, l.hostUid, l.partnerUid, l.partnerId].includes(uid);
}

function normalizeCityKey(cityRaw) {
  const s = String(cityRaw || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";
  if (["abuja","abuja fct","fct","f.c.t","abuja-fct","abuja, fct"].includes(s)) return "abuja fct";
  if (s === "portharcourt" || s === "port-harcourt") return "port harcourt";
  return s;
}

function displayCityLabel(cityKeyOrRaw) {
  const key = normalizeCityKey(cityKeyOrRaw);
  if (!key) return "";
  if (key === "abuja fct") return "Abuja FCT";
  if (key === "port harcourt") return "Port Harcourt";
  return key.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function getRatingData(l) {
  const avg =
    Number.isFinite(Number(l?.ratingAvg))  && Number(l?.ratingAvg)  > 0 ? Number(l.ratingAvg)  :
    Number.isFinite(Number(l?.rating))      && Number(l?.rating)      > 0 ? Number(l.rating)      : 0;
  const count =
    Number.isFinite(Number(l?.ratingCount)) && Number(l?.ratingCount) >= 0 ? Number(l.ratingCount) : 0;
  return { avg, count };
}

/* ─── Stars ─── */
function Stars({ value = 0, count = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const stars = Array.from({ length: 5 }).map((_, i) =>
    i < Math.floor(v) ? "★" : (i === Math.floor(v) && v - Math.floor(v) >= 0.5) ? "⯪" : "☆"
  );
  if (!v && !count) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-amber-300 tracking-tight">{stars.join("")}</span>
      {v > 0 && <span className="text-white/70">{v.toFixed(1)}</span>}
      {count > 0
        ? <span className="text-white/40">({count})</span>
        : <span className="text-white/35 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5">New</span>
      }
    </div>
  );
}

/* ─── Listing card ─── */
function ListingCard({ l, idx, onNav, isManager }) {
  const cover = getListingCover(l);
  const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);
  const { avg, count } = getRatingData(l);
  const featuredActive = isFeaturedActive(l, Date.now());
  const tag = l.channelLabel || l.hostType || (l.partnerUid ? "Partner-managed" : null);
  const bedrooms = l.bedrooms || l.beds;
  const guests   = l.maxGuests || l.guests;
  const type     = l.propertyType || l.type;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.32, ease: "easeOut" }}
      className="group rounded-2xl border border-white/8 bg-[#0c1018] overflow-hidden
                 hover:border-amber-300/30 hover:-translate-y-1.5 transition-all duration-250
                 shadow-[0_12px_36px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
    >
      {/* Photo */}
      <div className="relative h-48 bg-black/40 overflow-hidden">
        <img
          src={cover || FALLBACK}
          alt={l.title || "Listing"}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          loading="lazy"
        />
        {/* Gradient bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c1018]/80 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <div className="flex gap-1.5">
            {featuredActive && (
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-400 text-black shadow-lg">
                Featured
              </span>
            )}
            {tag && (
              <span className="px-2 py-1 rounded-full text-[10px] bg-black/60 border border-white/15 text-white/80 backdrop-blur">
                {tag}
              </span>
            )}
          </div>
          <FavButton listingId={l.id} compact />
        </div>

        {/* Price overlay bottom */}
        <div className="absolute bottom-3 left-3">
          <span className="px-3 py-1 rounded-full bg-black/70 border border-white/10 backdrop-blur text-sm font-semibold text-white">
            ₦{nf.format(price)}<span className="text-white/50 text-xs font-normal"> /night</span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        <div>
          <h3 className="font-semibold text-white/95 truncate leading-snug">
            {l.title || "Luxury stay"}
          </h3>
          <p className="text-xs text-white/45 truncate mt-0.5">
            {[l.area, displayCityLabel(l.city) || "Nigeria"].filter(Boolean).join(", ")}
          </p>
        </div>

        <Stars value={avg} count={count} />

        {(bedrooms || guests || type) && (
          <div className="flex flex-wrap gap-1.5">
            {bedrooms && (
              <span className="px-2 py-0.5 rounded-full text-[11px] text-white/50 bg-white/4 border border-white/8">
                {bedrooms} bed{bedrooms > 1 ? "s" : ""}
              </span>
            )}
            {guests && (
              <span className="px-2 py-0.5 rounded-full text-[11px] text-white/50 bg-white/4 border border-white/8">
                Sleeps {guests}
              </span>
            )}
            {type && (
              <span className="px-2 py-0.5 rounded-full text-[11px] text-white/50 bg-white/4 border border-white/8">
                {type}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link
            to={`/listing/${l.id}`}
            className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold transition"
          >
            View
          </Link>
          {isManager ? (
            <Link
              to={`/listing/${l.id}/edit`}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition text-white/80"
            >
              Edit
            </Link>
          ) : (
            <button
              onClick={onNav}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition text-white/80"
            >
              Reserve
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Featured row ─── */
function FeaturedRow({ items, onOpen }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-3xl border border-amber-400/15 bg-gradient-to-br from-amber-400/5 to-transparent p-5 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.32em] uppercase text-amber-300/70 mb-1">Premium · Sponsored</p>
        <h2 className="text-lg font-semibold">Featured in your search</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {items.map((l) => {
          const cover = getListingCover(l);
          const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);
          const { avg, count } = getRatingData(l);
          return (
            <button
              key={l.id}
              onClick={() => onOpen(l)}
              className="snap-start shrink-0 w-64 text-left rounded-2xl overflow-hidden border border-white/10 bg-[#0c1018]
                         hover:border-amber-300/40 hover:-translate-y-1 transition-all duration-200"
            >
              <div className="relative h-36 bg-black/30 overflow-hidden">
                <img src={cover || FALLBACK} alt={l.title || "Featured"} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-black">Featured</span>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold truncate text-white/95">{l.title || "Luxury stay"}</div>
                <div className="text-xs text-white/45 truncate">{l.area || "—"}, {displayCityLabel(l.city) || "Nigeria"}</div>
                <div className="text-sm font-bold text-white">₦{nf.format(price)}<span className="text-xs text-white/40 font-normal"> /night</span></div>
                <Stars value={avg} count={count} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Skeleton ─── */
function Skeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-white/5 bg-[#0c1018] overflow-hidden"
    >
      <div className="h-48 bg-white/5 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/8 rounded w-2/3 animate-pulse" />
        <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-white/8 rounded w-1/3 animate-pulse" />
        <div className="flex gap-2 mt-3">
          <div className="h-8 bg-white/5 rounded-xl flex-1 animate-pulse" />
          <div className="h-8 bg-white/5 rounded-xl w-16 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─── */
export default function GuestExplorePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [kw,        setKw]        = useState("");
  const [cityKey,   setCityKey]   = useState("all");
  const [minN,      setMinN]      = useState("");
  const [maxN,      setMaxN]      = useState("");
  const [sortBy,    setSortBy]    = useState("newest");
  const [minRating, setMinRating] = useState("all");

  const requireLogin = useCallback(() => {
    nav("/login", { state: { from: "/explore", intent: "favourites" } });
  }, [nav]);

  useEffect(() => {
    const rawLoc = (params.get("loc") || params.get("city") || params.get("location") || params.get("q") || "").trim();
    const min = params.get("min") ? digitsOnly(params.get("min")) : "";
    const max = params.get("max") ? digitsOnly(params.get("max")) : "";
    if (rawLoc) setKw(rawLoc);
    if (min) setMinN(min);
    if (max) setMaxN(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const qRef = query(collection(db, "listings"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(150));
        const snap = await getDocs(qRef);
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        if (live) setRows(list);
      } catch (e) {
        console.error("GuestExplorePage:", e);
        if (live) { setRows([]); setError(e); }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const cityOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = normalizeCityKey(r?.city);
      if (key && !map.has(key)) map.set(key, displayCityLabel(key));
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  useEffect(() => {
    const rawLoc = (params.get("loc") || params.get("city") || params.get("location") || "").trim();
    const targetKey = normalizeCityKey(rawLoc);
    if (!targetKey) return;
    if (cityOptions.some((c) => c.key === targetKey)) setCityKey(targetKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityOptions]);

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const text = kw.trim().toLowerCase();
    const min  = minN ? Number(minN) : null;
    const max  = maxN ? Number(maxN) : null;
    const ratingFloor = minRating === "all" ? null : Number.isFinite(Number(minRating)) ? Number(minRating) : null;

    const base = rows.filter((r) => {
      const price = Number(r.pricePerNight || r.nightlyRate || r.price || 0);
      const rCityKey = normalizeCityKey(r.city);
      const inCity = cityKey === "all" || rCityKey === cityKey;
      const inText = !text || (r.title || "").toLowerCase().includes(text) || (r.area || "").toLowerCase().includes(text) || displayCityLabel(r.city).toLowerCase().includes(text);
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
      if (sortBy === "price_low")  return priceA - priceB;
      if (sortBy === "price_high") return priceB - priceA;
      if (sortBy === "premium") {
        const fa = isFeaturedActive(a, nowMs) ? 1 : 0;
        const fb = isFeaturedActive(b, nowMs) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        const ua = getSponsoredUntilMs(a.sponsoredUntil) ?? 0;
        const ub = getSponsoredUntilMs(b.sponsoredUntil) ?? 0;
        if (ua !== ub) return ub - ua;
      }
      return tsB - tsA;
    });
    return base;
  }, [rows, kw, cityKey, minN, maxN, sortBy, minRating]);

  const featuredInSearch = useMemo(() => {
    const nowMs = Date.now();
    const only = filtered.filter((l) => isFeaturedActive(l, nowMs));
    only.sort((a, b) => {
      const ua = getSponsoredUntilMs(a.sponsoredUntil) ?? 0;
      const ub = getSponsoredUntilMs(b.sponsoredUntil) ?? 0;
      if (ua !== ub) return ub - ua;
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    });
    return only.slice(0, 12);
  }, [filtered]);

  const featuredIds = useMemo(() => new Set(featuredInSearch.map((x) => x.id)), [featuredInSearch]);
  const gridRows    = useMemo(() => filtered.filter((x) => !featuredIds.has(x.id)), [filtered, featuredIds]);

  const resetFilters = () => { setKw(""); setCityKey("all"); setMinN(""); setMaxN(""); setSortBy("newest"); setMinRating("all"); };

  const AREA_CHIPS = ["Ikoyi", "Lekki", "VI", "Gwarinpa", "Asokoro", "Wuse II", "Jabi"];

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 text-white">
      <div className="max-w-6xl mx-auto px-4 space-y-6">

        {/* ── Filter panel ── */}
        <section className="rounded-3xl bg-[#0c1018] border border-white/8 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col md:flex-row md:items-end gap-5 mb-6">
            <div className="flex-1">
              <p className="text-[10px] tracking-[0.35em] uppercase text-amber-300/70 mb-2">
                NestaNg · Verified Stays
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
                Browse apartments across Nigeria.
              </h1>
              <p className="text-white/50 mt-2 text-sm font-light max-w-xl leading-relaxed">
                Lekki high-rises, Ikoyi penthouses, Abuja retreats. Filter by city, budget and
                rating — reserve in a few taps.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => nav("/favourites")}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-sm transition"
              >
                ♥ Favourites
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold hover:bg-amber-300 text-sm transition"
              >
                Clear filters
              </button>
            </div>
          </div>

          {/* Filter grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr,1fr,1fr,1fr,auto,auto] gap-2.5">
            {[
              { val: kw,        set: setKw,        placeholder: "Search title, area, city…", type: "text" },
              { val: minN,      set: setMinN,       placeholder: "Min ₦/night",              type: "number" },
              { val: maxN,      set: setMaxN,       placeholder: "Max ₦/night",              type: "number" },
            ].map(({ val, set, placeholder, type }, i) => (
              <input
                key={i}
                type={type}
                min={0}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm
                           outline-none focus:border-amber-400/60 placeholder-white/30 transition"
              />
            ))}

            <select value={cityKey} onChange={(e) => setCityKey(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400/60 transition">
              <option value="all">Any city</option>
              {cityOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>

            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400/60 transition">
              <option value="all">Any rating</option>
              <option value="4.5">4.5+ ★</option>
              <option value="4.0">4.0+ ★</option>
              <option value="3.0">3.0+ ★</option>
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400/60 transition">
              <option value="newest">Newest</option>
              <option value="price_low">Price ↑</option>
              <option value="price_high">Price ↓</option>
              <option value="premium">Premium first</option>
            </select>
          </div>

          {/* Area chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {AREA_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setKw(kw.toLowerCase() === c.toLowerCase() ? "" : c)}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  kw.toLowerCase() === c.toLowerCase()
                    ? "bg-amber-400 text-black border-amber-300 font-semibold"
                    : "bg-white/4 border-white/10 text-white/60 hover:bg-white/8 hover:text-white/85"
                }`}
              >
                {c}
              </button>
            ))}
            {!loading && (
              <span className="ml-auto self-center text-xs text-white/35">
                {filtered.length} stay{filtered.length !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
        </section>

        {/* ── Loading ── */}
        {loading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/8 p-6 text-rose-200 text-sm">
            Couldn't load listings. Please check your connection and try again.
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/4 p-8 text-center">
            <p className="text-lg font-semibold text-white/85 mb-2">No listings match your filters.</p>
            <p className="text-white/45 text-sm mb-4">Try a different city, rating or price range.</p>
            <button onClick={resetFilters} className="px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition">
              Clear filters
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <FeaturedRow items={featuredInSearch} onOpen={(l) => nav(`/listing/${l.id}`)} />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {gridRows.map((l, idx) => (
                <ListingCard
                  key={l.id}
                  l={l}
                  idx={idx}
                  isManager={isManagerOfListing(l, user?.uid)}
                  onNav={() => nav(`/reserve/${l.id}`, { state: { id: l.id, title: l.title, price: Number(l.pricePerNight || l.price || 0), hostId: l.ownerId || l.hostId || l.partnerUid || null } })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}