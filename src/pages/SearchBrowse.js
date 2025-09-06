// src/pages/SearchBrowse.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";

const NGN = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? `₦${n.toLocaleString("en-NG")}` : "";

export default function SearchBrowse() {
  // data
  const [allListings, setAllListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters (UI state)
  const [qText, setQText] = useState(""); // city/area/title
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [type, setType] = useState("Any"); // Flat | House | Spare Room | Any
  const [liveInHost, setLiveInHost] = useState(false);
  const [billsIncluded, setBillsIncluded] = useState(false);

  // fetch once
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const qRef = query(collection(db, "listings"));
        const snap = await getDocs(qRef);
        if (!alive) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllListings(rows);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Failed to load listings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // derived filtered list (client-side for simplicity & no indexes needed)
  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    const min = minPrice === "" ? -Infinity : Number(minPrice);
    const max = maxPrice === "" ? Infinity : Number(maxPrice);

    return allListings.filter((l) => {
      const price = Number(l.pricePerNight || 0);

      if (Number.isFinite(min) && price < min) return false;
      if (Number.isFinite(max) && price > max) return false;

      if (type !== "Any" && (l.type || "").toLowerCase() !== type.toLowerCase())
        return false;

      if (liveInHost && !Boolean(l.liveInHost)) return false;
      if (billsIncluded && !Boolean(l.billsIncluded)) return false;

      if (t) {
        const hay =
          `${l.title || ""} ${l.city || ""} ${l.area || ""}`
            .toLowerCase()
            .normalize("NFKD");
        if (!hay.includes(t.normalize("NFKD"))) return false;
      }

      return true;
    });
  }, [allListings, qText, minPrice, maxPrice, type, liveInHost, billsIncluded]);

  // simple clear
  const clearFilters = () => {
    setQText("");
    setMinPrice("");
    setMaxPrice("");
    setType("Any");
    setLiveInHost(false);
    setBillsIncluded(false);
  };

  // UI bits
  if (loading) return <div className="p-6 text-gray-400">Loading listings…</div>;
  if (err)
    return (
      <div className="p-6">
        <p className="text-red-400 mb-3">{err}</p>
        <Link to="/" className="underline text-sm">← Back home</Link>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/" className="text-sm underline">← Back to Home</Link>
        <div className="text-xs text-gray-500">
          {filtered.length} of {allListings.length} results
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-4">Browse listings</h1>

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-700 bg-[#0b0f14]/70 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
          <input
            placeholder="Search by location, title or area"
            className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-gray-700"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="Min ₦/night"
            className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-gray-700"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="Max ₦/night"
            className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-gray-700"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <select
            className="w-full px-3 py-2 rounded-lg bg-[#0b0f14] border border-gray-700"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>Any</option>
            <option>Flat</option>
            <option>House</option>
            <option>Spare Room</option>
          </select>
        </div>

        <div className="mt-3 flex items-center flex-wrap gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={liveInHost}
              onChange={(e) => setLiveInHost(e.target.checked)}
            />
            <span className="text-sm">Live-in host</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={billsIncluded}
              onChange={(e) => setBillsIncluded(e.target.checked)}
            />
            <span className="text-sm">Bills included</span>
          </label>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg border border-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-gray-400">No listings match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((l) => (
            <article
              key={l.id}
              className="bg-[#0b0f14]/70 border border-gray-700 rounded-2xl shadow hover:shadow-xl transition flex flex-col overflow-hidden"
            >
              {/* Photo */}
              {Array.isArray(l.photoUrls) && l.photoUrls.length > 0 ? (
                <img
                  src={l.photoUrls[0]}
                  alt={l.title || "Listing image"}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="h-48 w-full bg-black/40 grid place-items-center text-gray-500">
                  Photo coming soon
                </div>
              )}

              {/* Body */}
              <div className="flex-1 p-4 flex flex-col">
                <h2 className="text-lg font-semibold mb-1">
                  {l.title || "Untitled"}
                </h2>
                <p className="text-indigo-400 font-medium mb-1">
                  {NGN(Number(l.pricePerNight || 0))}/night
                </p>
                <p className="text-gray-400 text-sm">
                  {l.city || "—"} {l.area ? `• ${l.area}` : ""}{" "}
                  {l.type ? `• ${l.type}` : ""}
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  {l.liveInHost ? <span>Live-in host</span> : <span>Live-out</span>}
                  <span>•</span>
                  {l.billsIncluded ? <span>Bills included</span> : <span>Bills not included</span>}
                </div>

                <div className="mt-auto pt-4">
                  <Link
                    to={`/listing/${l.id}`}
                    className="inline-block px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
                  >
                    View details →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}