// src/pages/HomePage.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import FeaturedCarousel from "../components/FeaturedCarousel";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const HERO_BG = "/hero.jpg";

const destinations = [
  {
    id: "lagos",
    name: "Lagos",
    tagline: "Ikoyi · Lekki · Victoria Island",
    query: "Lagos",
    img: "https://images.unsplash.com/photo-1601471470116-8b26afe6a4ef?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "abuja",
    name: "Abuja",
    tagline: "Maitama · Asokoro · Wuse II",
    query: "Abuja",
    img: "https://images.unsplash.com/photo-1591105575639-41474f0ce40c?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "ph",
    name: "Port Harcourt",
    tagline: "GRA · Trans-Amadi · Waterfront",
    query: "Port Harcourt",
    img: "https://images.unsplash.com/photo-1540427969750-1424b7c42e3c?q=80&w=1600&auto=format&fit=crop",
  },
];

const TRUST_POINTS = [
  { icon: "✦", label: "Verified hosts", sub: "Every host KYC-screened" },
  { icon: "◈", label: "Secure payments", sub: "Paystack & Flutterwave" },
  { icon: "◇", label: "Concierge support", sub: "Real humans, always on" },
  { icon: "◉", label: "CBN-compliant", sub: "Funds held in escrow" },
];

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";
  return r;
}

function digitsOnly(v) {
  return String(v || "").replace(/[^\d]/g, "");
}

function isKnownCityIntent(input) {
  const k = String(input || "").trim().replace(/\s+/g, " ").toLowerCase();
  const known = new Set(["lagos","abuja","abuja fct","abuja, fct","fct","f.c.t","port harcourt","port-harcourt","portharcourt"]);
  return known.has(k);
}

/* ── Animated counter ── */
function Counter({ to, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = Math.ceil(to / 60);
        const t = setInterval(() => {
          start = Math.min(start + step, to);
          setVal(start);
          if (start >= to) clearInterval(t);
        }, 16);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function HomePage() {
  const nav = useNavigate();
  const [loc, setLoc] = useState("");
  const [minN, setMinN] = useState("");
  const [maxN, setMaxN] = useState("");

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin    = profile?.isAdmin === true || role === "admin";
  const isHost     = role === "host";
  const isPartner  = role === "partner";
  const hasDashboardRole = isHost || isPartner || isAdmin;

  const hostStartLink    = "/onboarding/kyc/start?role=host";
  const partnerStartLink = "/onboarding/kyc/start?role=partner";

  function buildQS({ text, min, max, forceCity = false } = {}) {
    const qs = new URLSearchParams();
    const t = String(text || "").trim();
    if (t) {
      qs.set("q", t);
      if (forceCity || isKnownCityIntent(t)) qs.set("city", t);
    }
    const minV = digitsOnly(min);
    const maxV = digitsOnly(max);
    if (minV) qs.set("min", minV);
    if (maxV) qs.set("max", maxV);
    return qs.toString();
  }

  function handleSearch(e) {
    e?.preventDefault?.();
    const qs = buildQS({ text: loc, min: minN, max: maxN });
    nav(`/search${qs ? `?${qs}` : ""}`);
  }

  function goToDestination(d) {
    const qs = buildQS({ text: d?.query || "", forceCity: true });
    nav(`/search${qs ? `?${qs}` : ""}`);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        :root {
          --gold: #c9a84c;
          --gold-light: #e8c96b;
          --gold-dim: rgba(201,168,76,0.18);
          --ink: #05070a;
        }

        .hp-wrap {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: var(--ink);
          color: #fff;
          min-height: 100vh;
        }

        /* ── HERO ── */
        .hero-section {
          position: relative;
          min-height: calc(100vh - 64px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 24px 56px;
          overflow: hidden;
        }
        .hero-photo {
          position: absolute;
          inset: 0;
          background-position: center 30%;
          background-size: cover;
          background-repeat: no-repeat;
          transform: scale(1.04);
          filter: brightness(1.06) saturate(1.05);
        }
        .hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, rgba(5,7,10,1) 0%, rgba(5,7,10,0.65) 38%, rgba(5,7,10,0.10) 70%, rgba(5,7,10,0.02) 100%),
            radial-gradient(ellipse 100% 60% at 60% 100%, rgba(201,168,76,0.07), transparent 70%);
        }
        .hero-body {
          position: relative;
          z-index: 2;
          max-width: 820px;
        }
        .hero-kicker {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          color: var(--gold-light);
          opacity: 0.85;
          margin-bottom: 20px;
          animation: fadeUp 0.7s ease-out both;
        }
        .hero-h1 {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(46px, 7vw, 88px);
          font-weight: 600;
          line-height: 1.02;
          letter-spacing: -0.01em;
          color: #f5f0e8;
          margin: 0 0 22px;
          animation: fadeUp 0.7s ease-out 0.08s both;
        }
        .hero-h1 em {
          font-style: italic;
          color: var(--gold-light);
        }
        .hero-sub {
          font-size: 17px;
          font-weight: 300;
          line-height: 1.65;
          color: rgba(255,255,255,0.62);
          max-width: 560px;
          margin-bottom: 32px;
          animation: fadeUp 0.7s ease-out 0.16s both;
        }
        .hero-ctas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 32px;
          animation: fadeUp 0.7s ease-out 0.22s both;
        }
        .btn-gold {
          display: inline-flex;
          align-items: center;
          height: 50px;
          padding: 0 26px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: #120d02;
          background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 60%, #b8922e 100%);
          border: none;
          text-decoration: none;
          box-shadow: 0 8px 32px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.4);
          transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
          cursor: pointer;
        }
        .btn-gold:hover {
          filter: brightness(1.07);
          box-shadow: 0 12px 40px rgba(201,168,76,0.45), 0 4px 12px rgba(0,0,0,0.5);
          transform: translateY(-1px);
        }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          height: 50px;
          padding: 0 26px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.18);
          text-decoration: none;
          backdrop-filter: blur(8px);
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.30);
          transform: translateY(-1px);
        }

        /* ── SEARCH BAR ── */
        .search-shell {
          background: rgba(10,12,18,0.72);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 20px;
          padding: 10px 12px;
          backdrop-filter: blur(16px);
          animation: fadeUp 0.7s ease-out 0.3s both;
        }
        .search-grid {
          display: grid;
          grid-template-columns: 1.3fr 0.65fr 0.65fr auto;
          gap: 8px;
          align-items: center;
        }
        .search-field {
          height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-size: 14px;
          padding: 0 16px;
          outline: none;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.15s;
        }
        .search-field:focus { border-color: rgba(201,168,76,0.45); }
        .search-field::placeholder { color: rgba(255,255,255,0.35); }

        /* ── SECTIONS ── */
        .hp-section {
          padding: 72px 24px;
          max-width: 1180px;
          margin: 0 auto;
        }
        .section-eyebrow {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 10px;
        }
        .section-h2 {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(30px, 4vw, 44px);
          font-weight: 600;
          color: #f5f0e8;
          margin: 0 0 10px;
          line-height: 1.1;
        }
        .section-sub {
          font-size: 15px;
          font-weight: 300;
          color: rgba(255,255,255,0.5);
          max-width: 520px;
          line-height: 1.65;
          margin-bottom: 40px;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 20%, rgba(255,255,255,0.07) 80%, transparent);
          margin: 0;
        }

        /* ── DESTINATIONS ── */
        .dest-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .dest-card {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.10);
          cursor: pointer;
          min-height: 260px;
          background: #0a0c10;
          box-shadow: 0 20px 50px rgba(0,0,0,0.7);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .dest-card:hover {
          transform: translateY(-8px) scale(1.01);
          box-shadow: 0 32px 70px rgba(0,0,0,0.85);
          border-color: rgba(201,168,76,0.35);
        }
        .dest-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: brightness(0.9) saturate(1.1);
          transition: transform 0.5s ease, filter 0.3s ease;
        }
        .dest-card:hover .dest-img {
          transform: scale(1.07);
          filter: brightness(1.0) saturate(1.15);
        }
        .dest-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(5,7,10,0.88) 0%, rgba(5,7,10,0.20) 55%, transparent 100%);
        }
        .dest-body {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px;
        }
        .dest-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 24px;
          font-weight: 600;
          color: #f5f0e8;
          margin-bottom: 4px;
          line-height: 1.1;
        }
        .dest-tag {
          font-size: 12px;
          font-weight: 400;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.03em;
        }

        /* ── TRUST STRIP ── */
        .trust-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 22px;
          overflow: hidden;
        }
        .trust-item {
          padding: 28px 24px;
          background: rgba(10,12,18,0.95);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .trust-icon {
          font-size: 20px;
          color: var(--gold);
          line-height: 1;
        }
        .trust-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }
        .trust-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
        }

        /* ── STATS ── */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 40px;
        }
        .stat-card {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px 24px;
          background: radial-gradient(ellipse at top left, rgba(201,168,76,0.06), transparent 60%), rgba(255,255,255,0.02);
          text-align: center;
        }
        .stat-number {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 52px;
          font-weight: 600;
          color: var(--gold-light);
          line-height: 1;
          margin-bottom: 8px;
        }
        .stat-label {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          font-weight: 300;
          letter-spacing: 0.04em;
        }

        /* ── HOST/PARTNER CTA CARDS ── */
        .cta-duo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cta-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(10,12,18,0.9);
          padding: 36px 32px;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .cta-card:hover {
          border-color: rgba(201,168,76,0.25);
          transform: translateY(-4px);
          box-shadow: 0 28px 60px rgba(0,0,0,0.7);
        }
        .cta-bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.12;
          transition: opacity 0.3s;
        }
        .cta-card:hover .cta-bg-img { opacity: 0.18; }
        .cta-inner {
          position: relative;
          z-index: 1;
        }
        .cta-tag {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--gold);
          border: 1px solid rgba(201,168,76,0.28);
          border-radius: 999px;
          padding: 4px 12px;
          margin-bottom: 18px;
        }
        .cta-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px;
          font-weight: 600;
          color: #f5f0e8;
          line-height: 1.15;
          margin-bottom: 14px;
        }
        .cta-body {
          font-size: 14px;
          font-weight: 300;
          color: rgba(255,255,255,0.55);
          line-height: 1.65;
          margin-bottom: 28px;
        }

        /* ── ANIMATIONS ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 960px) {
          .search-grid { grid-template-columns: 1fr; }
          .dest-grid { grid-template-columns: 1fr 1fr; }
          .dest-card:last-child { grid-column: 1/-1; }
          .trust-strip { grid-template-columns: 1fr 1fr; }
          .stats-row { grid-template-columns: 1fr 1fr; }
          .stats-row > *:last-child { grid-column: 1/-1; }
          .cta-duo { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .hero-section { padding: 0 16px 44px; }
          .hero-h1 { font-size: 40px; }
          .hero-sub { font-size: 15px; }
          .hp-section { padding: 52px 16px; }
          .dest-grid { grid-template-columns: 1fr; }
          .dest-card { min-height: 220px; }
          .trust-strip { grid-template-columns: 1fr 1fr; }
          .stats-row { grid-template-columns: 1fr; }
          .cta-card { padding: 28px 22px; }
          .cta-title { font-size: 26px; }
        }
      `}</style>

      <div className="hp-wrap">

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="hero-section">
          <div className="hero-photo" style={{ backgroundImage: `url(${HERO_BG})` }} />
          <div className="hero-scrim" />

          <div className="hero-body">
            <div className="hero-kicker">NestaNg · Premium Short-Let Marketplace</div>

            <h1 className="hero-h1">
              Nigeria's finest<br />
              <em>short-let stays</em>,<br />
              verified.
            </h1>

            <p className="hero-sub">
              Curated apartments, penthouses and villas across Lagos, Abuja and beyond —
              with KYC-verified hosts, escrow-backed payments and concierge support.
            </p>

            <div className="hero-ctas">
              {hasDashboardRole ? (
                <>
                  {isHost    && <Link to="/host"    className="btn-gold">Host dashboard</Link>}
                  {isPartner && <Link to="/partner" className="btn-gold">Partner dashboard</Link>}
                  {isAdmin   && <Link to="/admin"   className="btn-gold">Admin console</Link>}
                  <Link to="/explore" className="btn-ghost">Browse stays</Link>
                </>
              ) : (
                <>
                  <Link to="/explore" className="btn-gold">Browse verified stays</Link>
                  <Link to={hostStartLink} className="btn-ghost">List your property</Link>
                </>
              )}
            </div>

            {/* Search bar */}
            <div className="search-shell">
              <form className="search-grid" onSubmit={handleSearch}>
                <input
                  className="search-field"
                  placeholder="City or area — Lagos, Ikoyi, Wuse II, Maitama…"
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                />
                <input
                  className="search-field"
                  placeholder="Min ₦/night"
                  inputMode="numeric"
                  value={minN}
                  onChange={(e) => setMinN(e.target.value)}
                />
                <input
                  className="search-field"
                  placeholder="Max ₦/night"
                  inputMode="numeric"
                  value={maxN}
                  onChange={(e) => setMaxN(e.target.value)}
                />
                <button type="submit" className="btn-gold" style={{ whiteSpace: "nowrap", padding: "0 22px" }}>
                  Search
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ═══════════════ TRUST STRIP ═══════════════ */}
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <div className="trust-strip">
            {TRUST_POINTS.map((t) => (
              <div key={t.label} className="trust-item">
                <div className="trust-icon">{t.icon}</div>
                <div className="trust-label">{t.label}</div>
                <div className="trust-sub">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════ FEATURED STAYS ═══════════════ */}
        <div className="divider" style={{ margin: "0 24px" }} />
        <section className="hp-section">
          <div className="section-eyebrow">Curated</div>
          <h2 className="section-h2">Featured stays</h2>
          <p className="section-sub">
            A handpicked selection of NestaNg's most requested properties —
            professionally managed, photographed and inspected.
          </p>
          <FeaturedCarousel fallbackMode="latest" limit={8} hideEmptyState />
        </section>

        {/* ═══════════════ DESTINATIONS ═══════════════ */}
        <div className="divider" style={{ margin: "0 24px" }} />
        <section className="hp-section" style={{ paddingTop: 56 }}>
          <div className="section-eyebrow">Explore by city</div>
          <h2 className="section-h2">Signature destinations</h2>
          <p className="section-sub">
            Business travel, relocations, weekend escapes — Nigeria's most requested
            neighbourhoods at your fingertips.
          </p>

          <div className="dest-grid">
            {destinations.map((d) => (
              <button
                key={d.id}
                type="button"
                className="dest-card"
                onClick={() => goToDestination(d)}
                aria-label={`Browse stays in ${d.name}`}
              >
                <img src={d.img} alt={d.name} className="dest-img" />
                <div className="dest-overlay" />
                <div className="dest-body">
                  <div className="dest-name">{d.name}</div>
                  <div className="dest-tag">{d.tagline}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ═══════════════ STATS ═══════════════ */}
        <div className="divider" style={{ margin: "0 24px" }} />
        <section className="hp-section" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="section-eyebrow">By the numbers</div>
          <h2 className="section-h2">Built for Nigeria's best</h2>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-number"><Counter to={500} suffix="+" /></div>
              <div className="stat-label">Verified properties</div>
            </div>
            <div className="stat-card">
              <div className="stat-number"><Counter to={12} /></div>
              <div className="stat-label">Cities covered</div>
            </div>
            <div className="stat-card">
              <div className="stat-number"><Counter to={2400} suffix="+" /></div>
              <div className="stat-label">Stays completed</div>
            </div>
          </div>
        </section>

        {/* ═══════════════ HOST + PARTNER CTAs ═══════════════ */}
        <div className="divider" style={{ margin: "0 24px" }} />
        <section className="hp-section" style={{ paddingTop: 56 }}>
          <div className="section-eyebrow">Earn with NestaNg</div>
          <h2 className="section-h2">List your space</h2>
          <p className="section-sub">
            Whether you own one property or manage a portfolio — NestaNg gives you
            the tools, the audience and the payment infrastructure to grow.
          </p>

          <div className="cta-duo">
            {/* Host card */}
            <div className="cta-card">
              <img
                className="cta-bg-img"
                src="https://images.unsplash.com/photo-1560184897-ae75f418493e?q=80&w=1400&auto=format&fit=crop"
                alt=""
                aria-hidden="true"
              />
              <div className="cta-inner">
                <div className="cta-tag">Individual Host</div>
                <h3 className="cta-title">Turn your home into premium income</h3>
                <p className="cta-body">
                  List a single apartment or villa. NestaNg handles verified guest screening,
                  secure payments and concierge support — you focus on the hospitality.
                </p>
                {isHost ? (
                  <Link to="/host" className="btn-gold">Go to host dashboard</Link>
                ) : (
                  <Link to={hostStartLink} className="btn-gold">Start host application</Link>
                )}
              </div>
            </div>

            {/* Partner card */}
            <div className="cta-card">
              <img
                className="cta-bg-img"
                src="https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1400&auto=format&fit=crop"
                alt=""
                aria-hidden="true"
              />
              <div className="cta-inner">
                <div className="cta-tag">Verified Partner</div>
                <h3 className="cta-title">Scale a portfolio with one dashboard</h3>
                <p className="cta-body">
                  Property managers and hospitality operators get unified commission tracking,
                  multi-listing management and performance analytics — all in one calm dashboard.
                </p>
                {isPartner ? (
                  <Link to="/partner" className="btn-gold">Go to partner dashboard</Link>
                ) : (
                  <Link to={partnerStartLink} className="btn-gold">Apply as a partner</Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ BOTTOM CTA STRIP ═══════════════ */}
        <section style={{ padding: "56px 24px 80px", maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,168,76,0.10), transparent 70%), rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 28,
            padding: "52px 32px",
          }}>
            <div className="section-eyebrow" style={{ textAlign: "center" }}>Ready?</div>
            <h2 className="section-h2" style={{ textAlign: "center", margin: "0 auto 16px", maxWidth: 500 }}>
              Find your next<br /><em style={{ fontStyle: "italic", color: "var(--gold-light)" }}>perfect stay</em>
            </h2>
            <p style={{ fontSize: 15, fontWeight: 300, color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>
              Browse hundreds of verified, premium short-lets across Nigeria.
            </p>
            <Link to="/explore" className="btn-gold" style={{ fontSize: 15, height: 54, padding: "0 36px" }}>
              Explore all stays →
            </Link>
          </div>
        </section>

      </div>
    </>
  );
}