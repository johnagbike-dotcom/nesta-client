// src/pages/GuestDashboard.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const dummyListings = [
  { id: 1, title: "Modern Apartment in Lagos", price: 35000, location: "Victoria Island" },
  { id: 2, title: "Cozy Flat in Abuja", price: 25000, location: "Gwarinpa" },
  { id: 3, title: "Guest House in Port Harcourt", price: 18000, location: "Woji" },
  { id: 4, title: "Luxury Suite in Ibadan", price: 40000, location: "Bodija" },
];

export default function GuestDashboard() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const filtered = useMemo(() => {
    return dummyListings.filter((l) => {
      const kw = q.trim().toLowerCase();
      const matchKw =
        !kw ||
        l.title.toLowerCase().includes(kw) ||
        l.location.toLowerCase().includes(kw);
      const matchMin = !min || l.price >= parseInt(min, 10);
      const matchMax = !max || l.price <= parseInt(max, 10);
      return matchKw && matchMin && matchMax;
    });
  }, [q, min, max]);

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <button className="btn ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="h1" style={{ marginTop: 12, marginBottom: 20 }}>
          Welcome, Guest! 🏡
        </h1>

        {/* Filter panel */}
        <div
          className="card"
          style={{
            marginBottom: 28,
            padding: 24,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.15)",
            background:
              "linear-gradient(180deg, rgba(30,41,59,0.55), rgba(30,41,59,0.35))",
            boxShadow:
              "0 16px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <h2 className="h2" style={{ marginBottom: 14 }}>
            Find Your Stay
          </h2>
          <div className="form-row" style={{ gap: 12 }}>
            <input
              className="input"
              placeholder="Search by location or keyword"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Min ₦/night"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Max ₦/night"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>

        {/* Listings */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {filtered.map((l) => (
            <article
              key={l.id}
              className="card"
              style={{
                padding: 20,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(180deg, rgba(31,41,55,0.55), rgba(31,41,55,0.35))",
                boxShadow:
                  "0 14px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                textAlign: "center",
              }}
            >
              <h3 style={{ margin: "6px 0 10px", color: "#f3f4f6" }}>
                {l.title}
              </h3>
              <p className="meta" style={{ marginBottom: 12 }}>
                ₦{l.price.toLocaleString()}/night • {l.location}
              </p>
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => navigate(`/listing/${l.id}`)}
              >
                View
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}