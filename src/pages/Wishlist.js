import React, { useEffect, useMemo, useState } from "react";
import { collection, where, query, getDocs, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { useFavourites } from "../hooks/useFavourites";
import { Link, useNavigate } from "react-router-dom";

export default function Wishlist() {
  const { favIds } = useFavourites();
  const navigate = useNavigate();

  const ids = useMemo(() => Array.from(favIds || []), [favIds]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        if (ids.length === 0) {
          if (!alive) return;
          setRows([]);
          return;
        }

        // Firestore IN supports up to 10; batch if needed
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

        if (!alive) return;
        setRows(ordered);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [ids]);

  return (
    <main style={pageWrap}>
      <div className="max-w-6xl mx-auto px-4" style={{ paddingTop: "calc(var(--topbar-h, 88px) + 18px)" }}>
        <button
          className="btn ghost"
          onClick={() => navigate(-1)}
          style={backBtn}
        >
          ← Back
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginTop: 12, marginBottom: 6 }}>Your Favourites</h2>
          {!loading ? (
            <div style={{ color: "rgba(226,232,240,.6)", fontSize: 13 }}>
              {rows.length} saved
            </div>
          ) : null}
        </div>

        {loading ? (
          <p style={{ opacity: 0.8 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ margin: 0, opacity: 0.85 }}>
              No favourites yet. Go to <Link to="/explore" style={goldLink}>Explore</Link> to add some ♥
            </p>
          </div>
        ) : (
          <div style={gridWrap}>
            {rows.map((l) => {
              const img =
                (Array.isArray(l.photos) && l.photos[0]) ||
                l.imageUrl ||
                (Array.isArray(l.images) ? l.images[0] : null);

              const price = Number(l.pricePerNight || 0);

              return (
                <article key={l.id} style={card}>
                  <div
                    style={{
                      ...thumb,
                      background: img
                        ? `url(${img}) center/cover no-repeat`
                        : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                    }}
                  />

                  <h3 style={titleRow}>{l.title || "Untitled"}</h3>

                  <div style={metaLine}>
                    <span style={{ fontWeight: 900 }}>₦{price.toLocaleString()}</span>
                    <span style={{ opacity: 0.8 }}>/night</span>
                    <span style={{ opacity: 0.8, marginLeft: 10 }}>
                      • {l.city || "—"}
                      {l.area ? ` • ${l.area}` : ""}
                    </span>
                  </div>

                  <div style={ctaRow}>
                    <Link className="btn" to={`/listing/${l.id}`} style={btnSecondary}>
                      View
                    </Link>
                    <Link className="btn" to={`/listing/${l.id}?tab=reserve`} style={btnPrimary}>
                      Reserve
                    </Link>
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

const gold = "#d4af37";
const pageWrap = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 600px at 20% -10%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(120deg,#0b0f14,#10161c)",
  color: "#fff",
  paddingBottom: 56,
};

const backBtn = {
  marginTop: 10,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.10)",
  color: "#e5e7eb",
  padding: "8px 14px",
  borderRadius: 999,
  cursor: "pointer",
  fontWeight: 800,
};

const emptyCard = {
  marginTop: 16,
  padding: 18,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
};

const goldLink = {
  color: "#facc15",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const gridWrap = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 18,
};

const card = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(31,41,55,0.52), rgba(31,41,55,0.30))",
  boxShadow: "0 20px 60px rgba(0,0,0,.25)",
};

const thumb = { borderRadius: 14, height: 160, marginBottom: 12 };
const titleRow = { margin: "4px 0 8px", fontWeight: 800, color: "#fff" };
const metaLine = { marginBottom: 10, color: "rgba(226,232,240,.85)" };
const ctaRow = { display: "flex", gap: 10, flexWrap: "wrap" };

const btnPrimary = {
  borderRadius: 999,
  padding: "9px 14px",
  background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
  border: "1px solid rgba(0,0,0,.12)",
  color: "#201807",
  fontWeight: 900,
};

const btnSecondary = {
  borderRadius: 999,
  padding: "9px 14px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
  fontWeight: 800,
};
