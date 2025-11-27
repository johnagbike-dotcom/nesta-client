import React, { useEffect, useState } from "react";
import { collection, where, query, getDocs, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { useFavourites } from "../hooks/useFavourites";
import { Link, useNavigate } from "react-router-dom";

export default function Wishlist() {
  const { favIds } = useFavourites();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ids = Array.from(favIds);
        if (ids.length === 0) { setRows([]); return; }
        // Firestore IN supports up to 10; batch if needed
        const batches = [];
        for (let i = 0; i < ids.length; i += 10) {
          const slice = ids.slice(i, i + 10);
          const qRef = query(collection(db, "listings"), where(documentId(), "in", slice));
          batches.push(getDocs(qRef));
        }
        const snaps = await Promise.all(batches);
        const all = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
        setRows(all);
      } finally {
        setLoading(false);
      }
    })();
  }, [favIds]);

  return (
    <main style={pageWrap}>
      <div className="container">
        <button className="btn ghost" onClick={() => navigate(-1)} style={{ marginTop: 10 }}>
          ← Back
        </button>
        <h2 style={{ marginTop: 12 }}>Your Favourites</h2>

        {loading ? (
          <p style={{ opacity: 0.8 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ opacity: 0.8, marginTop: 10 }}>
            No favourites yet. Go to <Link to="/explore">Explore</Link> to add some ♥
          </p>
        ) : (
          <div style={gridWrap}>
            {rows.map((l) => {
              const img = l.imageUrl || (Array.isArray(l.images) ? l.images[0] : null);
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
                  <h3 style={titleRow}>
                    <span>{l.title || "Untitled"}</span>
                  </h3>
                  <div style={metaLine}>
                    <span style={{ fontWeight: 700 }}>₦{price.toLocaleString()}</span>
                    <span style={{ opacity: 0.8 }}>/night</span>
                    <span style={{ opacity: 0.8, marginLeft: 10 }}>
                      • {l.city || "—"}{l.area ? ` • ${l.area}` : ""}
                    </span>
                  </div>
                  <div style={ctaRow}>
                    <Link className="btn" to={`/listing/${l.id}`} style={btnSecondary}>View</Link>
                    <Link className="btn" to={`/reserve/${l.id}`} style={btnPrimary}>Reserve</Link>
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

/* --- styles reuse (copy/paste or import from a shared file) --- */
const gold = "#d4af37";
const pageWrap = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 600px at 20% -10%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(120deg,#0b0f14,#10161c)",
  color: "#fff",
  paddingBottom: 56,
};
const gridWrap = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 18,
};
const card = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(31,41,55,0.52), rgba(31,41,55,0.32))",
};
const thumb = { borderRadius: 12, height: 150, marginBottom: 12 };
const titleRow = { display: "flex", alignItems: "center", gap: 8, margin: "4px 0 6px", fontWeight: 600 };
const metaLine = { marginBottom: 6 };
const ctaRow = { display: "flex", gap: 10 };
const btnPrimary = {
  borderRadius: 999,
  padding: "8px 14px",
  background: "linear-gradient(180deg, rgba(212,175,55,0.22), rgba(212,175,55,0.12))",
  border: "1px solid rgba(212,175,55,0.55)",
  color: gold,
};
const btnSecondary = {
  borderRadius: 999,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#fff",
}; 