// src/pages/ManageMyListings.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function ManageMyListings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  // detect whether this account is a partner or host
  const rawRole = (profile?.role || "").toLowerCase();
  const isPartner = rawRole.includes("partner");
  const isHost = rawRole.includes("host");

  useEffect(() => {
    let alive = true;

    async function runQuery(colRef, qref) {
      const snap = await getDocs(qref);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    async function loadMyListings() {
      if (!user?.uid) {
        if (alive) {
          setRows([]);
          setLoading(false);
          setErr("");
        }
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const colRef = collection(db, "listings");
        let list = [];

        // --------------------------
        // PRIMARY QUERY (your original)
        // --------------------------
        const primaryRef = isPartner
          ? query(colRef, where("partnerUid", "==", user.uid), orderBy("createdAt", "desc"))
          : query(colRef, where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));

        list = await runQuery(colRef, primaryRef);

        // --------------------------
        // FALLBACKS (only if empty)
        // --------------------------
        if (list.length === 0) {
          if (isPartner) {
            // fallback 1: partnerId
            try {
              const q2 = query(colRef, where("partnerId", "==", user.uid), orderBy("createdAt", "desc"));
              list = await runQuery(colRef, q2);
            } catch (e) {
              // ignore and continue
            }

            // fallback 2: managers array
            if (list.length === 0) {
              try {
                const q3 = query(colRef, where("managers", "array-contains", user.uid), orderBy("createdAt", "desc"));
                list = await runQuery(colRef, q3);
              } catch (e) {
                // ignore and continue
              }
            }
          } else {
            // host fallbacks
            try {
              const q2 = query(colRef, where("ownerUid", "==", user.uid), orderBy("createdAt", "desc"));
              list = await runQuery(colRef, q2);
            } catch (e) {
              // ignore and continue
            }

            if (list.length === 0) {
              try {
                const q3 = query(colRef, where("hostUid", "==", user.uid), orderBy("createdAt", "desc"));
                list = await runQuery(colRef, q3);
              } catch (e) {
                // ignore and continue
              }
            }
          }
        }

        // de-dupe by id (in case fallbacks overlap)
        const map = new Map();
        list.forEach((x) => map.set(x.id, x));
        const unique = Array.from(map.values());

        if (alive) {
          setRows(unique);
          setLoading(false);
        }
      } catch (e) {
        const msg = String(e?.message || "");
        console.error("Load listings error:", e);

        if (!alive) return;

        if (msg.includes("FAILED_PRECONDITION")) {
          setErr(
            "Firestore index missing for listings query. Create a composite index on (ownerId + createdAt) and/or (partnerUid + createdAt) in Firestore, then refresh."
          );
        } else {
          setErr("Could not load your listings.");
        }
        setRows([]);
        setLoading(false);
      }
    }

    loadMyListings();
    return () => {
      alive = false;
    };
  }, [user?.uid, isPartner]);

  // apply filters
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
      const matchStatus = status === "all" || s === status;

      return matchText && matchStatus;
    });
  }, [rows, q, status]);

  const heading =
    isPartner || (!isHost && !isPartner) ? "Your Portfolio Listings" : "Your Managed Listings";

  return (
    <main className="container mx-auto px-4 py-6 text-white" style={{ paddingTop: 96 }}>
      <button
        className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <h1 className="mt-4 text-2xl md:text-3xl font-extrabold">{heading}</h1>
      <p className="text-white/70 mt-1">Search, filter, and update your managed inventory.</p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {err}
        </div>
      )}

      {/* filters */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.6fr_1fr_auto] gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (title, city, area, id)"
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-amber-400/60"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-amber-400/60"
        >
          <option value="all">Any status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="review">under review</option>
        </select>
        <button
          onClick={() => {
            setQ("");
            setStatus("all");
          }}
          className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      {/* list */}
      <div className="mt-5">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="mb-3 text-white/80">No listings match your filters.</p>
            <Link
              to="/post/new"
              className="inline-block px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-600"
            >
              + Create Listing
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <li key={l.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="h-36 bg-white/5 border-b border-white/10" />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg flex-1 truncate">{l.title || "Untitled"}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-md border border-white/15 text-white/70 capitalize">
                      {l.status || "active"}
                    </span>
                  </div>

                  <div className="text-white/70 mt-1">
                    {l.city || "—"} • {l.area || "—"}
                    {typeof l.pricePerNight === "number" ? (
                      <> • ₦{Number(l.pricePerNight).toLocaleString()}/night</>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      to={`/listing/${l.id}`}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-center hover:bg-white/15"
                    >
                      View
                    </Link>
                    <Link
                      to={`/listing/${l.id}/edit`}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-center hover:bg-amber-600"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
