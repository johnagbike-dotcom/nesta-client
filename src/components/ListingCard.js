// src/components/ListingCards.js
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import CheckoutButtons from "./CheckoutButtons";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const Naira = new Intl.NumberFormat("en-NG");

function getRatingData(l) {
  const avg =
    Number.isFinite(Number(l?.ratingAvg)) && Number(l?.ratingAvg) > 0
      ? Number(l.ratingAvg)
      : Number.isFinite(Number(l?.rating)) && Number(l?.rating) > 0
      ? Number(l.rating)
      : 0;

  const count =
    Number.isFinite(Number(l?.ratingCount)) && Number(l?.ratingCount) >= 0
      ? Number(l.ratingCount)
      : 0;

  return { avg, count };
}

function Stars({ value = 0, count = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const full = Math.floor(v);
  const hasHalf = v - full >= 0.5;

  const stars = Array.from({ length: 5 }).map((_, i) => {
    if (i < full) return "★";
    if (i === full && hasHalf) return "⯪";
    return "☆";
  });

  if (!v && !count) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span
        style={{
          fontSize: 12,
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          color: "rgba(255,255,255,.9)",
        }}
      >
        <span style={{ color: "#fbbf24" }}>{stars.join("")}</span>{" "}
        <span style={{ opacity: 0.9 }}>{v.toFixed(1)}</span
        >
      </span>

      {count > 0 ? (
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {count} review{count === 1 ? "" : "s"}
        </span>
      ) : (
        <span style={{ fontSize: 12, opacity: 0.6 }}>New</span>
      )}
    </div>
  );
}

export default function ListingCard({ listing }) {
  const {
    id,
    title,
    area,
    city,
    priceN,
    image,
    description,
    bedrooms,
    bathrooms,
    ownerId,
    hostId,
    partnerId,
    userId,
  } = listing;

  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.uid);

  // Normalize role safely
  const roleRaw =
    profile?.role || profile?.accountType || profile?.userType || profile?.kind || "";
  const role = String(roleRaw).toLowerCase();

  // While loading: treat as host/partner (so we DO NOT show guest actions)
  const isHostOrPartner = loading || role === "host" || role === "partner" || role === "admin";

  // Detect if current user owns this listing
  const uid = user?.uid;
  const isOwner =
    !!uid &&
    [ownerId, hostId, partnerId, userId]
      .filter(Boolean)
      .map(String)
      .includes(String(uid));

  // Rating badge for cards
  const { avg, count } = useMemo(() => getRatingData(listing), [listing]);

  return (
    <div
      className="listing-card"
      style={{
        background: "#18181b",
        border: "1px solid #2a2a2e",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
        <img
          src={image}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      </div>

      <div style={{ padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h3>
        <div style={{ opacity: 0.85, marginTop: 4 }}>
          {area}, {city}
        </div>

        {/* ✅ stars on listing cards */}
        <Stars value={avg} count={count} />

        <div style={{ display: "flex", gap: 10, marginTop: 10, opacity: 0.9 }}>
          <span>🛏 {bedrooms}</span>
          <span>🛁 {bathrooms}</span>
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          ₦{Naira.format(priceN)} <span style={{ fontSize: 14 }}>/ night</span>
        </div>

        <p style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.5 }}>
          {description}
        </p>

        {/* HOSTS / PARTNERS: View + Edit ONLY */}
        {isHostOrPartner ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              to={`/listing/${id}`}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(255,255,255,.04)",
                color: "#f9fafb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View
            </Link>

            {isOwner && (
              <Link
                to={`/listing/${id}/edit`}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(250,204,21,.6)",
                  background: "linear-gradient(180deg,#fde68a,#facc15 60%,#eab308)",
                  color: "#1b1505",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Edit listing
              </Link>
            )}
          </div>
        ) : (
          // GUESTS ONLY: Reserve (chat removed)
          <CheckoutButtons
  listingId={id}
  amountN={priceN}
  title={title}
  city={city}
  area={area}
/>
        )}
      </div>
    </div>
  );
}
