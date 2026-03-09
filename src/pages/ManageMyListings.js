// src/pages/ManageMyListings.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/* ─────────────────────────── helpers ─────────────────────────── */
const nf = new Intl.NumberFormat("en-NG");
const ngn = (n) => `₦${nf.format(Math.round(Number(n || 0)))}`;

function statusTone(s) {
  const v = String(s || "active").toLowerCase();
  if (v === "active") return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  if (v === "inactive") return "text-white/50 border-white/10 bg-white/5";
  if (v === "review") return "text-amber-300 border-amber-400/30 bg-amber-400/10";
  return "text-white/50 border-white/10 bg-white/5";
}

function statusLabel(s) {
  const v = String(s || "active").toLowerCase();
  if (v === "active") return "Active";
  if (v === "inactive") return "Inactive";
  if (v === "review") return "Under review";
  return v;
}

function pickPhoto(l) {
  const candidates = [
    l?.primaryImageUrl,
    Array.isArray(l?.images) && l.images[0],
    Array.isArray(l?.photos) && l.photos[0],
    Array.isArray(l?.imageUrls) && l.imageUrls[0],
  ];
  return candidates.find((c) => typeof c === "string" && c.trim().length > 5) || null;
}

/* ─────────────────────────── component ─────────────────────────── */
export default function ManageMyListings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const rawRole = String(profile?.role || "").toLowerCase();
  const isPartner = rawRole.includes("partner");
  const isHost = rawRole.includes("host");

  /* ── load listings ─────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    async function runQuery(qref) {
      const snap = await getDocs(qref);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    async function loadMyListings() {
      if (!user?.uid) {
        if (alive) { setRows([]); setLoading(false); setErr(""); }
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const colRef = collection(db, "listings");
        let list = [];

        // Primary query
        const primaryQ = isPartner
          ? query(colRef, where("partnerUid", "==", user.uid), orderBy("createdAt", "desc"))
          : query(colRef, where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));

        list = await runQuery(primaryQ);

        // Fallbacks only if empty
        if (list.length === 0) {
          const fallbacks = isPartner
            ? [
                query(colRef, where("partnerId", "==", user.uid), orderBy("createdAt", "desc")),
                query(colRef, where("managers", "array-contains", user.uid), orderBy("createdAt", "desc")),
              ]
            : [
                query(colRef, where("ownerUid", "==", user.uid), orderBy("createdAt", "desc")),
                query(colRef, where("hostUid", "==", user.uid), orderBy("createdAt", "desc")),
                query(colRef, where("hostId", "==", user.uid), orderBy("createdAt", "desc")),
              ];

          for (const fb of fallbacks) {
            if (list.length > 0) break;
            try { list = await runQuery(fb); } catch { /* ignore */ }
          }
        }

        // De-dupe by id
        const map = new Map();
        list.forEach((x) => map.set(x.id, x));

        if (alive) {
          setRows(Array.from(map.values()));
          setLoading(false);
        }
      } catch (e) {
        console.error("Load listings error:", e);
        if (!alive) return;

        const msg = String(e?.message || "");
        setErr(
          msg.includes("FAILED_PRECONDITION")
            ? "Firestore index missing. Create a composite index on (ownerId + createdAt) and (partnerUid + createdAt) in Firestore, then refresh."
            : "Could not load your listings. Please try again."
        );
        setRows([]);
        setLoading(false);
      }
    }

    loadMyListings();
    return () => { alive = false; };
  }, [user?.uid, isPartner]);

  /* ── filters ───────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchText =
        !kw ||
        (r.title || "").toLowerCase().includes(kw) ||
        (r.city || "").toLowerCase().includes(kw) ||
        (r.area || "").toLowerCase().includes(kw) ||
        (r.id || "").toLowerCase().includes(kw);

      const s = String(r.status || "active").toLowerCase();
      const matchStatus = statusFilter === "all" || s === statusFilter;

      return matchText && matchStatus;
    });
  }, [rows, q, statusFilter]);

  /* ── heading — fixed: isHost shows "Your Listings", isPartner shows "Your Portfolio" */
  const heading = isPartner ? "Your Portfolio" : "Your Listings";
  const subheading = isPartner
    ? "Manage properties listed on behalf of owners."
    : "Search, filter, and update your managed inventory.";

  /* ── render ────────────────────────────────────────────────────── */
  return (
    // ✅ pt-20 keeps back button clear of fixed header
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 px-4 text-white">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/12 text-sm text-white/70 hover:text-white transition-all"
        >
          ← Back
        </button>

        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300">
              {heading}
            </h1>
            <p className="text-white/55 text-sm">{subheading}</p>
          </div>

          {/* ✅ Create button always visible, not just in empty state */}
          <Link
            to="/post/new"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20"
          >
            + New listing
          </Link>
        </div>

        {/* Error */}
        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, city, area or ID…"
            className="rounded-2xl bg-black/30 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder-white/30 outline-none focus:border-amber-400/60 transition-colors"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-amber-400/60 transition-colors"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="review">Under review</option>
          </select>
          <button
            type="button"
            onClick={() => { setQ(""); setStatusFilter("all"); }}
            className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm hover:bg-white/10 transition-all"
          >
            Reset
          </button>
        </div>

        {/* Count */}
        {!loading && rows.length > 0 && (
          <div className="text-[12px] text-white/40">
            Showing{" "}
            <span className="text-white/70 font-semibold">{filtered.length}</span>
            {" "}of{" "}
            <span className="text-white/70 font-semibold">{rows.length}</span>{" "}
            listing{rows.length !== 1 ? "s" : ""}
            {q || statusFilter !== "all" ? " (filtered)" : ""}
          </div>
        )}

        {/* Listing grid */}
        {loading ? (
          <div className="rounded-3xl border border-white/8 bg-[#0c0f16] p-8 text-center text-white/40 text-sm">
            Loading your listings…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/8 bg-[#0c0f16] p-10 text-center space-y-3">
            <p className="text-white/60">
              {rows.length === 0
                ? "You haven't created any listings yet."
                : "No listings match your current filters."}
            </p>
            {rows.length === 0 && (
              <Link
                to="/post/new"
                className="inline-block px-6 py-2.5 rounded-2xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-all"
              >
                + Create your first listing
              </Link>
            )}
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => { setQ(""); setStatusFilter("all"); }}
                className="inline-block px-5 py-2 rounded-2xl border border-white/10 bg-white/5 text-sm hover:bg-white/10 transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => {
              const photo = pickPhoto(l);
              const price = l.pricePerNight || l.nightlyRate;
              const photoCount = (
                Array.isArray(l.images) ? l.images :
                Array.isArray(l.photos) ? l.photos :
                Array.isArray(l.imageUrls) ? l.imageUrls : []
              ).filter(Boolean).length;

              return (
                <li
                  key={l.id}
                  className="rounded-3xl border border-white/8 bg-[#0c0f16] overflow-hidden flex flex-col hover:border-white/15 transition-colors"
                >
                  {/* ✅ Real photo, not blank box */}
                  <div className="relative h-40 bg-white/5 overflow-hidden flex-shrink-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt={l.title || "Listing"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/20 text-sm">No photo</span>
                      </div>
                    )}

                    {/* Status badge overlaid on image */}
                    <span
                      className={[
                        "absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border font-semibold backdrop-blur-sm",
                        statusTone(l.status),
                      ].join(" ")}
                    >
                      {statusLabel(l.status)}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-4 flex flex-col flex-1 space-y-2">
                    <h3 className="font-semibold text-base truncate text-white">
                      {l.title || "Untitled"}
                    </h3>

                    <div className="text-[13px] text-white/55 truncate">
                      {[l.city, l.area].filter(Boolean).join(" · ") || "—"}
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-3 text-[12px] text-white/40 flex-wrap">
                      {typeof price === "number" && price > 0 && (
                        <span className="text-amber-300/80 font-semibold">
                          {ngn(price)}/night
                        </span>
                      )}
                      {l.bedrooms != null && (
                        <span>{l.bedrooms} bed{l.bedrooms !== 1 ? "s" : ""}</span>
                      )}
                      {l.maxGuests != null && (
                        <span>{l.maxGuests} guest{l.maxGuests !== 1 ? "s" : ""}</span>
                      )}
                      {photoCount > 0 && (
                        <span>{photoCount} photo{photoCount !== 1 ? "s" : ""}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1 mt-auto">
                      <Link
                        to={`/listing/${l.id}`}
                        className="py-2 rounded-2xl bg-white/8 border border-white/10 text-center text-sm hover:bg-white/12 transition-all"
                      >
                        View
                      </Link>
                      <Link
                        to={`/listing/${l.id}/edit`}
                        className="py-2 rounded-2xl bg-amber-400 text-black font-semibold text-center text-sm hover:bg-amber-300 transition-all"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      </div>
    </main>
  );
}