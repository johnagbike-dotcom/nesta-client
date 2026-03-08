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

function pickImage(listing) {
  return (
    listing?.primaryImageUrl ||
    (Array.isArray(listing?.images) && listing.images[0]) ||
    (Array.isArray(listing?.imageUrls) && listing.imageUrls[0]) ||
    (Array.isArray(listing?.photos) && listing.photos[0]) ||
    listing?.coverImage ||
    listing?.coverUrl ||
    listing?.imageUrl ||
    listing?.image ||
    "/hero.jpg"
  );
}

function pickPrice(listing) {
  const value =
    listing?.pricePerNight ??
    listing?.nightlyRate ??
    listing?.priceN ??
    listing?.price ??
    0;

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickGuests(listing) {
  const candidates = [
    listing?.maxGuests,
    listing?.guests,
    listing?.guestCapacity,
    listing?.capacity,
    listing?.sleeps,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function trimText(text, max = 120) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 10,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 12,
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          color: "rgba(255,255,255,.9)",
          fontWeight: 700,
        }}
      >
        <span style={{ color: "#fbbf24" }}>{stars.join("")}</span>{" "}
        <span style={{ opacity: 0.95 }}>{v.toFixed(1)}</span>
      </span>

      {count > 0 ? (
        <span style={{ fontSize: 12, opacity: 0.72 }}>
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
    description,
    bedrooms,
    bathrooms,
    ownerId,
    hostId,
    partnerId,
    userId,
  } = listing;

  const image = pickImage(listing);
  const price = pickPrice(listing);
  const guests = pickGuests(listing);

  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.uid);

  const roleRaw =
    profile?.role || profile?.accountType || profile?.userType || profile?.kind || "";
  const role = String(roleRaw).toLowerCase();

  // While loading: treat as host/partner/admin so guest actions do not flash
  const isHostOrPartner =
    loading || role === "host" || role === "partner" || role === "admin";

  const uid = user?.uid;
  const isOwner =
    !!uid &&
    [ownerId, hostId, partnerId, userId]
      .filter(Boolean)
      .map(String)
      .includes(String(uid));

  const { avg, count } = useMemo(() => getRatingData(listing), [listing]);

  const metaBits = [
    Number.isFinite(Number(bedrooms)) && Number(bedrooms) > 0
      ? `🛏 ${Number(bedrooms)}`
      : null,
    Number.isFinite(Number(bathrooms)) && Number(bathrooms) > 0
      ? `🛁 ${Number(bathrooms)}`
      : null,
    guests ? `👤 ${guests}` : null,
  ].filter(Boolean);

  return (
    <div
      className="listing-card"
      style={{
        background:
          "linear-gradient(180deg, rgba(24,24,27,0.98), rgba(16,16,19,0.98))",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 14px 36px rgba(0,0,0,0.35)",
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 22px 46px rgba(0,0,0,0.42)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 14px 36px rgba(0,0,0,0.35)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 10",
          overflow: "hidden",
          background: "rgba(255,255,255,.03)",
          position: "relative",
        }}
      >
        <img
          src={image}
          alt={title || "Listing"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/hero.jpg";
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "auto 0 0 0",
            height: 70,
            background: "linear-gradient(to top, rgba(0,0,0,.48), rgba(0,0,0,0))",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ padding: 16 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1.2,
          }}
        >
          {title || "Luxury stay"}
        </h3>

        <div
          style={{
            opacity: 0.8,
            marginTop: 6,
            fontSize: 14,
            color: "rgba(255,255,255,.82)",
          }}
        >
          {area || "—"}, {city || "Nigeria"}
        </div>

        <Stars value={avg} count={count} />

        {metaBits.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap",
              color: "rgba(255,255,255,.9)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {metaBits.map((bit) => (
              <span
                key={bit}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                }}
              >
                {bit}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#fde68a",
          }}
        >
          ₦{Naira.format(price)}{" "}
          <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)", fontWeight: 700 }}>
            / night
          </span>
        </div>

        <p
          style={{
            marginTop: 10,
            opacity: 0.86,
            lineHeight: 1.6,
            color: "rgba(255,255,255,.82)",
            minHeight: 52,
          }}
        >
          {trimText(description, 115) || "Premium stay curated for comfort, convenience and a smooth Nesta experience."}
        </p>

        {isHostOrPartner ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
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
          <div style={{ marginTop: 14 }}>
            <CheckoutButtons
              listingId={id}
              amountN={price}
              title={title}
              city={city}
              area={area}
            />
          </div>
        )}
      </div>
    </div>
  );
}