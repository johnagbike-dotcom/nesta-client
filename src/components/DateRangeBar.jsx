import React, { useMemo } from "react";

function toYMD(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

/**
 * Props:
 * range: { from: string, to: string } // YYYY-MM-DD (or "")
 * onChange: (next) => void
 * className?: string
 */
export default function DateRangeBar({ range, onChange, className = "" }) {
  const fromVal = toYMD(range?.from);
  const toVal = toYMD(range?.to);

  const minTo = fromVal || undefined; // prevent selecting "to" before "from"
  const maxFrom = toVal || undefined; // prevent selecting "from" after "to"

  const helper = useMemo(() => {
    if (!fromVal && !toVal) return "Select your check-in and check-out dates.";
    if (fromVal && !toVal) return "Now choose your check-out date.";
    if (!fromVal && toVal) return "Now choose your check-in date.";
    return "Date range selected.";
  }, [fromVal, toVal]);

  function set(k, v) {
    const next = { ...(range || {}), [k]: v || "" };

    // safety swap if user forces invalid order
    const f = next.from ? new Date(next.from).getTime() : null;
    const t = next.to ? new Date(next.to).getTime() : null;
    if (f != null && t != null && f > t) {
      const tmp = next.from;
      next.from = next.to;
      next.to = tmp;
    }

    onChange(next);
  }

  function clear() {
    onChange({ from: "", to: "" });
  }

  return (
    <>
      <style>{`
        .nesta-daterange{
          display:grid;
          grid-template-columns: 1fr 1fr auto;
          gap:10px;
          align-items:end;
        }
        @media (max-width: 720px){
          .nesta-daterange{ grid-template-columns: 1fr; }
          .nesta-daterange button{ width: 100%; }
        }
      `}</style>

      <div
        className={`${className} nesta-daterange`}
        style={{
          padding: 14,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.08)",
          background:
            "radial-gradient(circle at top, rgba(255,255,255,.05), rgba(255,255,255,.03))",
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(226,232,240,.65)" }}>
            From
          </div>
          <input
            type="date"
            value={fromVal}
            max={maxFrom}
            onChange={(e) => set("from", e.target.value)}
            style={input}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(226,232,240,.65)" }}>
            To
          </div>
          <input
            type="date"
            value={toVal}
            min={minTo}
            onChange={(e) => set("to", e.target.value)}
            style={input}
          />
        </div>

        <button type="button" onClick={clear} style={btnGold}>
          Clear range
        </button>

        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 12,
            color: "rgba(226,232,240,.55)",
            marginTop: 2,
          }}
          aria-live="polite"
        >
          {helper}
        </div>
      </div>
    </>
  );
}

const input = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "inherit",
  outline: "none",
};

const btnGold = {
  padding: "11px 16px",
  borderRadius: 999,
  fontWeight: 900,
  background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
  color: "#1a1405",
  border: "1px solid rgba(255,210,64,.75)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
