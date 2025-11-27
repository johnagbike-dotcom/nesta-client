// src/components/FilterBar.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function FilterBar() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const init = useMemo(() => ({
    q: params.get("q") || "",
    city: params.get("city") || "",
    min: params.get("min") || "",
    max: params.get("max") || "",
  }), [params]);

  const [q, setQ] = useState(init.q);
  const [city, setCity] = useState(init.city);
  const [min, setMin] = useState(init.min);
  const [max, setMax] = useState(init.max);

  // keep inputs in sync if user navigates via back/forward
  useEffect(() => {
    setQ(init.q); setCity(init.city); setMin(init.min); setMax(init.max);
  }, [init]);

  function apply() {
    const s = new URLSearchParams();
    if (q.trim()) s.set("q", q.trim());
    if (city.trim()) s.set("city", city.trim().toLowerCase());
    if (min) s.set("min", String(Number(min)));
    if (max) s.set("max", String(Number(max)));
    nav(`/search?${s.toString()}`);
  }

  function reset() {
    setQ(""); setCity(""); setMin(""); setMax("");
    nav("/search");
  }

  return (
    <div style={wrap}>
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search title/city/area"
             style={input} />
      <input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="City (e.g. lagos)"
             style={input} />
      <input value={min} onChange={(e)=>setMin(e.target.value.replace(/\D/g,""))}
             placeholder="Min ₦/night" style={input} />
      <input value={max} onChange={(e)=>setMax(e.target.value.replace(/\D/g,""))}
             placeholder="Max ₦/night" style={input} />
      <button onClick={apply} style={btnPrimary}>Apply</button>
      <button onClick={reset} style={btnGhost}>Reset</button>
    </div>
  );
}

const wrap = { display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr auto auto", gap: 8, margin: "8px 0 16px" };
const input = { padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#e5e7eb", outline: "none" };
const btnPrimary = { background: "#f59e0b", color: "#111827", border: "none", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontWeight: 700 };
const btnGhost = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e7eb", padding: "8px 14px", borderRadius: 999, cursor: "pointer" }; 




