// src/pages/ListingDetails.js
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";
import ListingMap from "../components/ListingMap";

// ✅ shared featured logic
import { isFeaturedActive } from "../utils/featured";

const nf = new Intl.NumberFormat("en-NG");

export default function ListingDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // lightbox: index of the image being shown, or null when closed
  const [lightboxIndex, setLightboxIndex] = useState(null);

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

  /* ───────────────── chat + ownership helpers ───────────────── */

  const chatUid = useMemo(() => {
    if (!listing) return null;
    return (
      listing.partnerUid ||
      listing.partnerId ||
      listing.hostId ||
      listing.hostUid ||
      listing.ownerId ||
      listing.ownerID ||
      null
    );
  }, [listing]);

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

  /* ───────────────── featured badge (luxury rule) ───────────────── */

  const nowMs = Date.now();

  const featuredActive = useMemo(() => {
    return isFeaturedActive(listing, nowMs);
  }, [listing, nowMs]);

  /* ───────────────── actions ───────────────── */

  const goReserve = useCallback(() => {
    if (!listing) return;

    const baseState = {
      id: listing.id,
      title: listing.title || "Listing",
      price: listing.pricePerNight || listing.price || 0,
      hostId: listing.partnerUid || listing.hostId || listing.hostUid || listing.ownerId || null,
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

  const goChat = useCallback(() => {
    if (!listing || !chatUid) return;

    const listingMeta = { id: listing.id, title: listing.title || "Listing" };

    if (!user) {
      nav("/login", {
        state: {
          from: "/chat",
          intent: "chat",
          partnerUid: chatUid,
          listing: listingMeta,
        },
      });
      return;
    }

    nav("/chat", { state: { partnerUid: chatUid, listing: listingMeta, from: "listing" } });
  }, [listing, chatUid, user, nav]);

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
              fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
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

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          {/* back + id + (host edit) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => nav(-1)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
              >
                ← Back
              </button>
              <span className="hidden sm:inline text-xs text-white/40 truncate">ID: {listing.id}</span>
            </div>

            {isOwner && (
              <button
                onClick={() => nav(`/listing/${listing.id}/edit`)}
                className="px-5 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-sm"
              >
                Edit listing
              </button>
            )}
          </div>

          {/* hero / gallery */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/30 min-h-[220px] shadow-[0_24px_70px_rgba(0,0,0,.75)]">
              {hero ? (
                <button type="button" onClick={() => images.length && setLightboxIndex(0)} className="block w-full h-full">
                  <img
                    src={hero}
                    alt={listing.title || "Listing"}
                    className="w-full h-full object-cover max-h-[430px] cursor-zoom-in"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="h-full min-h-[220px] grid place-items-center text-gray-500">No photo</div>
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
                  <img src={img} alt="Listing" className="w-full h-full object-cover cursor-zoom-in" loading="lazy" />
                </button>
              ))}
              {images.length === 0 && (
                <div className="col-span-2 rounded-2xl border border-white/10 bg-black/10 h-28 grid place-items-center text-gray-500">
                  More images coming soon
                </div>
              )}
            </div>
          </div>

          {/* title + actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1
                className="text-3xl md:text-[32px] font-extrabold tracking-tight"
                style={{
                  fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                {listing.title || "Luxury apartment"}
              </h1>
              <p className="text-gray-300 mt-1 text-sm md:text-base">
                {listing.area || "—"}, {listing.city || "Nigeria"}
              </p>

              {/* ✅ Featured badge ONLY if active + not expired */}
              {featuredActive ? (
                <span className="inline-flex px-2 py-1 mt-2 rounded-full bg-amber-400/10 border border-amber-200/40 text-amber-100 text-xs">
                  Featured
                </span>
              ) : null}
            </div>

            {!isOwner && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={goReserve}
                  className="px-5 py-2 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500 transition shadow-[0_12px_40px_rgba(0,0,0,.65)] text-sm"
                >
                  Reserve / Book
                </button>
                {chatUid ? (
                  <button
                    onClick={goChat}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
                  >
                    Chat with host
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* core info */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.1fr,0.9fr]">
            {/* left: details */}
            <div className="space-y-5">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  About this stay
                </h2>
                <p className="text-gray-200 leading-relaxed text-sm md:text-[15px]">
                  {listing.description ||
                    "Beautifully curated luxury stay. Host has verified KYC on Nesta. You can reserve instantly or chat to confirm details, airport pick-up, and extended stays."}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  Amenities
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(listing.amenities || ["WiFi", "Air conditioning", "24/7 power", "Smart TV"]).map((a, idx) => (
                    <span key={idx} className="text-xs px-3 py-1.5 rounded-full bg-black/25 border border-white/10 text-gray-100">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Location card with map */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-3">
                <h2
                  className="text-lg font-semibold"
                  style={{
                    fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
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
                <ListingMap lat={typeof listing.lat === "number" ? listing.lat : null} lng={typeof listing.lng === "number" ? listing.lng : null} />
                <p className="text-[11px] text-white/50 mt-1">Exact details are shared securely with confirmed guests only.</p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  House notes
                </h2>
                <p className="text-gray-200 text-sm leading-relaxed">
                  Respect the property, neighbours, and building rules. Exact check-in details are shared securely after confirmation. Smoking, events, and extra guests may require approval from the host.
                </p>
              </div>
            </div>

            {/* right: pricing / host block */}
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#05090f] border border-white/10 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,.75)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-300 uppercase tracking-[0.14em]">From</div>
                  <div className="text-xs text-gray-400">Per night</div>
                </div>
                <div
                  className="text-3xl md:text-[32px] font-extrabold text-amber-300"
                  style={{
                    fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                  }}
                >
                  ₦{nf.format(price)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Secured on Nesta • payment via seamless checkout</p>

                <div className="mt-4 flex flex-col gap-2">
                  {isOwner ? (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                      Booking buttons are hidden because you’re signed in as a <span className="font-semibold">Host / Partner</span>. Guests will see reserve and chat actions here.
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={goReserve}
                        className="w-full py-2.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500 text-sm"
                      >
                        Reserve now
                      </button>
                      {chatUid ? (
                        <button
                          onClick={goChat}
                          className="w-full py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                        >
                          Chat with host
                        </button>
                      ) : (
                        <p className="text-xs text-gray-500 text-center">Host chat not available for this listing.</p>
                      )}
                    </>
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
                  {chatUid
                    ? "Guests can message them safely via Nesta. No personal contact details are shared until everyone is comfortable."
                    : "Contact temporarily unavailable for this listing."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ───────────────── lightbox overlay ───────────────── */}
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
