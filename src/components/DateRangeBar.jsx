import React from "react";

function toYMD(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

/** Props:
 *  range: { from: string, to: string }  // YYYY-MM-DD (or "")
 *  onChange: (next) => void
 *  className?: string
 */
export default function DateRangeBar({ range, onChange, className = "" }) {
  const fromVal = toYMD(range?.from);
  const toVal = toYMD(range?.to);

  function set(k, v) {
    onChange({ ...(range || {}), [k]: v || "" });
  }
  function clear() {
    onChange({ from: "", to: "" });
  }

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.04)",
        marginBottom: 12,
      }}
    >
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          From
        </div>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => set("from", e.target.value)}
          className="input"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 12,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
            color: "inherit",
          }}
        />
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          To
        </div>
        <input
          type="date"
          value={toVal}
          onChange={(e) => set("to", e.target.value)}
          className="input"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 12,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
            color: "inherit",
          }}
        />
      </div>

      <button
        type="button"
        onClick={clear}
        className="btn"
        style={{
          padding: "10px 14px", borderRadius: 12, fontWeight: 800,
          background: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
          color: "#1a1405", border: "1px solid rgba(255,210,64,.75)",
          whiteSpace: "nowrap",
        }}
      >
        Clear range
      </button>
    </div>
  );
}
