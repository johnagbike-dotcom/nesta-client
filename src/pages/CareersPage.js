import React from "react";
import { Link } from "react-router-dom";

export default function CareersPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070a] via-[#05070a] to-black text-white pt-24 pb-16 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <section className="mb-10">
          <p className="text-[11px] tracking-[0.28em] text-amber-300/80 uppercase mb-3">
            Careers
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Build the future of{" "}
            <span className="text-amber-300">luxury stays in Nigeria.</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/75 max-w-2xl">
            Nesta is creating a new standard for premium short-stays across
            Nigeria — combining hospitality, technology and design. If you care
            about details, reliability and guest experience, there’s a place for
            you here.
          </p>
        </section>

        {/* Why Nesta */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            Why join Nesta’s early team?
          </h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                1. Meaningful work
              </div>
              <p>
                You’ll help shape a category-defining brand for Nigerian
                hospitality — not just add another app to the store.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                2. High standards
              </div>
              <p>
                We operate with a luxury mindset: clear communication, respect
                for people’s time, and pride in what we ship.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                3. Real ownership
              </div>
              <p>
                Early team members help define product, playbooks and culture —
                and see their impact in live bookings and happy guests.
              </p>
            </div>
          </div>
        </section>

        {/* Our culture / values */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            How we work at Nesta
          </h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 text-sm text-white/80 space-y-2">
            <p>
              We are calm, professional and serious about quality. We move with
              urgency, but not chaos. We prefer clear, written thinking over
              noise. We test, refine and improve.
            </p>
            <p className="mt-2">
              Our core working values are simple:
            </p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside">
              <li>
                <span className="font-semibold text-white">
                  Hospitality first:
                </span>{" "}
                whether you write code, design interfaces or manage properties,
                you are ultimately serving real people.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Clear and honest:
                </span>{" "}
                we communicate with respect — with guests, partners and each
                other.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Quietly luxurious:
                </span>{" "}
                we care about details that many will never see, because we know
                the right people notice.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Nigeria-aware, world-class:
                </span>{" "}
                we design for our context, but we benchmark against global
                standards.
              </li>
            </ul>
          </div>
        </section>

        {/* Current opportunities */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            Current opportunities
          </h2>

          <div className="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 md:p-6 text-sm text-white/85 space-y-3">
            <p>
              Nesta is in its early growth phase. We will be opening formal
              roles across:
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Product &amp; Engineering</li>
              <li>Design &amp; Brand</li>
              <li>Operations &amp; City Launch</li>
              <li>Host Success &amp; Partner Relations</li>
              <li>Customer Support &amp; Concierge</li>
            </ul>

            <p className="mt-2">
              If you are passionate about hospitality, marketplaces and building
              something long-term in Nigeria, we’d like to hear from you — even
              if there is no perfect role listed yet.
            </p>

            <div className="mt-3 rounded-xl bg-black/30 border border-white/15 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-200 uppercase tracking-[0.16em]">
                  Express interest
                </p>
                <p className="text-sm text-white/80 mt-1">
                  Send a short note with your CV / LinkedIn, what you do best,
                  and why Nesta interests you.
                </p>
              </div>
              <a
                href="mailto:careers@nestaapp.ng?subject=Careers%20expression%20of%20interest"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
              >
                Email careers@nestanaija.com
              </a>
            </div>

            <p className="text-xs text-white/60 mt-1">
              Please note: by contacting us about roles, you consent to Nesta
              storing your details for up to 12 months in line with our{" "}
              <Link
                to="/privacy"
                className="underline decoration-amber-400/70 underline-offset-2 hover:text-amber-200"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>

        {/* How we hire */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">How we hire</h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                1. Short, focused intro
              </div>
              <p>
                We review your profile and, if there’s a potential fit, we’ll
                invite you for a short conversation to understand your
                experience and goals.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                2. Practical exercise
              </div>
              <p>
                Where relevant, we’ll share a small, real-world task —
                something close to what you would actually work on at Nesta.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                3. Values &amp; offer
              </div>
              <p>
                Final conversations focus on ways of working, expectations and
                how we support you. If we both feel aligned, we extend a
                written offer.
              </p>
            </div>
          </div>
        </section>

        {/* Small closing note */}
        <section className="mt-6 text-sm text-white/70">
          <p>
            We know that talented people have options. If you choose to build
            with Nesta — whether full-time, part-time or as a partner — we take
            that trust seriously.
          </p>
          <p className="mt-2">
            Nesta Connect Ltd • {year} • Nigeria-founded, globally minded.
          </p>
        </section>
      </div>
    </main>
  );
}
