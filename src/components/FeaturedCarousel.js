import React, { useEffect, useMemo, useState } from "react";

// Firestore is optional: we try it, then fall back to demo
let tryFirestore = true;
let firestore;
let fs;
try {
  // Lazy require so build won’t explode if firebase isn’t set
  // (Your existing firebase config should export "db")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db } = require("../firebase");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fs = require("firebase/firestore");
  firestore = db;
} catch {
  tryFirestore = false;
}

const DEMO = [
  {
    id: "demo-1",
    title: "Designer Studio, Lekki",
    city: "Lagos",
    area: "Lekki",
    pricePerNight: 45000,
    imageUrl: "/listings/lekki-1.jpg", // if missing, we’ll show a gradient
  },
  {
    id: "demo-2",
    title: "Signature Loft, VI",
    city: "Lagos",
    area: "Victoria Island",
    pricePerNight: 65000,
    imageUrl: "/listings/vi-1.jpg",
  },
];

export default function FeaturedCarousel() {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadFS() {
      try {
        if (!tryFirestore || !firestore || !fs) throw new Error("no FS");
        const q = fs.query(
          fs.collection(firestore, "listings"),
          fs.where("sponsored", "==", true),
          fs.orderBy("updatedAt", "desc"),
          fs.limit(10)
        );
        const snap = await fs.getDocs(q);
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!alive) return;
        if (rows.length > 0) {
          setItems(rows);
        } else {
          setItems(DEMO);
        }
      } catch {
        if (!alive) return;
        setItems(DEMO);
      }
    }

    loadFS();
    return () => { alive = false; };
  }, []);

  const curr = useMemo(() => items[i] || null, [items, i]);
  const total = items.length;

  function next() { setI(v => (total ? (v + 1) % total : 0)); }
  function prev() { setI(v => (total ? (v - 1 + total) % total : 0)); }

  return (
    <div className="carousel">
      {curr ? (
        <div className="carousel-card">
          <button className="nav left" onClick={prev} aria-label="Previous">‹</button>

          <div className="media">
            {curr.imageUrl ? (
              <img src={curr.imageUrl} alt={curr.title} />
            ) : (
              <div className="media-fallback" />
            )}
          </div>

          <div className="meta">
            <div className="title">{curr.title}</div>
            <div className="sub">
              ₦{Number(curr.pricePerNight || curr.total || 0).toLocaleString()}/night · {curr.area} · {curr.city}
            </div>
          </div>

          <button className="nav right" onClick={next} aria-label="Next">›</button>
        </div>
      ) : (
        <div className="carousel-card skeleton" />
      )}

      {total > 1 && (
        <div className="dots">
          {items.map((_, idx) => (
            <span
              key={idx}
              className={idx === i ? "dot active" : "dot"}
              onClick={() => setI(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
} 
