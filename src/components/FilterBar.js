// src/components/FilterBar.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const cleanNum = (v) => String(v || "").replace(/\D/g, "");
const normText = (v) => String(v || "").trim();

function normCityKey(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.toLowerCase().replace(/\s+/g, " ");
}

function toTitleCase(s) {
  return String(s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ✅ Accept legacy param keys (HomePage / old links)
function pickParam(params, keys) {
  for (const k of keys) {
    const v = params.get(k);
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

export default function FilterBar() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const init = useMemo(() => {
    const initQ = pickParam(params, ["q", "loc", "location"]);
    const initCity = pickParam(params, ["city", "loc", "location"]);
    return {
      q: initQ || "",
      city: initCity || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
    };
  }, [params]);

  const [q, setQ] = useState(init.q);
  const [city, setCity] = useState(init.city);
  const [min, setMin] = useState(init.min);
  const [max, setMax] = useState(init.max);

  const [cityOptions, setCityOptions] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);

  const lastAppliedRef = useRef(init);

  useEffect(() => {
    setQ(init.q);
    setCity(init.city);
    setMin(init.min);
    setMax(init.max);
    lastAppliedRef.current = init;
  }, [init]);

  // ✅ Fetch and dedupe city list from listings
  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      setCityLoading(true);
      try {
        const qRef = query(collection(db, "listings"), where("status", "==", "active"));
        const snap = await getDocs(qRef);
        if (!mounted) return;

        const map = new Map(); // key -> display label
        snap.forEach((d) => {
          const data = d.data() || {};
          const raw = data.city;

          const key = normCityKey(raw);
          if (!key) return;

          const display = String(raw || "").trim();
          const pretty = display && /[A-Z]/.test(display) ? display : toTitleCase(display);

          if (!map.has(key)) map.set(key, pretty);
        });

        const arr = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
        setCityOptions(arr);
      } catch (e) {
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

        /* ✅ give a bit of breathing room UNDER the whole row for helper text */
        .nesta-filter-shell{ padding-bottom: 18px; }

        @media (max-width: 980px){
          .nesta-filter-wrap{ grid-template-columns: 1fr 1fr; }
          .nesta-filter-actions{ grid-column: 1 / -1; justify-content: flex-end; }
          .nesta-filter-shell{ padding-bottom: 18px; }
        }
        @media (max-width: 520px){
          .nesta-filter-wrap{ grid-template-columns: 1fr; }
          .nesta-filter-actions{ justify-content: stretch; }
          .nesta-filter-actions > button{ width: 100%; }
          .nesta-filter-shell{ padding-bottom: 0px; } /* mobile stacks anyway */
        }
      `}</style>

      <div className="nesta-filter-shell">
        <div className="nesta-filter-wrap" onKeyDown={onKeyDown} role="search" aria-label="Search filters">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, city, area…"
            style={input}
          />

          {/* ✅ city helper does NOT affect layout height */}
          <div style={{ position: "relative", minWidth: 0, overflow: "visible" }}>
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

            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                fontSize: 11,
                color: "rgba(226,232,240,.55)",
                lineHeight: "14px",
                pointerEvents: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
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
