// src/pages/PressPage.js
import React from "react";

export default function PressPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] text-white pt-20 pb-20 px-4">
      <div className="max-w-4xl mx-auto space-y-14">

        {/* HERO */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-8 py-14 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">
            Press & Media
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
            For Journalists, Media, and Partners
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/70 leading-relaxed max-w-2xl">
            Nesta is redefining luxury accommodation and hospitality technology 
            across Nigeria. On this page, you’ll find verified company facts, 
            official statements, media assets, and the right channels to reach 
            our communications team.
          </p>
        </section>

        {/* ABOUT / COMPANY SUMMARY */}
        <section className="space-y-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            Company Overview
          </h2>
          <p>
            Nesta is a premium digital accommodation platform offering curated 
            apartments, serviced homes, and luxury stays across Nigeria. 
            Designed with a focus on trust, elegance, and seamless technology, 
            Nesta bridges hospitality and innovation — providing guests, hosts, 
            and partners with a refined and secure experience.
          </p>
          <p>
            Founded with a vision to elevate Africa’s short-stay ecosystem, 
            Nesta prioritizes quality listings, verified properties, and 
            exceptional guest service supported by modern tools such as 
            secure payments, host-partner dashboards, and in-app communication.
          </p>
        </section>

        {/* MEDIA CONTACT */}
        <section className="space-y-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">Media Contact</h2>
          <p className="text-white/70">
            For interviews, statements, data requests, or press materials, 
            please reach our Communications Desk:
          </p>

          <div className="rounded-2xl bg-[#0d1117] border border-white/10 p-6 text-white/80">
            <p>
              <span className="text-white">Email:</span>{" "}
              <a
                href="mailto:press@nestanaija.com"
                className="underline decoration-amber-400"
              >
                press@nestanaija.com
              </a>
            </p>
            <p className="mt-2">
              <span className="text-white">Office Hours:</span>{" "}
              Monday – Friday, 9:00 AM – 6:00 PM (WAT)
            </p>
          </div>
        </section>

        {/* FAST FACTS */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Fast Facts</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              ["Founded", "2025"],
              ["Headquarters", "Nigeria"],
              ["Industry", "Hospitality & Technology"],
              ["Brand Focus", "Luxury, Trust, Comfort"],
              ["Platform Type", "Web + Mobile"],
              ["Core Offering", "Short-stay apartments & premium suites"],
            ].map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-[#0d1117] p-4 text-sm text-white/70"
              >
                <div className="text-white font-semibold">{f[0]}</div>
                <div className="mt-1">{f[1]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* OFFICIAL STATEMENTS */}
        <section className="space-y-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            Official Statements
          </h2>

          <p>
            Nesta releases formal updates on partnerships, expansions, 
            policy changes, and major launches. All official statements 
            and press notes will be published on this page or distributed 
            directly to verified media channels.
          </p>

          <p className="text-white/70">
            For embargoed materials or data-driven stories, please reach out to 
            the Communications Desk.
          </p>
        </section>

        {/* BRAND ASSETS */}
        <section className="space-y-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            Brand Assets (Media Use)
          </h2>

          <p>
            Our visual assets may be used for verified media publications 
            and partnership materials. Requests for logos, brand guidelines, 
            photography, or product footage should be directed to:
          </p>

          <a
            className="inline-block underline decoration-amber-400 text-white/70"
            href="mailto:brand@nestanaija.com"
          >
            brand@nestanaija.com
          </a>

          <p className="mt-3 text-xs text-white/60">
            Usage of Nesta trademarks must comply with our brand guidelines 
            and must not imply endorsement without explicit approval.
          </p>
        </section>

        {/* FOOTER */}
        <section className="pt-8 border-t border-white/10 text-xs text-white/45">
          <p>© {year} Nesta Connect Limited — All rights reserved.</p>
        </section>
      </div>
    </main>
  );
}
