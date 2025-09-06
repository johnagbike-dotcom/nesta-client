// src/pages/ListingDetails.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

const NGN = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? `₦${n.toLocaleString("en-NG")}` : "";

function fmtDate(ts) {
  try {
    const d = ts?.toDate?.() ?? ts;
    return d ? new Date(d).toLocaleDateString() : "";
  } catch {
    return "";
  }
}

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [similar, setSimilar] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Load the listing
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const snap = await getDoc(doc(db, "listings", id));
        if (!alive) return;
        if (!snap.exists()) {
          setErr("Listing not found.");
        } else {
          setData({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        setErr(e?.message || "Failed to load listing.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load similar (same city + type), once we know listing data
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!data?.city || !data?.type) {
        setSimilar([]);
        return;
      }
      setLoadingSimilar(true);
      try {
        const q = query(
          collection(db, "listings"),
          where("city", "==", data.city),
          where("type", "==", data.type),
          limit(8)
        );
        const snaps = await getDocs(q);
        if (!alive) return;
        const items = [];
        snaps.forEach((s) => {
          if (s.id !== id) items.push({ id: s.id, ...s.data() });
        });
        setSimilar(items);
      } catch {
        if (alive) setSimilar([]);
      } finally {
        if (alive) setLoadingSimilar(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data?.city, data?.type, id]);

  const photos = useMemo(() => {
    const arr = Array.isArray(data?.photoUrls) ? data.photoUrls : [];
    if (arr.length) return arr.slice(0, 20);
    return [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop",
    ];
  }, [data]);

  if (loading) {
    return <div className="p-6 text-gray-300">Loading listing…</div>;
  }
  if (err) {
    return (
      <div className="p-6">
        <p className="text-red-400 mb-3">{err}</p>
        <Link className="underline" to="/browse">← Back to Browse</Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <Link to="/browse" className="text-sm underline">← Back to Browse</Link>
      </div>

      {/* Title & price */}
      <header className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">{data.title || "Listing"}</h1>
        <p className="text-indigo-400 font-semibold mt-1">
          {NGN(Number(data.pricePerNight || 0))}/night
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {(data.city || "—")}{data.area ? ` • ${data.area}` : ""}{data.type ? ` • ${data.type}` : ""}
        </p>
      </header>

      {/* Gallery + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gallery */}
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-gray-700">
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
              src={photos[Math.min(active, photos.length - 1)]}
              className="w-full h-[260px] sm:h-[360px] md:h-[420px] object-cover"
            />
          </div>

          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {photos.map((url, idx) => (
                <button
                  key={`${url}_${idx}`}
                  type="button"
                  onClick={() => setActive(idx)}
                  className={`relative h-16 rounded border ${
                    idx === active ? "border-indigo-500" : "border-gray-700"
                  } overflow-hidden`}
                  title={`Photo ${idx + 1}`}
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description / details */}
          <div className="mt-6 space-y-4">
            {data.description ? (
              <div>
                <h2 className="font-semibold mb-2">About this place</h2>
                <p className="text-gray-300 whitespace-pre-line">{data.description}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-700 p-3">
                <div className="font-medium mb-1">Stay details</div>
                <div className="text-gray-300">
                  <div>Type: {data.type || "—"}</div>
                  <div>City: {data.city || "—"}</div>
                  <div>Area: {data.area || "—"}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-700 p-3">
                <div className="font-medium mb-1">Amenities</div>
                <div className="text-gray-300">
                  <div>{data.liveInHost ? "Live-in host" : "Live-out"}</div>
                  <div>{data.billsIncluded ? "Bills included" : "Bills not included"}</div>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Updated {fmtDate(data.updatedAt) || fmtDate(data.createdAt) || "recently"}
            </p>
          </div>

          {/* Similar listings */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-3">
              Similar places in {data.city || "this area"}
            </h2>

            {loadingSimilar ? (
              <p className="text-gray-400 text-sm">Finding similar listings…</p>
            ) : similar.length === 0 ? (
              <p className="text-gray-400 text-sm">No close matches yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {similar.map((s) => {
                  const cover =
                    (Array.isArray(s.photoUrls) && s.photoUrls[0]) ||
                    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop";
                  return (
                    <Link
                      key={s.id}
                      to={`/listing/${s.id}`}
                      className="rounded-xl border border-gray-700 overflow-hidden hover:border-gray-500 transition"
                    >
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img src={cover} className="w-full h-40 object-cover" />
                      <div className="p-3">
                        <div className="font-medium">{s.title || "Listing"}</div>
                        <div className="text-sm text-gray-400">
                          {NGN(Number(s.pricePerNight || 0))}/night • {s.area || s.city || s.type || ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Sticky actions */}
        <aside className="lg:sticky lg:top-6 h-max">
          <div className="rounded-2xl border border-gray-700 p-4 bg-[#0b0f14]/70">
            <div className="text-lg font-semibold">
              {NGN(Number(data.pricePerNight || 0))}{" "}
              <span className="text-sm text-gray-400">/ night</span>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {data.city || "—"} {data.area ? `• ${data.area}` : ""} {data.type ? `• ${data.type}` : ""}
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => navigate(`/checkout/${id}`)}
                className="text-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
              >
                Book now
              </button>
              <a
                href={`mailto:host@example.com?subject=${encodeURIComponent(
                  `Enquiry for ${data.title || "listing"} (${id})`
                )}`}
                className="text-center px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 transition text-sm font-medium"
              >
                Contact host
              </a>
              <Link
                to="/browse"
                className="text-center px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 transition text-sm font-medium"
              >
                Back to Browse
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Secure checkout and ID checks coming soon.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}