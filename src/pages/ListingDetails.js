// src/pages/ListingDetails.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";
import ListingMap from "../components/ListingMap";

// ✅ shared featured logic
import { isFeaturedActive } from "../utils/featured";

// ✅ favourites
import FavButton from "../components/FavButton";

// ✅ reviews
import ReviewsPanel from "../components/ReviewsPanel";
import StarRating from "../components/StarRating";

const nf = new Intl.NumberFormat("en-NG");

export default function ListingDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // lightbox
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Share UX
  const [shareMsg, setShareMsg] = useState("");

  /* ───────────────── load listing ───────────────── */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const snap = await getDoc(doc(db, "listings", id));
        if (!alive) return;

        if (!snap.exists()) {
          setErr("Listing not found.");
          setListing(null);
        } else {
          setListing({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("[ListingDetails] load failed:", e);
        if (alive) {
          setErr("Couldn’t load this listing.");
          setListing(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  /* ───────────────── photos array ───────────────── */
  const images = useMemo(() => {
    if (!listing) return [];
    if (Array.isArray(listing.images) && listing.images.length) return listing.images;
    if (Array.isArray(listing.imageUrls) && listing.imageUrls.length) return listing.imageUrls;
    if (Array.isArray(listing.photos) && listing.photos.length) return listing.photos;
    return [];
  }, [listing]);

  /* ───────────────── lightbox keyboard nav ───────────────── */
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handler = (e) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
        return;
      }
      if (!images.length) return;

      if (e.key === "ArrowRight") setLightboxIndex((prev) => (prev + 1) % images.length);
      if (e.key === "ArrowLeft") setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, images]);

  /* ───────────────── ownership helpers ───────────────── */
  const isOwner = useMemo(() => {
    if (!user || !listing) return false;
    const uid = user.uid;
    return (
      listing.ownerId === uid ||
      listing.ownerID === uid ||
      listing.hostId === uid ||
      listing.hostUid === uid ||
      listing.partnerUid === uid ||
      listing.partnerId === uid
    );
  }, [user, listing]);

  /* ───────────────── featured badge ───────────────── */
  const nowMs = Date.now();
  const featuredActive = useMemo(() => isFeaturedActive(listing, nowMs), [listing, nowMs]);

  /* ───────────────── rating display ───────────────── */
  const ratingAvg = Number(listing?.ratingAvg || 0);
  const ratingCount = Number(listing?.ratingCount || 0);

  /* ───────────────── share helpers ───────────────── */
  const listingUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    return `${origin}/listing/${id}`;
  }, [id]);

  const clearShareMsgSoon = useCallback(() => {
    window.clearTimeout(clearShareMsgSoon._t);
    clearShareMsgSoon._t = window.setTimeout(() => setShareMsg(""), 2200);
  }, []);
  // eslint-disable-next-line
  clearShareMsgSoon._t = clearShareMsgSoon._t || null;

  const onShare = useCallback(async () => {
    try {
      setShareMsg("");

      const title = listing?.title ? `Nesta • ${listing.title}` : "Nesta listing";
      const text = listing?.city ? `Check this stay on Nesta (${listing.city}).` : "Check this stay on Nesta.";

      if (navigator.share) {
        await navigator.share({ title, text, url: listingUrl });
        setShareMsg("Shared ✅");
        clearShareMsgSoon();
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(listingUrl);
        setShareMsg("Link copied ✅");
        clearShareMsgSoon();
        return;
      }

      const ta = document.createElement("textarea");
      ta.value = listingUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);

      setShareMsg("Link copied ✅");
      clearShareMsgSoon();
    } catch (e) {
      console.warn("[ListingDetails] share failed:", e);
      setShareMsg("Couldn’t share. Try copying the URL from the address bar.");
      clearShareMsgSoon();
    }
  }, [listing, listingUrl, clearShareMsgSoon]);

  /* ───────────────── actions ───────────────── */
  const goReserve = useCallback(() => {
    if (!listing) return;

    const baseState = {
      id: listing.id,
      title: listing.title || "Listing",
      price: listing.pricePerNight || listing.price || 0,
      hostId:
        listing.partnerUid ||
        listing.partnerId ||
        listing.hostId ||
        listing.hostUid ||
        listing.ownerId ||
        null,
    };

    if (!user) {
      nav("/login", {
        state: {
          from: `/reserve/${listing.id}`,
          intent: "reserve",
          listing: baseState,
        },
      });
      return;
    }

    nav(`/reserve/${listing.id}`, { state: baseState });
  }, [listing, user, nav]);

  const requireLoginForSocial = useCallback(() => {
    nav("/login", { state: { from: `/listing/${id}` } });
  }, [nav, id]);

  /* ───────────────── FIX: stable aggregate updater (stops loop) ───────────────── */
  const lastAggRef = useRef({ ratingAvg: null, ratingCount: null });

  const onAggregateUpdate = useCallback((agg) => {
    const nextAvg = Number(Number(agg?.ratingAvg || 0).toFixed(3));
    const nextCount = Number(agg?.ratingCount || 0);

    const prev = lastAggRef.current;
    if (prev.ratingAvg === nextAvg && prev.ratingCount === nextCount) return;

    lastAggRef.current = { ratingAvg: nextAvg, ratingCount: nextCount };

    setListing((prevListing) => {
      if (!prevListing) return prevListing;
      if (
        Number(Number(prevListing.ratingAvg || 0).toFixed(3)) === nextAvg &&
        Number(prevListing.ratingCount || 0) === nextCount
      ) {
        return prevListing;
      }
      return { ...prevListing, ratingAvg: nextAvg, ratingCount: nextCount };
    });
  }, []);

  /* ───────────────── loading / error ───────────────── */
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="h-52 rounded-3xl bg-white/5 animate-pulse" />
          <div className="h-8 w-64 rounded-full bg-white/5 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </main>
    );
  }

  if (err || !listing) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 px-4">
        <div className="max-w-4xl mx-auto rounded-2xl bg-red-500/10 border border-red-400/30 p-6">
          <h1
            className="text-xl font-bold mb-2"
            style={{
              fontFamily:
                'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
            }}
          >
            Listing
          </h1>
          <p>{err || "Listing not found."}</p>
          <button
            onClick={() => nav("/explore")}
            className="mt-4 px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-sm"
          >
            ← Back to explore
          </button>
        </div>
      </main>
    );
  }

  /* ───────────────── main content ───────────────── */
  const price = listing.pricePerNight || listing.price || 0;
  const hero = images[0] || listing.coverImage || listing.image || null;

  // ✅ reserve availability (guest only)
  const canBook = !isOwner;

  return (
    <>
      {/* small page-local style to prevent sticky bar covering content */}
      <style>{`
        .nesta-sticky-safe {
          padding-bottom: ${canBook ? "92px" : "0px"};
        }
      `}</style>

      <main className={`min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 pb-16 nesta-sticky-safe`}>
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          {/* back + actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => nav(-1)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
              >
                ← Back
              </button>

              {isOwner ? (
                <span className="hidden sm:inline text-xs text-white/40 truncate">
                  ID: {listing.id}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <FavButton listingId={listing.id} compact onRequireLogin={requireLoginForSocial} />

              <button
                onClick={onShare}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
                title="Share this listing"
              >
                Share
              </button>

              {isOwner && (
                <button
                  onClick={() => nav(`/listing/${listing.id}/edit`)}
                  className="px-5 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-sm"
                >
                  Edit listing
                </button>
              )}
            </div>
          </div>

          {shareMsg ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/80">
              {shareMsg}
            </div>
          ) : null}

          {/* hero / gallery */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/30 min-h-[220px] shadow-[0_24px_70px_rgba(0,0,0,.75)]">
              {hero ? (
                <button
                  type="button"
                  onClick={() => images.length && setLightboxIndex(0)}
                  className="block w-full h-full"
                >
                  <img
                    src={hero}
                    alt={listing.title || "Listing"}
                    className="w-full h-full object-cover max-h-[430px] cursor-zoom-in"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="h-full min-h-[220px] grid place-items-center text-gray-500">
                  No photo
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {images.slice(1, 5).map((img, idx) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setLightboxIndex(idx + 1)}
                  className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 h-28"
                >
                  <img
                    src={img}
                    alt="Listing"
                    className="w-full h-full object-cover cursor-zoom-in"
                    loading="lazy"
                  />
                </button>
              ))}
              {images.length === 0 && (
                <div className="col-span-2 rounded-2xl border border-white/10 bg-black/10 h-28 grid place-items-center text-gray-500">
                  More images coming soon
                </div>
              )}
            </div>
          </div>

          {/* title + summary (✅ removed duplicate Reserve button here) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1
                className="text-3xl md:text-[32px] font-extrabold tracking-tight"
                style={{
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                {listing.title || "Luxury apartment"}
              </h1>

              <p className="text-gray-300 mt-1 text-sm md:text-base">
                {listing.area || "—"}, {listing.city || "Nigeria"}
              </p>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {ratingCount > 0 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <StarRating value={ratingAvg} readOnly size={14} showValue />
                    <span className="text-xs text-white/55">
                      {ratingCount} review{ratingCount === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-white/55">No reviews yet</span>
                )}

                {featuredActive ? (
                  <span className="inline-flex px-2 py-1 rounded-full bg-amber-400/10 border border-amber-200/40 text-amber-100 text-xs">
                    Featured
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* core info */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.1fr,0.9fr]">
            {/* left */}
            <div className="space-y-5">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  About this stay
                </h2>
                <p className="text-gray-200 leading-relaxed text-sm md:text-[15px]">
                  {listing.description ||
                    "Beautifully curated luxury stay. Reserve securely on Nesta for a seamless, protected experience."}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  Amenities
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(listing.amenities || ["WiFi", "Air conditioning", "24/7 power", "Smart TV"]).map((a, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-3 py-1.5 rounded-full bg-black/25 border border-white/10 text-gray-100"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <ReviewsPanel
                listingId={listing.id}
                user={user}
                onRequireLogin={requireLoginForSocial}
                onAggregateUpdate={onAggregateUpdate}
              />

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-3">
                <h2
                  className="text-lg font-semibold"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  Location
                </h2>
                <div className="text-sm text-white/70 mb-2">
                  {listing.address && <div>{listing.address}</div>}
                  <div>
                    {listing.area || "—"}, {listing.city || "Nigeria"}
                  </div>
                </div>
                <ListingMap
                  lat={typeof listing.lat === "number" ? listing.lat : null}
                  lng={typeof listing.lng === "number" ? listing.lng : null}
                />
                <p className="text-[11px] text-white/50 mt-1">
                  Exact details are shared securely with confirmed guests only.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  House notes
                </h2>
                <p className="text-gray-200 text-sm leading-relaxed">
                  Respect the property, neighbours, and building rules. Exact check-in details are shared securely after confirmation.
                </p>
              </div>
            </div>

            {/* right */}
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#05090f] border border-white/10 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,.75)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-300 uppercase tracking-[0.14em]">From</div>
                  <div className="text-xs text-gray-400">Per night</div>
                </div>

                <div
                  className="text-3xl md:text-[32px] font-extrabold text-amber-300"
                  style={{
                    fontFamily:
                      'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  ₦{nf.format(price)}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  {ratingCount > 0 ? (
                    <div className="text-xs text-white/70 flex items-center gap-2">
                      <StarRating value={ratingAvg} readOnly size={14} />
                      <span>
                        {ratingAvg.toFixed(1)} ({ratingCount})
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/50">No reviews yet</div>
                  )}
                  <div className="text-xs text-gray-500">Secured on Nesta</div>
                </div>

                <p className="text-xs text-gray-500 mt-2">Payment via seamless checkout (Paystack)</p>

                <div className="mt-4 flex flex-col gap-2">
                  {isOwner ? (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                      Booking actions are hidden because you’re signed in as a{" "}
                      <span className="font-semibold">Host / Partner</span>.
                    </div>
                  ) : (
                    <button
                      onClick={goReserve}
                      className="w-full py-2.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500 text-sm"
                    >
                      Reserve / Book
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2 className="text-sm font-semibold mb-2 uppercase tracking-[0.16em] text-white/70">
                  Hosted / managed by
                </h2>
                <p className="text-gray-200 text-sm">
                  {listing.hostDisplayName || listing.ownerName || "Verified Nesta host / partner"}
                </p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Messaging is available after a booking is confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ✅ Mobile sticky CTA (only for guests) */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-[90] md:hidden border-t border-white/10 bg-[#070a12]/92 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[11px] text-white/60">From</div>
              <div className="text-lg font-extrabold text-amber-300">
                ₦{nf.format(price)} <span className="text-[12px] text-white/60 font-semibold">/ night</span>
              </div>
            </div>
            <button
              onClick={goReserve}
              className="px-5 py-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500 shadow-[0_10px_30px_rgba(0,0,0,.55)] text-sm"
            >
              Reserve / Book
            </button>
          </div>
        </div>
      )}

      {/* lightbox overlay */}
      {lightboxIndex !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl"
              aria-label="Close gallery"
            >
              ×
            </button>

            <div className="aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/15">
              <img
                src={images[lightboxIndex]}
                alt={listing.title || "Listing photo"}
                className="w-full h-full object-contain"
              />
            </div>

            {images.length > 1 && (
              <div className="flex items-center justify-between mt-3 text-sm text-white/70">
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + images.length) % images.length)}
                  className="px-3 py-1 rounded-full bg-white/10 border border-white/20 hover:bg-white/20"
                >
                  ← Previous
                </button>
                <div>
                  {lightboxIndex + 1} / {images.length}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % images.length)}
                  className="px-3 py-1 rounded-full bg-white/10 border border-white/20 hover:bg-white/20"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
