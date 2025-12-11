import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const FALLBACK =
  "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=60";

function getListingCover(listing) {
  if (!listing) return null;

  // Preferred Firestore field
  if (Array.isArray(listing.images) && listing.images[0]) return listing.images[0];

  // Legacy / alternative arrays
  if (Array.isArray(listing.imageUrls) && listing.imageUrls[0]) return listing.imageUrls[0];
  if (Array.isArray(listing.media) && listing.media[0]?.url) return listing.media[0].url;

  // Single URL fields
  if (listing.imageUrl) return listing.imageUrl;
  if (listing.coverImage) return listing.coverImage;
  if (listing.heroImage) return listing.heroImage;
  if (listing.photo) return listing.photo;

  return null;
}

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qtext, setQtext] = useState("");
  const [city, setCity] = useState("all");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  // fetch listings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // active listings only
        const qq = query(
          collection(db, "listings"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          limit(120)
        );
        const snap = await getDocs(qq);
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        if (mounted) setRows(out);
      } catch (e) {
        console.error(e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // build filtered list
  const filtered = useMemo(() => {
    const kw = qtext.trim().toLowerCase();
    const low = min ? Number(min) : null;
    const high = max ? Number(max) : null;
    return rows.filter((r) => {
      const price = Number(r.pricePerNight || 0);
      const matchCity =
        city === "all" || (r.city || "").toLowerCase() === city.toLowerCase();
      const matchKw =
        !kw ||
        (r.title || "").toLowerCase().includes(kw) ||
        (r.area || "").toLowerCase().includes(kw) ||
        (r.city || "").toLowerCase().includes(kw);
      const passMin = low == null || price >= low;
      const passMax = high == null || price <= high;
      return matchCity && matchKw && passMin && passMax;
    });
  }, [rows, qtext, city, min, max]);

  // unique cities for filter
  const cities = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => (r.city ? set.add(r.city) : null));
    return Array.from(set).sort();
  }, [rows]);

  // open chat from explore
  const handleChatHost = (listing) => {
    if (!listing) return;

    // prefer partner → host → owner
    const counterUid =
      listing.partnerUid ||
      listing.hostUid ||
      listing.ownerId ||
      listing.ownerID ||
      null;

    if (!counterUid) {
      alert("This listing has no host/partner attached yet.");
      return;
    }

    const listingPayload = {
      id: listing.id,
      title: listing.title || "Listing",
    };

    // if not logged in → go login first
    if (!user) {
      navigate("/login", {
        state: {
          from: "/explore",
          chatFor: {
            partnerUid: counterUid,
            listing: listingPayload,
          },
        },
      });
      return;
    }

    // logged in → open chat with proper state
    navigate("/chat", {
      state: {
        partnerUid: counterUid,
        listing: listingPayload,
        from: "explore",
      },
    });
  };

  const isListingMine = (listing, uid) => {
    if (!uid || !listing) return false;
    return (
      listing.ownerId === uid ||
      listing.ownerID === uid ||
      listing.hostUid === uid ||
      listing.hostId === uid ||
      listing.partnerUid === uid ||
      listing.partnerId === uid
    );
  };

  return (
    <main className="container" style={{ paddingBottom: 28 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0" }}>
        Explore Stays
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Curated luxury apartments and suites — refined for comfort.
      </p>

      {/* Filters */}
      <div className="form-card" style={{ marginTop: 12 }}>
        <div
          className="filter-grid"
          style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr auto" }}
        >
          <input
            placeholder="Search (title, city, area)"
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
          />
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="all">Any city</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min ₦/night"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            min={0}
          />
          <input
            type="number"
            placeholder="Max ₦/night"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            min={0}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setQtext("");
              setCity("all");
              setMin("");
              setMax("");
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{ padding: 18, marginTop: 16, textAlign: "center" }}
        >
          <p className="muted">No listings match your filters.</p>
        </div>
      ) : (
        <div
          className="results-grid"
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((l) => {
            const hasChatTarget =
              l.partnerUid || l.hostUid || l.ownerId || l.ownerID;
            const mine = isListingMine(l, user?.uid);
            const cover = getListingCover(l);

            return (
              <article key={l.id} className="listing-card">
                <div
                  style={{
                    borderRadius: 12,
                    height: 140,
                    background: "rgba(255,255,255,0.06)",
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt={l.title || "Listing"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <img
                      src={FALLBACK}
                      alt="Nesta luxury stay"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                  )}
                </div>
                <h3
                  style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {l.title || "Untitled"}
                  {l.featured ? (
                    <span
                      className="muted"
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,.18)",
                      }}
                    >
                      Featured
                    </span>
                  ) : null}
                </h3>
                <div className="muted" style={{ marginBottom: 10 }}>
                  ₦{Number(l.pricePerNight || 0).toLocaleString()}/night •{" "}
                  {l.area || "—"}
                  <br />
                  {l.city || "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {mine ? (
                    <>
                      <Link className="btn view-btn" to={`/listing/${l.id}`}>
                        View
                      </Link>
                      <Link
                        className="btn primary"
                        to={`/listing/${l.id}/edit`}
                      >
                        Edit
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link className="btn view-btn" to={`/listing/${l.id}`}>
                        View
                      </Link>
                      <button
                        className="btn ghost"
                        onClick={() => navigate(`/reserve/${l.id}`)}
                      >
                        Reserve
                      </button>
                      {hasChatTarget ? (
                        <button
                          className="btn ghost"
                          onClick={() => handleChatHost(l)}
                        >
                          Chat host
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
