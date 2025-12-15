// src/components/FilterBar.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const cleanNum = (v) => String(v || "").replace(/\D/g, "");
const normText = (v) => String(v || "").trim();

export default function FilterBar() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const init = useMemo(
    () => ({
      q: params.get("q") || "",
      city: params.get("city") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
    }),
    [params]
  );

  const [q, setQ] = useState(init.q);
  const [city, setCity] = useState(init.city);
  const [min, setMin] = useState(init.min);
  const [max, setMax] = useState(init.max);

  const lastAppliedRef = useRef(init);

  // keep inputs in sync if user navigates via back/forward
  useEffect(() => {
    setQ(init.q);
    setCity(init.city);
    setMin(init.min);
    setMax(init.max);
    lastAppliedRef.current = init;
  }, [init]);

  const currentNormalized = useMemo(() => {
    const nq = normText(q);
    const nc = normText(city);
    const nmin = cleanNum(min);
    const nmax = cleanNum(max);

    let minN = nmin ? Number(nmin) : null;
    let maxN = nmax ? Number(nmax) : null;

    // swap if min > max
    if (minN != null && maxN != null && minN > maxN) {
      const t = minN;
      minN = maxN;
      maxN = t;
    }

    return {
      q: nq,
      city: nc,
      min: minN != null ? String(minN) : "",
      max: maxN != null ? String(maxN) : "",
    };
  }, [q, city, min, max]);

  const hasChanges = useMemo(() => {
    const a = lastAppliedRef.current || {};
    return (
      String(a.q || "") !== currentNormalized.q ||
      String(a.city || "") !== currentNormalized.city ||
      String(a.min || "") !== currentNormalized.min ||
      String(a.max || "") !== currentNormalized.max
    );
  }, [currentNormalized]);

  const apply = useCallback(() => {
    const s = new URLSearchParams();

    if (currentNormalized.q) s.set("q", currentNormalized.q);

    // ✅ Keep city as typed (so “Lagos”, “Abuja” looks premium in chips)
    // If your Firestore stores lowercase cities, then use:
    // s.set("city", currentNormalized.city.toLowerCase())
    if (currentNormalized.city) s.set("city", currentNormalized.city);

    if (currentNormalized.min) s.set("min", currentNormalized.min);
    if (currentNormalized.max) s.set("max", currentNormalized.max);

    lastAppliedRef.current = { ...currentNormalized };
    nav(`/search${s.toString() ? `?${s.toString()}` : ""}`);
  }, [currentNormalized, nav]);

  const reset = useCallback(() => {
    setQ("");
    setCity("");
    setMin("");
    setMax("");
    lastAppliedRef.current = { q: "", city: "", min: "", max: "" };
    nav("/search");
  }, [nav]);

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (hasChanges) apply();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      reset();
    }
  };

  const canApply = hasChanges;

  return (
    <>
      {/* ✅ Local responsive rules (no global CSS required) */}
      <style>{`
        .nesta-filter-wrap{
          display:grid;
          gap:10px;
          margin: 6px 0 0;
          grid-template-columns: 1.35fr 1fr .85fr .85fr auto auto;
          align-items:center;
        }
        @media (max-width: 980px){
          .nesta-filter-wrap{ grid-template-columns: 1fr 1fr; }
          .nesta-filter-actions{ grid-column: 1 / -1; justify-content: flex-end; }
        }
        @media (max-width: 520px){
          .nesta-filter-wrap{ grid-template-columns: 1fr; }
          .nesta-filter-actions{ justify-content: stretch; }
          .nesta-filter-actions > button{ width: 100%; }
        }
      `}</style>

      <div
        className="nesta-filter-wrap"
        onKeyDown={onKeyDown}
        role="search"
        aria-label="Search filters"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, city, area…"
          style={input}
        />

        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Lagos)"
          style={input}
        />

        <input
          value={min}
          onChange={(e) => setMin(cleanNum(e.target.value))}
          inputMode="numeric"
          placeholder="Min ₦/night"
          style={input}
        />

        <input
          value={max}
          onChange={(e) => setMax(cleanNum(e.target.value))}
          inputMode="numeric"
          placeholder="Max ₦/night"
          style={input}
        />

        <div className="nesta-filter-actions" style={actionsRow}>
          <button
            onClick={apply}
            disabled={!canApply}
            aria-disabled={!canApply}
            title={canApply ? "Apply filters" : "No changes to apply"}
            style={{
              ...btnPrimary,
              opacity: canApply ? 1 : 0.55,
              cursor: canApply ? "pointer" : "not-allowed",
            }}
          >
            Apply
          </button>

          <button onClick={reset} style={btnGhost} title="Reset filters">
            Reset
          </button>
        </div>

        {/* Optional helper line (luxury: subtle, not loud) */}
        <div style={hintLine}>
          Press <b>Enter</b> to apply • <b>Esc</b> to reset
        </div>
      </div>
    </>
  );
}

const input = {
  padding: "11px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#e5e7eb",
  outline: "none",
  minWidth: 0,
};

const actionsRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  justifyContent: "flex-end",
};

const btnPrimary = {
  background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
  color: "#201807",
  border: "1px solid rgba(0,0,0,.12)",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 900,
};

const btnGhost = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#e5e7eb",
  padding: "11px 16px",
  borderRadius: 999,
  cursor: "pointer",
};

const hintLine = {
  gridColumn: "1 / -1",
  marginTop: 2,
  fontSize: 12,
  color: "rgba(226,232,240,.55)",
};
