import React from "react";
import { useNavigate } from "react-router-dom";

/**
* Usage:
* <FeaturedCarousel items={[
*   { id: 'lagos-flat', title: 'Modern Apartment in Lagos', price: 35000, area: 'Victoria Island', image: '/featured/lagos.jpg' },
*   ...
* ]}/>
*/
export default function FeaturedCarousel({ items = [], intervalMs = 3500 }) {
  const [idx, setIdx] = React.useState(0);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [items.length, intervalMs]);

  if (!items.length) return null;

  const active = items[idx];

  return (
    <div
      className="card"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "linear-gradient(180deg, rgba(100,116,139,0.30), rgba(30,41,59,0.45))",
        boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", height: 280, overflow: "hidden" }}>
        <img
          src={active.image}
          alt={active.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onClick={() => navigate(`/listing/${active.id}`)}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.00) 45%)",
          }}
        />
        <div style={{ position: "absolute", left: 16, bottom: 12, right: 16, color: "#fff" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{active.title}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            ₦{active.price.toLocaleString()}/night • {active.area}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 10 }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: i === idx ? "#f0b429" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}