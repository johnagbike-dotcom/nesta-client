import React, { useCallback, useMemo, useState } from "react";
import { useFavourites } from "../hooks/useFavourites";

export default function FavButton({
  listingId,
  size = 18,
  compact = false,
  onRequireLogin,
}) {
  const { isFav, toggle, hasUser } = useFavourites();
  const active = isFav(listingId);

  const [msg, setMsg] = useState("");

  const label = useMemo(
    () => (active ? "Remove from favourites" : "Add to favourites"),
    [active]
  );

  const fireHint = useCallback((text) => {
    setMsg(text);
    window.clearTimeout(fireHint._t);
    fireHint._t = window.setTimeout(() => setMsg(""), 2000);
  }, []);
  // eslint-disable-next-line
  fireHint._t = fireHint._t;

  const onClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!listingId) return;

      if (!hasUser) {
        if (typeof onRequireLogin === "function") onRequireLogin();
        else fireHint("Please log in to use favourites.");
        return;
      }

      toggle(listingId);
      fireHint(active ? "Removed from favourites" : "Added to favourites");
    },
    [listingId, hasUser, toggle, active, onRequireLogin, fireHint]
  );

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        style={{
          borderRadius: 999,
          padding: compact ? "6px 10px" : "8px 12px",
          border: `1px solid ${
            active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.18)"
          }`,
          background: active
            ? "linear-gradient(180deg, rgba(212,175,55,0.22), rgba(212,175,55,0.10))"
            : "rgba(255,255,255,0.05)",
          color: active ? "#d4af37" : "#fff",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          boxShadow: active ? "0 14px 34px rgba(212,175,55,0.10)" : "none",
          transition: "transform .06s ease, filter .15s ease, box-shadow .15s ease",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
      >
        <span style={{ fontSize: size, lineHeight: 1 }}>
          {active ? "♥" : "♡"}
        </span>
        {!compact && (
          <span style={{ fontSize: 13, fontWeight: 800 }}>
            {active ? "Favourited" : "Favourite"}
          </span>
        )}
      </button>

      {/* subtle hint (replaces alert) */}
      {msg ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: 12,
            color: "rgba(226,232,240,.7)",
            paddingLeft: 6,
          }}
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}
