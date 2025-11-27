// src/components/BrowseFiltersBar.jsx
import React, { useState } from "react";
import { useNavigate, createSearchParams } from "react-router-dom";

const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Owerri"];

export default function BrowseFiltersBar() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  function goTo(paramsObj) {
    nav({
      pathname: "/search",
      search: `?${createSearchParams(paramsObj)}`,
    });
  }

  return (
    <div style={{ margin: "8px 0 20px 0" }}>
      {/* City chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {CITIES.map((c) => (
          <button
            key={c}
            onClick={() => goTo({ city: c.toLowerCase() })}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => goTo({})}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          Explore all
        </button>
      </div>

      {/* Optional free-text + price range */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const params = {};
          if (q.trim()) params.q = q.trim();
          if (min.trim()) params.min = min.trim();
          if (max.trim()) params.max = max.trim();
          goTo(params);
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 140px 120px",
          gap: 8,
          alignItems: "center",
          maxWidth: 800,
        }}
      >
        <input
          placeholder="Search title, city, area…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#e5e7eb",
          }}
        />
        <input
          placeholder="Min ₦/night"
          inputMode="numeric"
          value={min}
          onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#e5e7eb",
          }}
        />
        <input
          placeholder="Max ₦/night"
          inputMode="numeric"
          value={max}
          onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#e5e7eb",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(234,179,8,0.3)",
            background: "#facc15",
            color: "#111827",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>
    </div>
  );
} 
