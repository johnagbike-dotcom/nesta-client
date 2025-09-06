// src/pages/SearchBrowse.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  query as fsQuery,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

const PAGE_FETCH_SIZE = 60; // pull a chunk, then filter client-side

export default function SearchBrowse() {
  const navigate = useNavigate();
  const loc = useLocation();

  // URL-seeded filters
  const params = new URLSearchParams(loc.search);
  const [queryText, setQueryText] = useState(params.get("q") || "");
  const [minP, setMinP] = useState(params.get("min") || "");
  const [maxP, setMaxP] = useState(params.get("max") || "");
  const [type, setType] = useState("Any");
  const [liveIn, setLiveIn] = useState(false);
  const [billsInc, setBillsInc] = useState(false);

  // Data
  const [raw, setRaw] = useState([]);         // fetched (unfiltered)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load a recent chunk from Firestore (order by createdAt desc)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const qRef = fsQuery(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
          limit(PAGE_FETCH_SIZE)
        );
        const snap = await getDocs(qRef);
        if (cancelled) return;
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRaw(items);
      } catch (e) {
        console.error(e);
        setErr("We couldn’t load listings right now. Please try again shortly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply client-side filters
  const results = useMemo(() => {
    const q = (queryText || "").trim().toLowerCase();
    return raw.filter((l) => {
      // text match across a few fields
      const fields = [
        l.title,
        l.city,
        l.area,
        l.location,
        l.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesText = !q || fields.includes(q);

      const price = Number(l.pricePerNight || 0);
      const okMin = !minP || price >= Number(minP);
      const okMax = !maxP || price <= Number(maxP);
      const okType = type === "Any" || l.type === type;
      const okLive = !liveIn || !!l.liveInHost;
      const okBills = !billsInc || !!l.billsIncluded;

      return matchesText && okMin && okMax && okType && okLive && okBills;
    });
  }, [raw, queryText, minP, maxP, type, liveIn, billsInc]);

  // Submit updates URL
  const applyFilters = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (queryText) p.set("q", queryText);
    if (minP) p.set("min", minP);
    if (maxP) p.set("max", maxP);
    navigate(`/browse?${p.toString()}`);
  };

  const clearFilters = () => {
    setQueryText("");
    setMinP("");
    setMaxP("");
    setType("Any");
    setLiveIn(false);
    setBillsInc(false);
    navigate("/browse");
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          className="text-white/70 hover:text-white mb-4"
          onClick={() => navigate("/")}
        >
          ← Back to Home
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Browse listings</h1>

        {/* Filters */}
        <form onSubmit={applyFilters} className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Area, city or landmark (e.g. Lekki, Ikoyi)"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="col-span-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <input
              type="number"
              placeholder="Min ₦/night"
              value={minP}
              onChange={(e) => setMinP(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Max ₦/night"
                value={maxP}
                onChange={(e) => setMaxP(e.target.value)}
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <button
                type="submit"
                className="rounded-xl px-5 py-3 bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold shadow-[0_6px_0_#c47e00] hover:translate-y-[1px] hover:shadow-[0_5px_0_#c47e00] active:translate-y-[2px] active:shadow-[0_4px_0_#c47e00] transition"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            >
              <option>Any</option>
              <option>Spare Room</option>
              <option>Flat</option>
              <option>House</option>
            </select>

            <label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <input
                type="checkbox"
                checked={liveIn}
                onChange={(e) => setLiveIn(e.target.checked)}
              />
              <span className="text-sm">Live-in host</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <input
                type="checkbox"
                checked={billsInc}
                onChange={(e) => setBillsInc(e.target.checked)}
              />
              <span className="text-sm">Bills included</span>
            </label>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={clearFilters}
              className="text-white/70 hover:text-white underline"
            >
              Clear filters
            </button>
          </div>
        </form>

        {/* Results */}
        <section className="mt-8">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && err && (
            <p className="text-white/70">{err}</p>
          )}

          {!loading && !err && results.length === 0 && (
            <p className="text-white/70">
              No results yet — try widening your filters.
            </p>
          )}

          {!loading && !err && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((l) => (
                <article
                  key={l.id}
                  className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden relative"
                >
                  {l.isFeatured && (
                    <span className="absolute top-3 left-3 z-10 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-400 text-black shadow">
                      Featured
                    </span>
                  )}
                  <div className="aspect-[16/10] bg-white/5" />
                  <div className="p-4">
                    <h3 className="font-semibold group-hover:text-amber-300 transition line-clamp-1">
                      {l.title || "Untitled listing"}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      ₦{Number(l.pricePerNight || 0).toLocaleString()}/night •{" "}
                      {l.area || l.city || l.location || "—"}
                    </p>
                    <div className="mt-3">
                      <Link
                        to={`/listing/${l.id}`}
                        className="inline-block rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white hover:bg-white/15"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ——— Small presentational skeleton card ——— */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-white/10" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-white/10 rounded" />
      </div>
    </div>
  );
}