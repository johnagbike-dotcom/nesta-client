// src/components/BankAutocomplete.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 20000,
  withCredentials: false,
});

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function cleanText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export default function BankAutocomplete({
  value,
  onChangeValue,
  onSelectBank,
  disabled = false,
  placeholder = "Start typing bank name…",
  country = "ng",
  limit = 10,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState([]);
  const [err, setErr] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const q = cleanText(value);
  const qDebounced = useDebouncedValue(q, 250);

  // Close on outside click
  useEffect(() => {
    function onDocDown(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Fetch banks
  useEffect(() => {
    let alive = true;

    async function run() {
      setErr("");
      setActiveIndex(-1);

      if (!open) return;
      if (disabled) return;

      // only fetch if user typed something meaningful
      if (!qDebounced || qDebounced.length < 2) {
        setBanks([]);
        return;
      }

      setLoading(true);
      try {
        const { data } = await api.get(`/banks/${country}`, {
          params: { q: qDebounced, limit },
        });

        const list = Array.isArray(data?.banks) ? data.banks : [];
        if (!alive) return;

        setBanks(
          list
            .map((b) => ({
              name: cleanText(b?.name),
              code: String(b?.code || ""),
            }))
            .filter((b) => b.name && b.code)
        );
      } catch (e) {
        if (!alive) return;
        setBanks([]);
        setErr("Could not load banks.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [open, disabled, qDebounced, country, limit]);

  const showDropdown = open && (loading || err || banks.length > 0 || (q && q.length >= 2));

  const hintText = useMemo(() => {
    if (!q || q.length < 2) return "Type at least 2 characters";
    if (loading) return "Searching…";
    if (err) return err;
    if (!banks.length) return "No matching banks";
    return "";
  }, [q, loading, err, banks.length]);

  function pickBank(b) {
    if (!b) return;
    onSelectBank?.(b);
    setOpen(false);
    setBanks([]);
    setActiveIndex(-1);

    // keep focus
    try {
      inputRef.current?.focus();
    } catch {}
  }

  function onKeyDown(e) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, banks.length - 1);
      setActiveIndex(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < banks.length) {
        e.preventDefault();
        pickBank(banks[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          onChangeValue?.(e.target.value);
          if (!disabled) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full bg-transparent outline-none placeholder-white/30 text-sm ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
        autoComplete="off"
      />

      {showDropdown ? (
        <div className="absolute z-[80] mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#070a10] shadow-[0_18px_70px_rgba(0,0,0,0.65)]">
          {hintText ? (
            <div className="px-4 py-3 text-xs text-white/60">{hintText}</div>
          ) : null}

          {banks.length > 0 ? (
            <ul className="max-h-64 overflow-auto">
              {banks.map((b, idx) => {
                const active = idx === activeIndex;
                return (
                  <li key={`${b.code}-${b.name}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
                      onClick={() => pickBank(b)}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 ${
                        active ? "bg-white/10" : "bg-transparent"
                      } hover:bg-white/10`}
                    >
                      <span className="text-white/90">{b.name}</span>
                      <span className="text-[11px] text-white/40">code: {b.code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
