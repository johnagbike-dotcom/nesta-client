// src/pages/HomePage.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FeaturedCarousel from "../components/FeaturedCarousel";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

/* ---------- page constants ---------- */

// Use your own hero image from /public.
// React will serve /hero.jpg from the public folder.
const HERO_BG = "/hero.jpg";
const HERO_BG_FALLBACK = "/hero.png"; // optional fallback if you ever swap files

const quickSpots = [
  "Ikoyi",
  "Lekki",
  "VI",
  "Gwarinpa",
  "Wuse 2",
  "Asokoro",
  "Makurdi",
  "Enugu",
  "Port Harcourt",
];

const trustBullets = [
  { k: "Trust", title: "BVN/NIN verified hosts", sub: "Identity & quality checks." },
  { k: "Payments", title: "Seamless checkout", sub: "Paystack" },
  { k: "Concierge", title: "On-call support", sub: "Assistance throughout your stay." },
];

const chip = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    height: 40,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.20)",
    color: "#e6ebf4",
    background: "rgba(0,0,0,.40)",
    fontWeight: 800,
    letterSpacing: 0.2,
    backdropFilter: "blur(6px)",
    cursor: "pointer",
  },
};

const section = (mt = 28) => ({
  marginTop: mt,
  padding: "28px 0",
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
  const isGuest = !user || role === "guest";

  const heroBg = HERO_BG || HERO_BG_FALLBACK;

  function handleSearch(e) {
    e?.preventDefault?.();
    const qs = new URLSearchParams();
    if (loc.trim()) qs.set("loc", loc.trim());
    if (minN.trim()) qs.set("min", minN.trim());
    if (maxN.trim()) qs.set("max", maxN.trim());
    nav(`/explore${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  return (
    <>
      {/* inline styles for this page */}
      <style>{`
        .page-wrap {
          position: relative;
          min-height: 100vh;
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
          background: rgba(0, 0, 0, 0.65); /* overall darkness / transparency */
          backdrop-filter: blur(2px);
          z-index: -1;
        }

        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 18px;
        }

        .hero-wrap {
          position:relative;
          overflow:hidden;
          border-radius:24px;
          min-height: 420px;
          /* lighter transparent card so the estate photo is visible */
          background:rgba(0,0,0,0.25);
          border:1px solid rgba(255,255,255,0.06);
        }

        .hero-bg {
          position:absolute;
          inset:0;
          background-position:center;
          background-size:cover;
          background-repeat:no-repeat;
          transform:scale(1.03);
          filter: saturate(1.1) brightness(1.02);
        }
        .hero-scrim{
          position:absolute;
          inset:0;
          background:
            radial-gradient(1100px 500px at 15% 15%, rgba(15,18,28,.55), rgba(5,7,12,.80)),
            linear-gradient(135deg, rgba(3,5,10,.85) 0%, rgba(3,5,10,.94) 60%, rgba(3,5,10,.98) 100%);
        }

        .hero-body{
          position:relative;
          z-index:2;
          padding:56px 28px 30px;
          display:grid;
          gap:22px;
        }
        .hero-title{
          font-weight:900;
          line-height:1.06;
          letter-spacing:.2px;
          margin:0;
          font-size:38px;
        }
        .hero-sub{
          margin:6px 0 10px;
          color:#cbd3e3;
          max-width:920px;
          font-size:18px;
          line-height:1.6;
        }
        .search-row{
          display:grid;
          grid-template-columns:1.2fr .6fr .6fr auto;
          gap:12px;
          align-items:center;
          width:100%;
        }
        .pill{
          height:50px;
          border-radius:14px;
          padding:0 14px;
          border:1px solid rgba(255,255,255,.18);
          background:rgba(0,0,0,.50);
          color:#eef2ff;
          outline:none;
        }
        .pill::placeholder{ color:#96a0b4; }
        .btn-gold{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:50px;
          padding:0 18px;
          border-radius:14px;
          font-weight:900;
          color:#211a07;
          border:1px solid rgba(255,210,64,.7);
          background:linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.06),
            0 14px 40px rgba(0,0,0,.65);
          transition: filter .15s ease, transform .04s ease;
        }
        .btn-gold:active{ transform: translateY(1px); }
        .cta-row{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .trust-band{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
          gap:12px;
        }
        .trust-card{
          border:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.45);
          border-radius:18px;
          padding:16px 16px 14px;
        }
        .trust-k{
          display:inline-flex;
          align-items:center;
          height:28px;
          padding:0 10px;
          border-radius:999px;
          font-weight:800;
          background:rgba(255,210,64,.14);
          color:#ffd84a;
          border:1px solid rgba(255,210,64,.35);
        }
        .quote-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
          gap:12px;
        }
        .quote{
          border:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.5);
          border-radius:16px;
          padding:18px;
          color:#dfe5f3;
        }
        .host-cta{
          display:grid;
          grid-template-columns:1.1fr .9fr;
          gap:16px;
          align-items:center;
          border:1px solid rgba(255,255,255,.12);
          background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.45));
          border-radius:22px;
          padding:22px;
          overflow:hidden;
        }
        .host-img{
          width:100%;
          height:300px;
          object-fit:cover;
          border-radius:16px;
        }
        @media (max-width: 900px){
          .hero-body{
            padding:42px 16px 20px;
          }
          .hero-title{
            font-size:30px;
          }
          .search-row{
            grid-template-columns:1fr;
          }
          .host-cta{
            grid-template-columns:1fr;
          }
          .host-img{
            height:220px;
          }
        }
      `}</style>

      <div className="page-wrap">
        {/* Full-page background image + transparent overlay */}
        <div
          className="page-bg"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="page-overlay" />

        {/* ───────── Hero ───────── */}
        <section className="container" style={{ marginTop: 16 }}>
          <div className="hero-wrap">
            <div
              className="hero-bg"
              style={{ backgroundImage: `url(${heroBg})` }}
            />
            <div className="hero-scrim" />
            <div className="hero-body">
              <div
                style={{
                  opacity: 0.9,
                  fontWeight: 900,
                  letterSpacing: 2,
                  color: "#c9d4ea",
                }}
              >
                NESTA • SIGNATURE STAYS
              </div>

              <h1 className="hero-title text-center">
                Premium stays. Trusted homes.
                <br /> Across Nigeria.
              </h1>

              <p className="hero-sub text-center">
                Discover luxury short stays, long lets, and verified homes.
                Curated listings, exceptional comfort, and concierge-level care —
                the home experience you deserve.
              </p>

              {/* Role-aware CTA row */}
              <div className="cta-row">
                {/* Everyone can explore listings */}
                <Link to="/explore" className="btn-gold">
                  Explore listings
                </Link>

                {isGuest && (
                  <>
                    <Link
                      to="/onboarding/kyc/apply"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      Become a host
                    </Link>
                    <Link
                      to="/onboarding/kyc/apply?role=partner"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      Verified partner
                    </Link>
                  </>
                )}

                {isHost && (
                  <>
                    <Link
                      to="/host"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      Host dashboard
                    </Link>
                    <Link
                      to="/manage-listings"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      Manage listings
                    </Link>
                  </>
                )}

                {isPartner && (
                  <>
                    <Link
                      to="/partner"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      Partner dashboard
                    </Link>
                    <Link
                      to="/manage-listings"
                      className="btn-gold"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#e7ecf7",
                        borderColor: "rgba(255,255,255,.18)",
                      }}
                    >
                      My portfolio
                    </Link>
                  </>
                )}

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="btn-gold"
                    style={{
                      background: "rgba(255,255,255,.06)",
                      color: "#e7ecf7",
                      borderColor: "rgba(255,255,255,.18)",
                    }}
                  >
                    Admin
                  </Link>
                )}
              </div>

              {/* Search */}
              <form className="search-row" onSubmit={handleSearch}>
                <input
                  className="pill"
                  placeholder="Area, city or landmark (e.g., Lekki, Ikoyi)"
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

              {/* Quick chips */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {quickSpots.map((c) => (
                  <button
                    key={c}
                    style={chip.base}
                    onClick={() => {
                      setLoc(c);
                      setTimeout(handleSearch, 0);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust band */}
        <section className="container" style={section(24)}>
          <div className="trust-band">
            {trustBullets.map((b) => (
              <div className="trust-card" key={b.k}>
                <div className="trust-k">{b.k}</div>
                <h3
                  style={{
                    margin: "10px 0 6px",
                    fontSize: 20,
                    fontWeight: 900,
                  }}
                >
                  {b.title}
                </h3>
                <div style={{ color: "#bfc7d8" }}>{b.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Sponsored */}
        <section className="container" style={section(12)}>
          <div
            style={{
              color: "#aab3c4",
              marginBottom: 10,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            Sponsored
          </div>
          <FeaturedCarousel />
        </section>

        {/* Testimonials */}
        <section className="container" style={section(18)}>
          <div className="quote-grid">
            {[
              {
                t: "“Flawless experience. The home looked exactly like the photos.”",
                a: "Chidera • Lagos",
              },
              {
                t: "“Concierge handled dinner plans last-minute. That’s luxury.”",
                a: "Kene • Abuja",
              },
              {
                t: "“Quiet, spotless, secure. Will book again.”",
                a: "Tola • London",
              },
            ].map((q) => (
              <div key={q.a} className="quote">
                <div style={{ fontSize: 18, marginBottom: 8 }}>{q.t}</div>
                <div style={{ opacity: 0.7 }}>{q.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Host CTA */}
        <section className="container" style={section(18)}>
          <div className="host-cta">
            <div>
              <h3 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                Start your hosting journey
              </h3>
              <p style={{ color: "#c9d2e3", marginTop: 8 }}>
                Earn more with verified guests, premium positioning, and dedicated
                host support.
              </p>
              {isHost ? (
                <Link to="/host" className="btn-gold" style={{ marginTop: 8 }}>
                  Go to host dashboard
                </Link>
              ) : (
                <Link
                  to="/onboarding/kyc/apply"
                  className="btn-gold"
                  style={{ marginTop: 8 }}
                >
                  Start host application
                </Link>
              )}
            </div>
            <img
              className="host-img"
              alt="Elegant bedroom interior"
              src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1400&auto=format&fit=crop"
            />
          </div>
        </section>

        {/* Partner CTA */}
        <section className="container" style={section(12)}>
          <div className="host-cta">
            <div>
              <h3 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                Scale as a Verified Partner
              </h3>
              <p style={{ color: "#c9d2e3", marginTop: 8 }}>
                Manage premium portfolios with commission tracking, payouts, and
                analytics.
              </p>
              {isPartner ? (
                <Link
                  to="/partner"
                  className="btn-gold"
                  style={{ marginTop: 8 }}
                >
                  Go to partner dashboard
                </Link>
              ) : (
                <Link
                  to="/onboarding/kyc/apply?role=partner"
                  className="btn-gold"
                  style={{ marginTop: 8 }}
                >
                  Start partner application
                </Link>
              )}
            </div>
            <img
              className="host-img"
              alt="Contemporary villa exterior"
              src="https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1400&auto=format&fit=crop"
            />
          </div>
        </section>
      </div>
    </>
  );
}
