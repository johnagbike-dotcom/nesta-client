// src/pages/AboutPage.js
import React, { useMemo } from "react";
import { Link } from "react-router-dom";

/* ——— page constants ——— */
const heroImgs = [
  "https://images.unsplash.com/photo-1505691723518-36a5ac3b2d52?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505692794403-34d4982f88aa?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1600&auto=format&fit=crop",
];

const pillars = [
  {
    k: "Curation",
    t: "Signature standards",
    d: "Every home is vetted for aesthetics, safety, and quiet comfort. We sweat the details so you can exhale.",
  },
  {
    k: "Trust",
    t: "KYC + verified hosts",
    d: "BVN/NIN checks. Transparent profiles. What you see is what you arrive to — consistently.",
  },
  {
    k: "Care",
    t: "Concierge-level support",
    d: "From airport pickups to dinner bookings — our team supports your stay end-to-end.",
  },
];

const stats = [
  { n: "97%", l: "Guest satisfaction" },
  { n: "200+", l: "Verified stays" },
  { n: "12", l: "Cities across Nigeria" },
  { n: "24/7", l: "Support coverage" },
];

export default function AboutPage() {
  const hero = useMemo(
    () => heroImgs[Math.floor(Math.random() * heroImgs.length)],
    []
  );

  return (
    <>
      <style>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 0 18px; }
        .hero { position:relative; overflow:hidden; border-radius:28px; margin-top:14px; }
        .hero-bg { position:absolute; inset:0; background:url(${hero}) center/cover no-repeat; transform:scale(1.02); }
        .hero-scrim { position:absolute; inset:0;
          background:
            radial-gradient(1200px 520px at 25% 15%, rgba(18,22,34,.6), rgba(8,10,16,.78)),
            linear-gradient(180deg, rgba(6,8,12,.80) 0%, rgba(6,8,12,.92) 100%);
        }
        .hero-body { position:relative; z-index:2; padding:58px 28px 34px; color:#e9eefc; }
        .eyebrow { letter-spacing:2px; font-weight:900; opacity:.85; color:#cbd4ea; }
        .title { font-weight:900; line-height:1.06; margin:8px 0 8px; font-size:40px; }
        .sub { color:#c3cce0; max-width:880px; font-size:18px; line-height:1.6; }

        .pillars { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; margin-top:16px; }
        .card { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:18px; padding:16px 16px 14px; }
        .key { display:inline-flex; align-items:center; height:28px; padding:0 10px; border-radius:999px; font-weight:800;
          background:rgba(255,210,64,.14); color:#ffd84a; border:1px solid rgba(255,210,64,.35); }

        .section { padding:28px 0; border-top:1px solid rgba(255,255,255,.06); margin-top:26px; }
        .grid2 { display:grid; grid-template-columns:1.05fr .95fr; gap:16px; align-items:center; }
        .img { width:100%; height:320px; object-fit:cover; border-radius:16px; border:1px solid rgba(255,255,255,.10); }
        .lead { font-size:26px; font-weight:900; margin:0; }
        .body { color:#c9d2e3; margin-top:8px; }

        .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:14px; }
        .stat { border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); border-radius:16px; padding:16px; text-align:center; }
        .num { font-size:28px; font-weight:900; color:#fff; }
        .lab { color:#aeb8cc; font-size:12px; margin-top:4px; }

        .links-row { display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:center; padding:18px; 
          border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); border-radius:14px; }
        .link { color:#e6ebf4; text-decoration:none; padding:6px 10px; border-radius:10px; }
        .link:hover { text-decoration:underline; text-underline-offset:4px; color:#fff; }

        .cta { display:grid; grid-template-columns:1.2fr .8fr; gap:16px; align-items:center; 
          border:1px solid rgba(255,255,255,.12); background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.02));
          border-radius:22px; padding:22px; overflow:hidden; }
        .cta-img { width:100%; height:280px; object-fit:cover; border-radius:16px; }
        .btn-gold { display:inline-flex; align-items:center; justify-content:center; height:48px; padding:0 18px; border-radius:14px;
          font-weight:900; color:#211a07; border:1px solid rgba(255,210,64,.7);
          background:linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); transition:filter .15s, transform .04s; }
        .btn-gold:active { transform: translateY(1px); }

        @media (max-width: 980px) {
          .title { font-size:32px; }
          .grid2, .cta { grid-template-columns:1fr; }
          .img, .cta-img { height:220px; }
          .stats { grid-template-columns:repeat(2,1fr); }
        }
      `}</style>

      {/* ——— Hero ——— */}
      <section className="container hero">
        <div className="hero-bg" />
        <div className="hero-scrim" />
        <div className="hero-body">
          <div className="eyebrow">NESTA • ABOUT</div>
          <h1 className="title">A luxury standard for modern stays.</h1>
          <p className="sub">
            Nesta curates beautiful homes and premium apartments across Nigeria — pairing
            high-touch hospitality with real verification. We blend architecture, service,
            and technology so your stays feel effortless, refined, and reliably safe.
          </p>

          {/* Pillars */}
          <div className="pillars">
            {pillars.map((p) => (
              <div key={p.k} className="card">
                <div className="key">{p.k}</div>
                <div style={{ fontWeight: 900, margin: "10px 0 6px", fontSize: 18 }}>{p.t}</div>
                <div style={{ color: "#bfc7d8" }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Story section ——— */}
      <section className="container section">
        <div className="grid2">
          <div>
            <h3 className="lead">The Nesta promise</h3>
            <p className="body">
              We obsess over details that matter: verified identities, pristine spaces,
              reliable power, quiet neighborhoods, and quick human support. Whether it’s a
              one-night stopover or a month-long stay, the experience should feel steady,
              graceful, and genuinely premium.
            </p>
            <div className="stats">
              {stats.map((s) => (
                <div key={s.l} className="stat">
                  <div className="num">{s.n}</div>
                  <div className="lab">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <img
            className="img"
            alt="Warm interior with natural textures"
            src="https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1400&auto=format&fit=crop"
          />
        </div>
      </section>

      {/* ——— Luxe CTA banner ——— */}
      <section className="container section" style={{ borderTop: "none" }}>
        <div className="cta">
          <div>
            <h3 className="lead" style={{ marginBottom: 6 }}>
              Work with Nesta
            </h3>
            <p className="body">
              Own or manage premium homes? Join as a Host or Verified Partner and unlock
              concierge support, placement advantages, and transparent payouts — all
              backed by robust KYC.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <Link to="/onboarding/host" className="btn-gold">Become a Host</Link>
              <Link
                to="/onboarding/partner"
                className="btn-gold"
                style={{ background: "rgba(255,255,255,.06)", color: "#e7ecf7", borderColor: "rgba(255,255,255,.18)" }}
              >
                Verified Partner
              </Link>
            </div>
          </div>
          <img
            className="cta-img"
            alt="Contemporary exterior dusk shot"
            src="https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1400&auto=format&fit=crop"
          />
        </div>
      </section>

      {/* ——— Footer link row (elegant minimal) ——— */}
      <section className="container section" style={{ paddingTop: 16 }}>
        <div className="links-row">
          <Link className="link" to="/contact">Contact</Link>
          <span style={{ opacity: .25 }}>•</span>
          <Link className="link" to="/press">Press</Link>
          <span style={{ opacity: .25 }}>•</span>
          <Link className="link" to="/careers">Careers</Link>
          <span style={{ opacity: .25 }}>•</span>
          <Link className="link" to="/help">Help & Support</Link>
        </div>
        <div style={{ textAlign: "center", color: "#aeb8cc", fontSize: 12, marginTop: 10 }}>
          © {new Date().getFullYear()} Nesta Stays — all rights reserved.
        </div>
      </section>
    </>
  );
}
