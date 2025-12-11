import React from "react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070a] via-[#05070a] to-black text-white pt-24 pb-16 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <section className="mb-10">
          <p className="text-[11px] tracking-[0.28em] text-amber-300/80 uppercase mb-3">
            About Nesta
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Luxury stays,{" "}
            <span className="text-amber-300">designed for Nigeria.</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/75 max-w-2xl">
            Nesta is a curated marketplace for premium apartments, villas and
            suites across Nigeria. We exist for guests who want more than
            “somewhere to sleep” — and for hosts and partners who take pride in
            offering a professional experience from first enquiry to checkout.
          </p>
        </section>

        {/* Story + Nigeria-first */}
        <section className="grid gap-8 md:grid-cols-2 mb-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
            <h2 className="text-lg font-semibold mb-2">Our story</h2>
            <p className="text-sm text-white/75">
              Nesta was born from a simple frustration: finding a genuinely
              reliable, beautiful place to stay in Nigerian cities often meant
              endless calls, screenshots and guesswork. We wanted something
              calmer — a trusted home for verified, design-led spaces with clear
              pricing and professional hosts.
            </p>
            <p className="text-sm text-white/75 mt-3">
              Today, Nesta brings together guests, individual hosts and portfolio
              partners under one luxury standard. Every listing aims to meet our
              bar for comfort, cleanliness, safety and digital-first service.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-5 md:p-6">
            <h2 className="text-lg font-semibold mb-2">Nigeria-first by design</h2>
            <p className="text-sm text-white/80">
              Nesta is built specifically for the realities of the Nigerian
              market:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>• Power, water and security are part of the conversation.</li>
              <li>
                • Hosts and partners are verified with KYC and subscription
                tiers.
              </li>
              <li>
                • Guests see clear pricing in naira and can chat in-app with
                hosts/partners.
              </li>
              <li>• Bookings, changes and cancellations are managed in one place.</li>
            </ul>
          </div>
        </section>

        {/* Pillars */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            What Nesta stands for
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs tracking-[0.16em] uppercase text-white/60 mb-1">
                1. Trust
              </div>
              <p className="text-sm text-white/75">
                Verified hosts and partners, transparent policies and a platform
                that keeps communication and payments in one secure flow.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs tracking-[0.16em] uppercase text-white/60 mb-1">
                2. Comfort
              </div>
              <p className="text-sm text-white/75">
                A focus on real guest comfort — cleanliness, thoughtful design,
                good sleep, reliable basics — not just photos.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs tracking-[0.16em] uppercase text-white/60 mb-1">
                3. Professionalism
              </div>
              <p className="text-sm text-white/75">
                Clear expectations, timely responses, structured bookings and
                policies that respect both guests and property owners.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            How Nesta works — in three simple steps
          </h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                1. Browse &amp; shortlist
              </div>
              <p>
                Guests explore verified stays by city, budget and style — saving
                favourites and comparing like-for-like options.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                2. Reserve with clarity
              </div>
              <p>
                Transparent pricing in naira, clear policies and a secure
                checkout flow. No hidden calls or last-minute surprises.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-amber-300 mb-1">
                3. Arrive &amp; relax
              </div>
              <p>
                Hosts and partners use Nesta to manage reservations, check-in
                details and after-stay feedback — closing the loop.
              </p>
            </div>
          </div>
        </section>

        {/* For whom */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            Built for guests, hosts and partners
          </h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-semibold mb-1">For guests</h3>
              <p className="text-white/75">
                Business trips, weekends away, relocation stays — Nesta gives
                you a calm way to find reliable homes, not guesswork.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-semibold mb-1">For individual hosts</h3>
              <p className="text-white/75">
                Turn a well-kept apartment into a serious income stream with
                better visibility, messaging and reservation tools.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-semibold mb-1">For portfolio partners</h3>
              <p className="text-white/75">
                Manage multiple units and buildings, centralise bookings and
                track performance — all while staying on a premium brand.
              </p>
            </div>
          </div>
        </section>

        {/* CEO / Founder message – using your exact text */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Founder’s message</h2>
          <div className="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 md:p-6 text-sm text-white/80 leading-relaxed space-y-3">
            <p>
              At Nesta, we believe luxury is not defined by marble floors or sparkling chandeliers —{" "}
              it is defined by how a person feels the moment they walk through the door.
            </p>
            <p>
              In Nigeria, extraordinary spaces exist.
              What has been missing is a platform that treats those spaces with the same care, respect, and refinement that the world’s finest brands offer.
              Nesta was created to close that gap.
            </p>
            <p>
              Our mission is simple:
              to elevate the modern Nigerian stay into a world-class experience — trusted, curated, and beautifully seamless.
            </p>
            <p>
              We partner only with hosts and property managers who share our standard of excellence.
              We prioritise safety, transparency and professional hospitality at every step.
              And we design our technology to feel calm, intuitive, and quietly luxurious.
            </p>
            <p>
              Nesta is for the discerning traveler.
              For families who value comfort.
              For professionals who expect reliability.
              And for property owners who believe their spaces deserve to be showcased with honour.
            </p>
            <p>
              What you see today is only the beginning.
              Thank you for trusting Nesta with your journey —{" "}
              whether you are opening your doors, or discovering your next destination.
            </p>
            <p>You deserve a stay that remembers you.</p>
            <p className="pt-2 text-amber-200 font-semibold">
              — J.A., Founder &amp; CEO
            </p>
          </div>
        </section>

        {/* Soft CTA */}
        <section className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            to="/explore"
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
          >
            Browse stays
          </Link>
          <Link
            to="/post-ad"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white hover:bg-white/10"
          >
            List your property
          </Link>
          <Link
            to="/careers"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white/80 hover:bg-white/10"
          >
            Careers at Nesta
          </Link>
        </section>
      </div>
    </main>
  );
}
