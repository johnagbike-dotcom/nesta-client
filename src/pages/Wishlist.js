// src/pages/Wishlist.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, where, query, getDocs, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { useFavourites } from "../hooks/useFavourites";
import { Link, useNavigate } from "react-router-dom";

const nf = new Intl.NumberFormat("en-NG");
const FALLBACK =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60";

/* ───────────────── helpers ───────────────── */

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

export default function Wishlist() {
  const navigate = useNavigate();

  const { favIds, ready, remove } = useFavourites();

  const ids = useMemo(() => Array.from(favIds || []), [favIds]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      // Firestore IN supports up to 10 — batch if needed
      const batches = [];
      for (let i = 0; i < ids.length; i += 10) {
        const slice = ids.slice(i, i + 10);
        const qRef = query(collection(db, "listings"), where(documentId(), "in", slice));
        batches.push(getDocs(qRef));
      }

      const snaps = await Promise.all(batches);
      const all = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

      // keep order consistent with favIds (nice UX)
      const byId = new Map(all.map((x) => [x.id, x]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

      setRows(ordered);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    // avoid flicker on first auth snapshot
    if (!ready) return;
    load();
  }, [ready, load]);

  const onRemove = async (listingId) => {
    await remove(listingId);
    // UI updates automatically via snapshot, but this keeps it feeling instant
    setRows((prev) => prev.filter((x) => x.id !== listingId));
  };

  return (
    <main className="min-h-screen bg-[#05070a] text-white pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold"
            >
              ← Back
            </button>

            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Your Favourites
              </h1>
              <p className="text-xs text-white/55 mt-1">
                Saved stays you can return to anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/explore"
              className="px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
            >
              Browse stays
            </Link>
            {ready && !loading ? (
              <div className="text-xs text-white/60">{rows.length} saved</div>
            ) : null}
          </div>
        </div>

        {/* states */}
        {!ready || loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <article
                key={i}
                className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden animate-pulse shadow-[0_14px_40px_rgba(0,0,0,0.25)]"
              >
                <div className="h-40 bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-5 bg-white/10 rounded w-1/3 mt-2" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-9 bg-white/5 rounded-xl flex-1" />
                    <div className="h-9 bg-white/5 rounded-xl w-24" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-6 text-center">
            <h2 className="text-lg font-semibold mb-1">No favourites yet.</h2>
            <p className="text-gray-200 text-sm">
              Go to{" "}
              <Link to="/explore" className="text-amber-300 underline underline-offset-4">
                Explore
              </Link>{" "}
              and tap ♥ on any listing you like.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((l) => {
              const cover = getListingCover(l) || FALLBACK;
              const price = Number(l.pricePerNight || l.nightlyRate || l.price || 0);

              return (
                <article
                  key={l.id}
                  className="rounded-2xl bg-[#0f1419] border border-white/5 overflow-hidden hover:border-amber-300/40 transition shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="relative h-40 bg-black/40 overflow-hidden">
                    <img
                      src={cover}
                      alt={l.title || "Listing"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] bg-black/65 border border-white/15 text-white/85 backdrop-blur">
                      Saved
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{l.title || "Luxury stay"}</h3>
                      <p className="text-gray-300 text-xs md:text-sm truncate">
                        {l.area || "—"}, {l.city || "Nigeria"}
                      </p>
                    </div>

                    <p className="text-lg font-bold mt-1">
                      ₦{nf.format(price)}
                      <span className="text-xs text-gray-400 ml-1">/ night</span>
                    </p>

                    <div className="flex gap-2 mt-3">
                      <Link
                        to={`/listing/${l.id}`}
                        className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                      >
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() => onRemove(l.id)}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
                        title="Remove from favourites"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
