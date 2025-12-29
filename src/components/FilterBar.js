// src/components/FilterBar.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const cleanNum = (v) => String(v || "").replace(/\D/g, "");
const normText = (v) => String(v || "").trim();

function normCityKey(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.toLowerCase().replace(/\s+/g, " ");
}

function toTitleCase(s) {
  // “abuja” -> “Abuja”, “port harcourt” -> “Port Harcourt”
  return String(s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
  const [city, setCity] = useState(init.city); // what user sees/edits
  const [min, setMin] = useState(init.min);
  const [max, setMax] = useState(init.max);

  // ✅ City suggestions (deduped)
  const [cityOptions, setCityOptions] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);

  const lastAppliedRef = useRef(init);

  // keep inputs in sync if user navigates via back/forward
  useEffect(() => {
    setQ(init.q);
    setCity(init.city);
    setMin(init.min);
    setMax(init.max);
    lastAppliedRef.current = init;
  }, [init]);

  // ✅ Fetch and dedupe city list from listings (simple + safe)
  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      setCityLoading(true);
      try {
        const snap = await getDocs(collection(db, "listings"));
        if (!mounted) return;

        const map = new Map(); // key -> display label
        snap.forEach((d) => {
          const data = d.data() || {};
          const raw = data.city;

          const key = normCityKey(raw);
          if (!key) return;

          // Choose best display version:
          // - If Firestore stores nice casing use it
          // - Else convert to Title Case
          const display = String(raw || "").trim();
          const pretty = display && /[A-Z]/.test(display) ? display : toTitleCase(display);

          if (!map.has(key)) map.set(key, pretty);
        });

        const arr = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
        setCityOptions(arr);
      } catch (e) {
        // non-fatal; city can still be typed manually
        console.warn("[FilterBar] could not load cities:", e);
        if (mounted) setCityOptions([]);
      } finally {
        if (mounted) setCityLoading(false);
      }
    }

    loadCities();
    return () => {
      mounted = false;
    };
  }, []);

  const currentNormalized = useMemo(() => {
    const nq = normText(q);

    // ✅ If user selects “Any city” or blanks it, store empty
    const ncRaw = normText(city);
    const ncKey = normCityKey(ncRaw);
    const nc =
      !ncKey || ncKey === "any" || ncKey === "any city" || ncKey === "all" || ncKey === "all cities"
        ? ""
        : ncRaw;

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

    // ✅ Keep city as typed (chips look premium)
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

      <div className="nesta-filter-wrap" onKeyDown={onKeyDown} role="search" aria-label="Search filters">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, city, area…"
          style={input}
        />

        {/* ✅ Premium city select + searchable fallback */}
        <div style={{ position: "relative", minWidth: 0 }}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            list="nesta-city-list"
            placeholder={cityLoading ? "Loading cities…" : "Any city"}
            style={input}
            aria-label="City"
          />
          <datalist id="nesta-city-list">
            <option value="">Any city</option>
            {cityOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {/* subtle helper */}
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(226,232,240,.55)" }}>
            {cityOptions.length ? "Pick a city or type one." : "Type a city (e.g. Lagos, Abuja)."}
          </div>
        </div>

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
