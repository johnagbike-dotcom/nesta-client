// src/pages/ListingDetails.js
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import "../styles/polish.css";

const nf = new Intl.NumberFormat("en-NG");

export default function ListingDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  // who to chat with
  const chatUid = useMemo(() => {
    if (!listing) return null;
    return (
      listing.ownerId ||
      listing.hostId ||
      listing.partnerUid ||
      listing.partnerId ||
      null
    );
  }, [listing]);

  // is this my own listing? (host or partner)
  const isOwner = useMemo(() => {
    if (!user || !listing) return false;
    const uid = user.uid;
    return (
      listing.ownerId === uid ||
      listing.hostId === uid ||
      listing.partnerUid === uid ||
      listing.partnerId === uid
    );
  }, [user, listing]);

  // ------ actions ------
  const goReserve = useCallback(() => {
    if (!listing) return;
    if (!user) {
      // not logged in — go login, carry intent
      nav("/login", {
        state: {
          from: `/reserve/${listing.id}`,
          intent: "reserve",
          listing: {
            id: listing.id,
            title: listing.title || "Listing",
            price: listing.pricePerNight || listing.price || 0,
            hostId:
              listing.ownerId ||
              listing.hostId ||
              listing.partnerUid ||
              null,
          },
        },
      });
      return;
    }
    nav(`/reserve/${listing.id}`, {
      state: {
        id: listing.id,
        title: listing.title || "Listing",
        price: listing.pricePerNight || listing.price || 0,
        hostId:
          listing.ownerId ||
          listing.hostId ||
          listing.partnerUid ||
          null,
      },
    });
  }, [listing, user, nav]);

  const goChat = useCallback(() => {
    if (!listing || !chatUid) return;
    if (!user) {
      nav("/login", {
        state: {
          from: "/chat",
          intent: "chat",
          partnerUid: chatUid,
          listing: {
            id: listing.id,
            title: listing.title || "Listing",
          },
        },
      });
      return;
    }
    nav("/chat", {
      state: {
        partnerUid: chatUid,
        listing: {
          id: listing.id,
          title: listing.title || "Listing",
        },
        from: "listing",
      },
    });
  }, [listing, chatUid, user, nav]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0f14] text-white pt-20 px-4">
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
      <main className="min-h-screen bg-[#0b0f14] text-white pt-20 px-4">
        <div className="max-w-4xl mx-auto rounded-2xl bg-red-500/10 border border-red-400/30 p-6">
          <h1 className="text-xl font-bold mb-2">Listing</h1>
          <p>{err || "Listing not found."}</p>
          <button
            onClick={() => nav("/explore")}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold"
          >
            ← Back to explore
          </button>
        </div>
      </main>
    );
  }

  const price = listing.pricePerNight || listing.price || 0;
  const images = Array.isArray(listing.imageUrls) ? listing.imageUrls : [];
  const hero = images[0] || listing.coverImage || listing.image || null;

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white pt-20 pb-16">
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
            <span className="text-xs text-white/40 truncate">
              ID: {listing.id}
            </span>
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
          <div className="rounded-3xl overflow-hidden border border-white/5 bg-black/20 min-h-[220px]">
            {hero ? (
              <img
                src={hero}
                alt={listing.title || "Listing"}
                className="w-full h-full object-cover max-h-[420px]"
                loading="lazy"
              />
            ) : (
              <div className="h-full min-h-[220px] grid place-items-center text-gray-500">
                No photo
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {images.slice(1, 5).map((img) => (
              <div
                key={img}
                className="rounded-2xl overflow-hidden border border-white/5 bg-black/10 h-28"
              >
                <img
                  src={img}
                  alt="Listing"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-2 rounded-2xl border border-white/5 bg-black/10 h-28 grid place-items-center text-gray-500">
                More images coming soon
              </div>
            )}
          </div>
        </div>

        {/* title + actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {listing.title || "Luxury apartment"}
            </h1>
            <p className="text-gray-300 mt-1">
              {listing.area || "—"}, {listing.city || "Nigeria"}
            </p>
            {listing.featured ? (
              <span className="inline-flex px-2 py-1 mt-2 rounded-full bg-amber-400/10 border border-amber-200/40 text-amber-100 text-xs">
                Featured
              </span>
            ) : null}
          </div>

          {/* secondary actions (guest only) */}
          {!isOwner && (
            <div className="flex gap-2">
              <button
                onClick={goReserve}
                className="px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
              >
                Reserve / Book
              </button>
              {chatUid ? (
                <button
                  onClick={goChat}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-sm"
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
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <h2 className="text-lg font-semibold mb-2">About this stay</h2>
              <p className="text-gray-200 leading-relaxed">
                {listing.description ||
                  "Beautifully curated luxury stay. Host has verified KYC on Nesta. You can reserve instantly or chat to confirm details, airport pick-up, and extended stays."}
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <h2 className="text-lg font-semibold mb-2">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {(listing.amenities || [
                  "WiFi",
                  "Air conditioning",
                  "24/7 Power",
                ]).map((a, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1.5 rounded-full bg-black/25 border border-white/10 text-gray-100"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <h2 className="text-lg font-semibold mb-2">House notes</h2>
              <p className="text-gray-200 text-sm leading-relaxed">
                Respect the property, neighbours, and building rules. Exact
                check-in details are shared securely after confirmation.
              </p>
            </div>
          </div>

          {/* right: pricing / host block */}
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#0f1419] border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-300">From</div>
                <div className="text-xs text-gray-400">per night</div>
              </div>
              <div className="text-3xl font-extrabold text-amber-300">
                ₦{nf.format(price)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Secured on Nesta • payment via checkout
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {isOwner ? (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                    Booking buttons are hidden because you’re signed in as a{" "}
                    <span className="font-semibold">
                      Host / Partner
                    </span>
                    . Guests will see reserve and chat actions here.
                  </div>
                ) : (
                  <>
                    <button
                      onClick={goReserve}
                      className="w-full py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
                    >
                      Reserve now
                    </button>
                    {chatUid ? (
                      <button
                        onClick={goChat}
                        className="w-full py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                      >
                        Chat with host
                      </button>
                    ) : (
                      <p className="text-xs text-gray-500 text-center">
                        Host chat not available for this listing.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <h2 className="text-sm font-semibold mb-2">
                Hosted / managed by
              </h2>
              <p className="text-gray-200 text-sm">
                {listing.hostDisplayName ||
                  listing.ownerName ||
                  "Verified Nesta host / partner"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {chatUid
                  ? "Guests can message them safely via Nesta. No personal numbers are shared until everyone is comfortable."
                  : "Contact temporarily unavailable."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
