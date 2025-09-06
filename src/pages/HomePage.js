// src/pages/HomePage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  limit as fbLimit,
  query,
} from "firebase/firestore";
import { db } from "../firebase";

// --- helpers ---
const NGN = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? `₦${n.toLocaleString("en-NG")}` : "";

function byUpdatedDesc(a, b) {
  const ta = a?.updatedAt?.toMillis?.() ?? 0;
  const tb = b?.updatedAt?.toMillis?.() ?? 0;
  return tb - ta;
}

function Card({ l }) {
  return (
    <article className="bg-[#0b0f14]/70 border border-gray-700 rounded-2xl shadow hover:shadow-xl transition overflow-hidden flex flex-col">
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

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold mb-1">{l.title || "Untitled"}</h3>
        <p className="text-indigo-400 font-medium mb-1">
          {NGN(Number(l.pricePerNight || 0))}/night
        </p>
        <p className="text-gray-400 text-sm">
          {l.city || "—"} {l.area ? `• ${l.area}` : ""} {l.type ? `• ${l.type}` : ""}
        </p>

        <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
          {l.liveInHost ? <span>Live-in host</span> : <span>Live-out</span>}
          <span>•</span>
          {l.billsIncluded ? <span>Bills included</span> : <span>Bills not included</span>}
        </div>

        <div className="mt-auto pt-4">
          <Link
            to={`/listing/${l.id}`}
            className="inline-block px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
          >
            View →
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Pull a small batch and sort/filter on client to avoid composite indexes.
        const qRef = query(collection(db, "listings"), fbLimit(30));
        const snap = await getDocs(qRef);
        if (!alive) return;
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Failed to load featured listings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const featured = useMemo(() => {
    const feats = rows.filter((r) => r.isFeatured);
    if (feats.length > 0) return feats.sort(byUpdatedDesc).slice(0, 8);
    // fallback: latest
    return [...rows].sort(byUpdatedDesc).slice(0, 8);
  }, [rows]);

  // Optional hero image (you can swap this URL or make it come from config)
  const hero =
    featured.find((f) => Array.isArray(f.photoUrls) && f.photoUrls.length)?.photoUrls?.[0] ??
    "https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="max-w-7xl mx-auto">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-b-2xl border-b border-gray-800">
        <img
          src={hero}
          alt="Nesta hero"
          className="w-full h-[220px] sm:h-[260px] md:h-[300px] object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Premium stays. Trusted homes. Across Nigeria
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-300">
            Discover premium short stays, long lets, and trusted homes—verified and easy to book.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              to="/browse"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
            >
              Browse listings
            </Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 transition text-sm font-medium"
            >
              Partner dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="p-6 sm:p-8">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Featured listings</h2>
          <Link to="/browse" className="text-sm underline">
            Browse all
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading featured…</p>
        ) : err ? (
          <p className="text-red-400">{err}</p>
        ) : featured.length === 0 ? (
          <p className="text-gray-400">No listings yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((l) => (
              <Card key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="px-6 sm:px-8 pb-6 text-xs text-gray-400">
        © {new Date().getFullYear()} Nesta. All rights reserved.{" "}
        <Link to="/terms" className="underline">Terms</Link>{" "}
        <Link to="/privacy" className="underline">Privacy</Link>{" "}
        <Link to="/help" className="underline">Help</Link>
      </footer>
    </div>
  );
}