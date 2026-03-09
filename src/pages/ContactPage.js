// src/pages/ContactPage.js
import React from "react";
import { Link } from "react-router-dom";

function ContactCard({ label, email, description, tone = "default" }) {
  const border =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-400/5"
      : "border-white/8 bg-[#0c0f16]";
  return (
    <div className={`rounded-3xl border p-5 space-y-2 ${border}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40">
        {label}
      </div>
      <a
        href={`mailto:${email}`}
        className="block text-sm font-bold text-amber-300 hover:text-amber-200 transition-colors"
      >
        {email}
      </a>
      <p className="text-[13px] text-white/55 leading-relaxed">{description}</p>
    </div>
  );
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <header className="space-y-2">
          <p className="text-[11px] tracking-[0.24em] text-amber-300/70">
            NestaNg · Contact
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Get in touch
          </h1>
          <p className="text-white/60 text-sm max-w-xl leading-relaxed">
            Our concierge and support teams are available to help guests, hosts, partners and
            press. Choose the right channel below for the fastest response.
          </p>
        </header>

        {/* Contact channels */}
        <section className="grid gap-4 md:grid-cols-2">
          <ContactCard
            label="Guest support"
            email="support@nestanaija.com"
            description="Bookings, check-in issues, refund queries, and general help. We aim to respond within a few hours on business days."
            tone="amber"
          />
          <ContactCard
            label="Host & partner enquiries"
            email="support@nestanaija.com"
            description="Onboarding, listing queries, payouts, KYC, and operational support for hosts and verified partners."
          />
          <ContactCard
            label="Complaints & serious concerns"
            email="support@nestanaija.com"
            description="Safety, misconduct, fraud, or unresolved disputes. Treated discreetly, escalated immediately."
          />
          <ContactCard
            label="Security disclosures"
            email="support@nestanaija.com"
            description="Responsible disclosure of vulnerabilities or suspected security issues. Please include full technical detail."
          />
          <ContactCard
            label="Privacy & data requests"
            email="hello@nestanaija.com"
            description="NDPR data subject requests, right of access, erasure, and DPO correspondence."
          />
          <ContactCard
            label="Press & media"
            email="hello@nestanaija.com"
            description="Interviews, official statements, data requests, and brand asset access for verified journalists."
          />
          <ContactCard
            label="Legal & compliance"
            email="hello@nestanaija.com"
            description="Legal notices, regulatory correspondence, subpoenas, and compliance queries."
          />
          <ContactCard
            label="Careers"
            email="hello@nestanaija.com"
            description="Expressions of interest and role enquiries. Please include your CV and a brief note about what you do best."
          />
        </section>

        {/* Response times */}
        <section className="rounded-3xl border border-white/8 bg-[#0c0f16] p-6 space-y-4">
          <h2 className="text-base font-bold text-white">Response times</h2>
          <div className="grid md:grid-cols-3 gap-5 text-[13px] text-white/60">
            <div>
              <div className="text-white/80 font-semibold mb-1">Guest support</div>
              <p>Business hours: within 2–4 hours. Urgent safety matters: immediate escalation regardless of time.</p>
            </div>
            <div>
              <div className="text-white/80 font-semibold mb-1">Host & partner</div>
              <p>Monday – Friday, 9am – 6pm WAT. Payout and KYC matters are always prioritised.</p>
            </div>
            <div>
              <div className="text-white/80 font-semibold mb-1">Complaints</div>
              <p>Acknowledged within 24 hours. Full investigation typically within 5 business days.</p>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">Helpful links</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/help" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Help Centre
            </Link>
            <Link to="/cancellation-policy" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Cancellation Policy
            </Link>
            <Link to="/trust-and-safety" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Trust &amp; Safety
            </Link>
            <Link to="/privacy" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Privacy Policy
            </Link>
            <Link to="/complaints" className="px-4 py-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 text-amber-200 hover:bg-amber-400/10 transition-all">
              Submit a complaint →
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}