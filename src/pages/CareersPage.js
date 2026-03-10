// src/pages/CareersPage.js
import React, { useState } from "react";
import { Link } from "react-router-dom";

const CORMORANT = "'Cormorant Garamond', Georgia, serif";

const WHY = [
  {
    num: "01",
    title: "Meaningful work",
    body: "You'll help shape a category-defining brand for Nigerian hospitality — not just add another app to the store.",
  },
  {
    num: "02",
    title: "High standards",
    body: "We operate with a luxury mindset: clear communication, respect for people's time, and pride in what we ship.",
  },
  {
    num: "03",
    title: "Real ownership",
    body: "Early team members define product, playbooks and culture — and see their impact in live bookings and happy guests.",
  },
];

const VALUES = [
  { label: "Hospitality first", body: "Whether you write code, design interfaces or manage properties, you are ultimately serving real people." },
  { label: "Clear and honest", body: "We communicate with respect — with guests, partners and each other. No noise, no politics." },
  { label: "Quietly luxurious", body: "We care about details that many will never see, because we know the right people always notice." },
  { label: "Nigeria-aware, world-class", body: "We design for our context, but we benchmark against global standards." },
];

const ROLES = [
  { dept: "Product & Engineering", icon: "⌨" },
  { dept: "Design & Brand", icon: "◈" },
  { dept: "Operations & City Launch", icon: "◎" },
  { dept: "Host Success & Partner Relations", icon: "◇" },
  { dept: "Customer Support & Concierge", icon: "◉" },
];

const STEPS = [
  {
    num: "1",
    title: "Short, focused intro",
    body: "We review your profile and, if there's a potential fit, invite you for a short conversation about your experience and goals.",
  },
  {
    num: "2",
    title: "Practical exercise",
    body: "Where relevant, we share a small, real-world task — something close to what you'd actually work on at NestaNg.",
  },
  {
    num: "3",
    title: "Values & offer",
    body: "Final conversations focus on ways of working and expectations. If we're aligned, we extend a written offer.",
  },
];

export default function CareersPage() {
  const year = new Date().getFullYear();
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lineGrow {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes pulseGold {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.7; }
        }

        .careers-hero    { animation: fadeUp 0.7s ease both; }
        .careers-section { animation: fadeUp 0.7s ease both; }
        .careers-section:nth-child(2) { animation-delay: 0.08s; }
        .careers-section:nth-child(3) { animation-delay: 0.14s; }
        .careers-section:nth-child(4) { animation-delay: 0.20s; }
        .careers-section:nth-child(5) { animation-delay: 0.26s; }
        .careers-section:nth-child(6) { animation-delay: 0.32s; }

        .why-card {
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }
        .why-card:hover {
          border-color: rgba(201,168,76,0.35) !important;
          background: rgba(201,168,76,0.06) !important;
          transform: translateY(-3px);
        }
        .role-row {
          transition: background 0.2s, border-color 0.2s, padding-left 0.2s;
          cursor: default;
        }
        .role-row:hover {
          background: rgba(201,168,76,0.06) !important;
          border-color: rgba(201,168,76,0.3) !important;
          padding-left: 22px !important;
        }
        .value-item {
          transition: border-color 0.2s, background 0.2s;
        }
        .value-item:hover {
          border-color: rgba(201,168,76,0.25) !important;
        }
        .cta-btn {
          transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
        }
        .cta-btn:hover {
          background: #e8c450 !important;
          box-shadow: 0 8px 28px rgba(201,168,76,0.4) !important;
          transform: translateY(-1px);
        }
        .gold-line {
          height: 1px;
          background: linear-gradient(90deg, rgba(201,168,76,0.6), rgba(201,168,76,0.1), transparent);
          animation: pulseGold 3s ease infinite;
        }
      `}</style>

      <main style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse 1200px 500px at 60% -10%, rgba(201,168,76,0.06), transparent 60%), #05070a",
        color: "#fff",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        paddingTop: "calc(var(--topbar-h, 88px) + 32px)",
        paddingBottom: 80,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>

          {/* ── Hero ── */}
          <section className="careers-hero" style={{ marginBottom: 72, position: "relative" }}>
            {/* Decorative large numeral */}
            <div style={{
              position: "absolute", top: -24, right: 0, fontSize: "clamp(80px,12vw,140px)",
              fontFamily: CORMORANT, fontWeight: 700, color: "rgba(201,168,76,0.05)",
              lineHeight: 1, userSelect: "none", pointerEvents: "none",
            }}>CAREERS</div>

            <p style={{
              fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase",
              color: "#c9a84c", marginBottom: 16, fontWeight: 600,
            }}>
              Nesta Connect Limited · Careers
            </p>
            <h1 style={{
              fontFamily: CORMORANT, fontSize: "clamp(36px, 5.5vw, 64px)",
              fontWeight: 600, lineHeight: 1.1, color: "#f5f0e8",
              margin: "0 0 24px", maxWidth: 700,
            }}>
              Build the future of<br />
              <em style={{ color: "#c9a84c", fontStyle: "italic" }}>luxury stays in Nigeria.</em>
            </h1>
            <p style={{
              fontSize: 15, fontWeight: 300, color: "rgba(255,255,255,0.6)",
              maxWidth: 560, lineHeight: 1.75, margin: 0,
            }}>
              NestaNg is creating a new standard for premium short-stays across Nigeria —
              combining hospitality, technology and design. If you care about details,
              reliability and guest experience, there's a place for you here.
            </p>
            <div className="gold-line" style={{ marginTop: 40, maxWidth: 200 }} />
          </section>

          {/* ── Why NestaNg ── */}
          <section className="careers-section" style={{ marginBottom: 64 }}>
            <h2 style={{
              fontFamily: CORMORANT, fontSize: "clamp(22px,3vw,30px)", fontWeight: 600,
              color: "#f5f0e8", marginBottom: 24,
            }}>
              Why join NestaNg's early team?
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {WHY.map((w) => (
                <div key={w.num} className="why-card" style={{
                  borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(12,16,24,0.7)", padding: "24px 22px",
                }}>
                  <div style={{
                    fontFamily: CORMORANT, fontSize: 42, fontWeight: 600,
                    color: "rgba(201,168,76,0.2)", lineHeight: 1, marginBottom: 12,
                  }}>{w.num}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c9a84c", marginBottom: 8, letterSpacing: "0.04em" }}>
                    {w.title}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0 }}>
                    {w.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── How we work ── */}
          <section className="careers-section" style={{ marginBottom: 64 }}>
            <h2 style={{
              fontFamily: CORMORANT, fontSize: "clamp(22px,3vw,30px)", fontWeight: 600,
              color: "#f5f0e8", marginBottom: 24,
            }}>
              How we work at NestaNg
            </h2>
            <div style={{
              borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(12,16,24,0.7)", padding: "28px 28px 24px",
            }}>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, marginBottom: 20 }}>
                We are calm, professional and serious about quality. We move with urgency, but not chaos.
                We prefer clear, written thinking over noise. We test, refine and improve.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {VALUES.map((v) => (
                  <div key={v.label} className="value-item" style={{
                    borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.25)", padding: "16px 18px",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#c9a84c", marginBottom: 6, letterSpacing: "0.06em" }}>
                      {v.label}
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0 }}>
                      {v.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Open roles ── */}
          <section className="careers-section" style={{ marginBottom: 64 }}>
            <h2 style={{
              fontFamily: CORMORANT, fontSize: "clamp(22px,3vw,30px)", fontWeight: 600,
              color: "#f5f0e8", marginBottom: 8,
            }}>
              Current opportunities
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.65 }}>
              NestaNg is in its early growth phase. We are opening roles across the following areas.
              If you are passionate about hospitality, marketplaces and building something long-term
              in Nigeria, we'd like to hear from you — even if no perfect role is listed yet.
            </p>

            <div style={{
              borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(12,16,24,0.7)", overflow: "hidden", marginBottom: 24,
            }}>
              {ROLES.map((r, i) => (
                <div key={r.dept} className="role-row" style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 20px",
                  borderBottom: i < ROLES.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  transition: "background 0.2s, border-color 0.2s, padding-left 0.2s",
                }}>
                  <span style={{ fontSize: 18, color: "rgba(201,168,76,0.55)", flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 400 }}>{r.dept}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>OPEN</span>
                </div>
              ))}
            </div>

            {/* CTA card */}
            <div style={{
              borderRadius: 20, border: "1px solid rgba(201,168,76,0.25)",
              background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))",
              padding: "24px 24px",
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20,
            }}>
              <div style={{ flex: "1 1 300px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 8 }}>
                  Express interest
                </p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, margin: 0 }}>
                  Send a short note with your CV or LinkedIn, what you do best, and why NestaNg interests you.
                </p>
              </div>
              <a
                href="mailto:hello@nestanaija.com?subject=Careers%20expression%20of%20interest"
                className="cta-btn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 22px", borderRadius: 999,
                  background: "linear-gradient(135deg, #e8c96b, #c9a84c)",
                  color: "#120d02", fontSize: 13, fontWeight: 700,
                  textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 4px 18px rgba(201,168,76,0.28)",
                  flexShrink: 0,
                }}
              >
                Email hello@nestanaija.com →
              </a>
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 14, lineHeight: 1.6 }}>
              By contacting us about roles, you consent to NestaNg storing your details for up to 12 months in line with our{" "}
              <Link to="/privacy" style={{ color: "#c9a84c", textDecoration: "underline", textUnderlineOffset: 3 }}>
                Privacy Policy
              </Link>.
            </p>
          </section>

          {/* ── How we hire ── */}
          <section className="careers-section" style={{ marginBottom: 64 }}>
            <h2 style={{
              fontFamily: CORMORANT, fontSize: "clamp(22px,3vw,30px)", fontWeight: 600,
              color: "#f5f0e8", marginBottom: 24,
            }}>
              How we hire
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {STEPS.map((s) => (
                <div key={s.num} className="why-card" style={{
                  borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(12,16,24,0.7)", padding: "22px 20px",
                  display: "flex", gap: 16,
                }}>
                  <div style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                    border: "1px solid rgba(201,168,76,0.35)",
                    background: "rgba(201,168,76,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#c9a84c",
                  }}>{s.num}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>{s.title}</div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Closing ── */}
          <section className="careers-section">
            <div className="gold-line" style={{ marginBottom: 28, maxWidth: 120 }} />
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, maxWidth: 560, margin: "0 0 8px" }}>
              We know that talented people have options. If you choose to build with NestaNg — whether
              full-time, part-time or as a partner — we take that trust seriously.
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Nesta Connect Limited · {year} · Nigeria-founded, globally minded.
            </p>
          </section>

        </div>
      </main>
    </>
  );
}