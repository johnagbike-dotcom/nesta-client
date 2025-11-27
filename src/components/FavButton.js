import React from "react";
import { useFavourites } from "../hooks/useFavourites";

export default function FavButton({ listingId, size = 18 }) {
  const { isFav, toggle, hasUser } = useFavourites();
  const active = isFav(listingId);

  return (
    <button
      title={active ? "Remove from favourites" : "Add to favourites"}
      onClick={() => (hasUser ? toggle(listingId) : alert("Please log in to use favourites."))}
      style={{
        borderRadius: 999,
        padding: "6px 10px",
        border: `1px solid ${active ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.22)"}`,
        background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.05)",
        color: active ? "#d4af37" : "#fff",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      className="btn"
    >
      <span style={{ fontSize: size }}>{active ? "♥" : "♡"}</span>
      <span style={{ fontSize: 13 }}>{active ? "Favourited" : "Favourite"}</span>
    </button>
  );
} 