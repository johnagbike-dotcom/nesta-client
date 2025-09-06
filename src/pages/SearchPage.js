import React from "react";
import { useSearchParams } from "react-router-dom";

const formatMoney = (v) => {
  if (!v) return "";
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return v;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
};

const SearchPage = () => {
  const [params] = useSearchParams();
  const location = params.get("location") || "";
  const min = params.get("min") || "";
  const max = params.get("max") || "";

  return (
    <>
      
      <main className="container" style={{ padding: "24px 0 40px" }}>
        <h1 style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "28px" }}>
          Search Results
        </h1>
        <p style={{ color: "#6b7280", margin: 0 }}>
          {location ? `Location: ${location}` : "All locations"}
          {min ? ` • Min: ${formatMoney(min)}/night` : ""}
          {max ? ` • Max: ${formatMoney(max)}/night` : ""}
        </p>

        {/* Placeholder results grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "18px",
          marginTop: "16px"
        }}>
          {[1,2,3,4,5,6].map((i) => (
            <article key={i} className="feature-card">
              <h3 style={{ margin: "0 0 8px", color: "#a16207" }}>Sample Listing {i}</h3>
              <p style={{ margin: 0, color: "#6b7280" }}>
                {location || "Lagos"} • {formatMoney(min || 35000)}/night
              </p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
};

export default SearchPage;