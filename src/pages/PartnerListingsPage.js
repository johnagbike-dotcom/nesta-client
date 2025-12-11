import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const nf = new Intl.NumberFormat("en-NG");
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

/**
 * Shared page for:
 *  - Partners (mode="partner" – filter by partnerId)
 *  - Hosts    (mode="host"    – filter by ownerId)
 */
export default function PartnerListingsPage({
  headingOverride,
  mode = "partner",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [qtext, setQtext] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ───────────────────── Load listings ─────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        if (!user?.uid) {
          if (mounted) setRows([]);
          return;
        }

        // host uses ownerId, partner uses partnerId
        const idField = mode === "host" ? "ownerId" : "partnerId";

        const qq = query(
          collection(db, "listings"),
          where(idField, "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(200)
        );

        const snap = await getDocs(qq);
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        if (mounted) setRows(out);
      } catch (e) {
        console.error(e);
        if (mounted) {
          setErr("Could not load your listings.");
          setRows([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid, mode]);

  // ───────────────────── Filters ─────────────────────
  const filtered = useMemo(() => {
    const kw = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      const matchKw =
        !kw ||
        (r.title || "").toLowerCase().includes(kw) ||
        (r.city || "").toLowerCase().includes(kw) ||
        (r.area || "").toLowerCase().includes(kw) ||
        (r.id || "").toLowerCase().includes(kw);

      const s = (r.status || "active").toLowerCase();
      const matchStatus = status === "all" || s === status;

      return matchKw && matchStatus;
    });
  }, [rows, qtext, status]);

  // ───────────────────── Mutations ─────────────────────
  async function setStatusFor(id, next) {
    try {
      await updateDoc(doc(db, "listings", id), { status: next });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next } : r))
      );
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    }
  }

  async function toggleFeatured(id, cur) {
    try {
      await updateDoc(doc(db, "listings", id), { featured: !cur });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, featured: !cur } : r
        )
      );
    } catch (e) {
      console.error(e);
      alert("Failed to toggle featured.");
    }
  }

  // ───────────────────── Render helpers ─────────────────────
  const title =
    headingOverride ||
    (mode === "host" ? "Your Managed Listings" : "Your Portfolio Listings");

  const subtitle =
    mode === "host"
      ? "Search, filter, and update your portfolio."
      : "Search, filter, and update your managed inventory.";

  const statusLabel = (s) => {
    const v = String(s || "active").toLowerCase();
    if (v === "inactive") return "Inactive";
    if (v === "review") return "Under review";
    return "Live";
  };

  const statusTone = (s) => {
    const v = String(s || "active").toLowerCase();
    if (v === "inactive")
      return "bg-red-500/10 border-red-400/40 text-red-200";
    if (v === "review")
      return "bg-amber-500/10 border-amber-300/50 text-amber-200";
    return "bg-emerald-500/10 border-emerald-400/50 text-emerald-200";
  };

  return (
    <main className="min-h-screen bg-[#05070A] text-white pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back */}
        <button
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-white/10"
          onClick={() => navigate(-1)}
        >
          <span className="text-lg">←</span>
          Back
        </button>

        {/* Heading */}
        <header className="mt-6 mb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="text-white/60 mt-1">{subtitle}</p>
        </header>

        {err && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        )}

        {/* Filters */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#0B0F14] px-4 py-4 md:px-6 md:py-5 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1.6fr_0.9fr_auto] items-center">
            <input
              placeholder="Search (title, city, area, id)"
              value={qtext}
              onChange={(e) => setQtext(e.target.value)}
              className="h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm outline-none focus:border-amber-400/80"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm outline-none focus:border-amber-400/80"
            >
              <option value="all">Any status</option>
              <option value="active">Live / active</option>
              <option value="review">Under review</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="h-11 px-5 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10"
              type="button"
              onClick={() => {
                setQtext("");
                setStatus("all");
              }}
            >
              Reset
            </button>
          </div>
        </section>

        {/* Listings */}
        <section className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 h-32 animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0B0F14] px-6 py-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.6)]">
              <p className="text-white/70">
                No listings match your filters.
              </p>
              <Link
                className="inline-flex mt-4 px-5 py-2.5 rounded-2xl bg-amber-400 text-black text-sm font-semibold hover:bg-amber-300"
                to="/post/new"
              >
                + Create Listing
              </Link>
            </div>
          ) : (
            filtered.map((r) => {
              const nightly = Number(r.pricePerNight || 0);
              const s = r.status || "active";
              const featured = !!r.featured;
              const cover = getListingCover(r);

              return (
                <article
                  key={r.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/4 via-[#05070A] to-black/60 px-4 py-4 md:px-5 md:py-5 shadow-[0_18px_60px_rgba(0,0,0,0.7)]"
                >
                  {/* Top row: ID + status */}
                  <div className="flex items-center gap-3 text-xs text-white/40 mb-2">
                    <span className="font-mono text-[11px] px-2 py-1 rounded-full bg-black/40 border border-white/10">
                      {r.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusTone(
                        s
                      )}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90" />
                      {statusLabel(s)}
                    </span>
                    {featured && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-300/60 bg-amber-400/10 text-[11px] text-amber-100 font-semibold">
                        ★ Featured
                      </span>
                    )}
                  </div>

                  {/* Main row */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-full md:w-40 h-28 rounded-2xl overflow-hidden bg-black/40 flex-shrink-0">
                      {cover ? (
                        <img
                          src={cover}
                          alt={r.title || "Listing"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <img
                          src={FALLBACK}
                          alt="Nesta luxury stay"
                          className="w-full h-full object-cover opacity-90"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 space-y-1">
                      <h2 className="text-lg md:text-xl font-bold truncate">
                        {r.title || "Untitled"}
                      </h2>
                      <p className="text-sm text-white/70">
                        {r.city || "—"} • {r.area || "—"}
                      </p>
                      <p className="text-sm text-white/70">
                        <span className="font-semibold text-amber-300">
                          ₦{nf.format(nightly)}
                        </span>{" "}
                        <span className="text-xs text-white/50">
                          / night
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                      <Link
                        to={`/listing/${r.id}`}
                        className="px-4 py-2 rounded-2xl border border-white/15 bg-white/5 text-xs md:text-sm font-semibold hover:bg-white/10"
                      >
                        View
                      </Link>
                      <Link
                        to={`/listing/${r.id}/edit`}
                        className="px-4 py-2 rounded-2xl bg-amber-400 text-black text-xs md:text-sm font-semibold hover:bg-amber-300"
                      >
                        Edit
                      </Link>

                      {(s || "active").toLowerCase() !== "active" && (
                        <button
                          className="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/60 text-xs md:text-sm text-emerald-100 font-semibold hover:bg-emerald-500/25"
                          onClick={() => setStatusFor(r.id, "active")}
                          type="button"
                        >
                          Activate
                        </button>
                      )}
                      {(s || "active").toLowerCase() !== "inactive" && (
                        <button
                          className="px-4 py-2 rounded-2xl bg-red-500/15 border border-red-400/60 text-xs md:text-sm text-red-100 font-semibold hover:bg-red-500/25"
                          onClick={() => setStatusFor(r.id, "inactive")}
                          type="button"
                        >
                          Deactivate
                        </button>
                      )}

                      <button
                        className="px-4 py-2 rounded-2xl border border-amber-300/50 bg-amber-400/5 text-xs md:text-sm text-amber-100 font-semibold hover:bg-amber-400/15"
                        onClick={() => toggleFeatured(r.id, featured)}
                        type="button"
                      >
                        {featured ? "Unfeature" : "Feature"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
