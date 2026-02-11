// src/pages/HomePage.js
import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import FeaturedCarousel from "../components/FeaturedCarousel";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

/* ---------- page constants ---------- */

// Hero image – local file in /public
const HERO_BG = "/hero.jpg";
const HERO_BG_FALLBACK = HERO_BG;

const destinations = [
  {
    id: "lagos",
    name: "Lagos",
    tagline: "Ikoyi • Lekki • Victoria Island",
    query: "Lagos",
    img: "https://images.unsplash.com/photo-1501877008226-4fca48ee50c1?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "abuja",
    name: "Abuja",
    tagline: "Maitama • Asokoro • Wuse 2",
    query: "Abuja",
    img: "https://images.unsplash.com/photo-1502672023488-70e25813eb80?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "ph",
    name: "Port Harcourt",
    tagline: "Waterfront apartments and business stays",
    query: "Port Harcourt",
    img: "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?q=80&w=1600&auto=format&fit=crop",
  },
];

const section = (mt = 28) => ({
  marginTop: mt,
  padding: "32px 0",
  borderTop: "1px solid rgba(255,255,255,.06)",
});

/* ---------- helpers ---------- */

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";
  return r;
}

function digitsOnly(v) {
  // allows: "₦50,000" -> "50000"
  return String(v || "").replace(/[^\d]/g, "");
}

function normalizeKey(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * If the user types an AREA (Ikoyi/Lekki/Wuse/etc) we should NOT set ?city=
 * because SearchBrowse uses exact city matching.
 * We only set ?city= for known city intents.
 */
function isKnownCityIntent(input) {
  const k = normalizeKey(input);

  // Add more cities here as you expand inventory
  const known = new Set([
    "lagos",
    "abuja",
    "abuja fct",
    "abuja, fct",
    "fct",
    "f.c.t",
    "port harcourt",
    "port-harcourt",
    "portharcourt",
  ]);

  return known.has(k);
}

/* ---------- component ---------- */
export default function HomePage() {
  const nav = useNavigate();

  const [loc, setLoc] = useState("");
  const [minN, setMinN] = useState("");
  const [maxN, setMaxN] = useState("");

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";
  const isHost = role === "host";
  const isPartner = role === "partner";
  const hasDashboardRole = isHost || isPartner || isAdmin;

  const heroBg = HERO_BG || HERO_BG_FALLBACK;

  // ✅ Always send onboarding CTAs through Step 1 (KycStart)
  const hostStartLink = "/onboarding/kyc/start?role=host";
  const partnerStartLink = "/onboarding/kyc/start?role=partner";

  // Optional: show a slightly smarter placeholder based on typical searches
  const locPlaceholder = useMemo(
    () => "City or area (e.g. Lagos, Abuja, Ikoyi, Wuse, Lekki)",
    []
  );

  function buildSearchQueryString({ text, min, max, forceCity = false } = {}) {
    const qs = new URLSearchParams();

    const t = String(text || "").trim();
    const minV = digitsOnly(min).trim();
    const maxV = digitsOnly(max).trim();

    if (t) {
      // Always include q so SearchBrowse can match title/area/city client-side
      qs.set("q", t);

      // Only include exact city filter when it is truly a city
      if (forceCity || isKnownCityIntent(t)) {
        qs.set("city", t);
      }
    }

    if (minV) qs.set("min", minV);
    if (maxV) qs.set("max", maxV);

    return qs.toString();
  }

  function handleSearch(e) {
    e?.preventDefault?.();

    const queryString = buildSearchQueryString({
      text: loc,
      min: minN,
      max: maxN,
    });

    nav(`/search${queryString ? `?${queryString}` : ""}`);
  }

  function goToDestination(d) {
    const city = String(d?.query || "").trim();

    // Destinations are always cities → force city filter
    const queryString = buildSearchQueryString({
      text: city,
      min: "",
      max: "",
      forceCity: true,
    });

    nav(`/search${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <>
      {/* inline styles for this page */}
      <style>{`
        .page-wrap {
          position: relative;
          min-height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: transparent;
        }
        .page-bg {
          position: fixed;
          inset: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          z-index: -2;
        }
        .page-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at top, rgba(0,0,0,.30), rgba(0,0,0,.70));
          backdrop-filter: blur(1px);
          z-index: -1;
        }

        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 18px;
        }

        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes softRise {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hero-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          min-height: 420px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 32px 80px rgba(0,0,0,.7);
          animation: heroFadeIn .7s ease-out both;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          transform: scale(1.05);
          filter: saturate(1.05) brightness(1.18);
        }
        .hero-scrim {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(1100px 520px at 15% 15%, rgba(9,12,20,.30), rgba(3,5,10,.60)),
            linear-gradient(135deg, rgba(3,5,10,.45) 0%, rgba(3,5,10,.70) 60%, rgba(3,5,10,.80) 100%);
        }

        .hero-body {
          position: relative;
          z-index: 2;
          padding: 56px 36px 34px;
          display: grid;
          gap: 26px;
          text-align: center;
        }
        .hero-kicker {
          opacity: 0.9;
          font-weight: 800;
          letter-spacing: 0.26em;
          font-size: 11px;
          color: #c9d4ea;
          text-transform: uppercase;
          animation: softRise .6s ease-out .02s both;
        }
        .hero-title {
          margin: 0;
          font-family: 'Playfair Display', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif;
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: 0.4px;
          font-size: 40px;
          color: #f7f4ec;
          animation: softRise .6s ease-out .08s both;
        }
        .hero-sub {
          margin: 8px auto 0;
          color: #cbd3e3;
          max-width: 720px;
          font-size: 17px;
          line-height: 1.6;
          animation: softRise .6s ease-out .14s both;
        }

        .cta-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          animation: softRise .6s ease-out .2s both;
        }
        .btn-gold {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 14px;
          color: #211a07;
          border: 1px solid rgba(255,210,64,.72);
          background: linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.06),
            0 14px 36px rgba(0,0,0,.70);
          transition: filter .15s ease, transform .04s ease, box-shadow .15s ease;
          text-decoration: none;
        }
        .btn-gold:hover {
          filter: brightness(1.04);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.12),
            0 18px 42px rgba(0,0,0,.8);
        }
        .btn-gold:active {
          transform: translateY(1px);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.1),
            0 10px 26px rgba(0,0,0,.65);
        }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 14px;
          border: 1px solid rgba(255,255,255,.20);
          background: rgba(0,0,0,.45);
          color: #e7ecf7;
          text-decoration: none;
          backdrop-filter: blur(6px);
          transition: background .18s ease, border-color .18s ease, transform .04s ease;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,.04);
          border-color: rgba(255,255,255,.34);
        }
        .btn-ghost:active { transform: translateY(1px); }

        .search-shell {
          margin-top: 4px;
          padding: 10px 10px 12px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.10);
          background: radial-gradient(circle at top left, rgba(255,255,255,.06), rgba(0,0,0,.82));
          backdrop-filter: blur(10px);
          animation: softRise .6s ease-out .26s both;
        }
        .search-row {
          display: grid;
          grid-template-columns: 1.2fr .6fr .6fr auto;
          gap: 10px;
          align-items: center;
          width: 100%;
        }
        .pill {
          height: 46px;
          border-radius: 14px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(0,0,0,.55);
          color: #eef2ff;
          outline: none;
          font-size: 14px;
        }
        .pill::placeholder { color: #96a0b4; }

        .section-title {
          font-family: 'Playfair Display', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif;
          font-size: 22px;
          font-weight: 600;
          color: #f5f2ea;
          margin: 0 0 14px;
        }
        .section-sub {
          color: #a8b0c4;
          font-size: 14px;
          margin: 0 0 18px;
        }

        .dest-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }
        .dest-card {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.14);
          cursor: pointer;
          min-height: 210px;
          background: rgba(5,7,13,.96);
          box-shadow: 0 18px 42px rgba(0,0,0,.7);
          transform: translateY(0);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease;
        }
        .dest-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 26px 60px rgba(0,0,0,.85);
          border-color: rgba(255,255,255,.25);
          background: rgba(5,7,13,.9);
        }
        .dest-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.08) brightness(1.05);
          transform: scale(1.02);
          transition: transform .45s ease;
        }
        .dest-card:hover .dest-img { transform: scale(1.06); }
        .dest-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.12) 60%),
            radial-gradient(circle at top left, rgba(255,255,255,.06), transparent 60%);
        }
        .dest-body {
          position: absolute;
          inset: auto 16px 16px 16px;
          color: #f9f5ea;
        }
        .dest-name {
          font-family: 'Playfair Display', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .dest-tagline { font-size: 13px; color: #d3d9e9; }

        .host-cta {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 16px;
          align-items: center;
          border: 1px solid rgba(255,255,255,.14);
          background: radial-gradient(circle at top left, rgba(255,255,255,.07), rgba(0,0,0,.82));
          border-radius: 22px;
          padding: 22px;
          overflow: hidden;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
        }
        .host-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 22px 52px rgba(0,0,0,.8);
          border-color: rgba(255,255,255,.22);
          background: radial-gradient(circle at top left, rgba(255,255,255,.1), rgba(0,0,0,.84));
        }
        .host-img {
          width: 100%;
          height: 280px;
          object-fit: cover;
          border-radius: 16px;
        }

        @media (max-width: 900px) {
          .hero-body { padding: 40px 18px 26px; }
          .hero-title { font-size: 30px; }
          .hero-sub { font-size: 15px; }
          .search-row { grid-template-columns: 1fr; }
          .search-shell { padding: 10px; }
          .host-cta { grid-template-columns: 1fr; }
          .host-img { height: 220px; }
        }

        @media (max-width: 640px) {
          .hero-body { padding: 32px 16px 22px; }
          .hero-title { font-size: 26px; line-height: 1.15; }
          .hero-sub { font-size: 14px; max-width: 100%; }
          .cta-row { flex-direction: column; align-items: stretch; gap: 10px; }
          .btn-gold, .btn-ghost { width: 100%; justify-content: center; }
          .section-title { font-size: 20px; }
          .section-sub { font-size: 13px; }
          .dest-grid { grid-template-columns: 1fr; }
          .host-img { height: 200px; }
        }
      `}</style>

      <div className="page-wrap">
        <div className="page-bg" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="page-overlay" />

        {/* ───────── Hero ───────── */}
        <section className="container" style={{ marginTop: 18 }}>
          <div className="hero-wrap">
            <div className="hero-bg" style={{ backgroundImage: `url(${heroBg})` }} />
            <div className="hero-scrim" />
            <div className="hero-body">
              <div className="hero-kicker">NESTA • SIGNATURE STAYS</div>

              <h1 className="hero-title">
                Premium stays. Trusted homes.
                <br />
                Across Nigeria.
              </h1>

              <p className="hero-sub">
                Thoughtfully curated apartments, villas and city homes in Nigeria’s most desirable
                neighbourhoods — with verified hosts, secure local payments and concierge-style support.
              </p>

              <div className="cta-row">
                {hasDashboardRole ? (
                  <>
                    {isHost && (
                      <Link to="/host" className="btn-gold">
                        Go to host dashboard
                      </Link>
                    )}
                    {isPartner && (
                      <Link to="/partner" className="btn-gold">
                        Go to partner dashboard
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" className="btn-gold">
                        Go to admin console
                      </Link>
                    )}
                    <Link to="/explore" className="btn-ghost">
                      Explore stays
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/explore" className="btn-gold">
                      Explore stays
                    </Link>
                    <Link to={hostStartLink} className="btn-ghost">
                      List your home
                    </Link>
                  </>
                )}
              </div>

              {/* Luxury-styled search shell */}
              <div className="search-shell">
                <form className="search-row" onSubmit={handleSearch}>
                  <input
                    className="pill"
                    placeholder={locPlaceholder}
                    value={loc}
                    onChange={(e) => setLoc(e.target.value)}
                  />
                  <input
                    className="pill"
                    placeholder="Min ₦/night"
                    inputMode="numeric"
                    value={minN}
                    onChange={(e) => setMinN(e.target.value)}
                  />
                  <input
                    className="pill"
                    placeholder="Max ₦/night"
                    inputMode="numeric"
                    value={maxN}
                    onChange={(e) => setMaxN(e.target.value)}
                  />
                  <button type="submit" className="btn-gold">
                    Search
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Featured stays (carousel) ───────── */}
        <section className="container" style={section(32)}>
          <h2 className="section-title">Featured stays</h2>
          <p className="section-sub">
            Sponsored homes that highlight the Nesta standard — design-led, professionally cleaned and ready when you arrive.
          </p>
          <FeaturedCarousel />
        </section>

        {/* ───────── Signature destinations ───────── */}
        <section className="container" style={section(28)}>
          <h2 className="section-title">Signature destinations</h2>
          <p className="section-sub">
            Business trips, relocations or weekend escapes — start with Nigeria’s most requested neighbourhoods.
          </p>
          <div className="dest-grid">
            {destinations.map((d) => (
              <button key={d.id} type="button" className="dest-card" onClick={() => goToDestination(d)}>
                <img src={d.img} alt={d.name} className="dest-img" />
                <div className="dest-overlay" />
                <div className="dest-body">
                  <div className="dest-name">{d.name}</div>
                  <div className="dest-tagline">{d.tagline}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ───────── Host CTA ───────── */}
        <section className="container" style={section(32)}>
          <div className="host-cta">
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                Start your hosting journey
              </h3>
              <p style={{ color: "#c9d2e3", marginTop: 8, fontSize: 14 }}>
                Turn your space into a premium stay with verified guests, pro photography and dedicated Nesta host support.
              </p>

              {isHost ? (
                <Link to="/host" className="btn-gold" style={{ marginTop: 10 }}>
                  Go to host dashboard
                </Link>
              ) : (
                <Link to={hostStartLink} className="btn-gold" style={{ marginTop: 10 }}>
                  Start host application
                </Link>
              )}
            </div>

            <img
              className="host-img"
              alt="Elegant bedroom interior"
              src="https://images.unsplash.com/photo-1505691723518-36a5ac3be353?q=80&w=1400&auto=format&fit=crop"
            />
          </div>
        </section>

        {/* ───────── Partner CTA ───────── */}
        <section className="container" style={section(22)}>
          <div className="host-cta">
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                Scale as a Verified Partner
              </h3>
              <p style={{ color: "#c9d2e3", marginTop: 8, fontSize: 14 }}>
                Grow premium portfolios with unified commission tracking, payouts and performance analytics — all in one calm Nesta dashboard.
              </p>

              {isPartner ? (
                <Link to="/partner" className="btn-gold" style={{ marginTop: 10 }}>
                  Go to partner dashboard
                </Link>
              ) : (
                <Link to={partnerStartLink} className="btn-gold" style={{ marginTop: 10 }}>
                  Start partner application
                </Link>
              )}
            </div>

            <img
              className="host-img"
              alt="Contemporary living space"
              src="https://images.unsplash.com/photo-1527030280862-64139fba04ca?auto=format&fit=crop&w=1400&q=80"
            />
          </div>
        </section>
      </div>
    </>
  );
}
