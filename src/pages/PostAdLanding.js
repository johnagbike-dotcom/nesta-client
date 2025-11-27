// src/pages/PostAdLanding.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

function kycOk(status) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "verified" || s === "complete";
}

export default function PostAdLanding() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const continueToPost = () => {
    if (!user) return nav("/signup?next=/post-ad");

    // KYC must go through the application wizard, not straight upload
    if (!kycOk(profile?.kycStatus)) {
      const next = encodeURIComponent("/post");
      return nav(`/onboarding/kyc/apply?next=${next}`);
    }

    return nav("/post");
  };

  return (
    <main className="container mx-auto px-5 py-10 text-white">
      {/* Hero */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="text-xs tracking-[0.25em] text-white/60 font-black">
          NESTA • LIST YOUR SPACE
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Host to a higher standard
        </h1>
        <p className="text-white/70 mt-2 max-w-2xl">
          Luxury guests expect more. Nesta helps you present flawlessly,
          verify securely, and manage with grace.
        </p>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            {
              n: "01",
              t: "Create your listing",
              s: "Polished titles, premium photos, accurate amenities.",
            },
            {
              n: "02",
              t: "Verify identity (KYC)",
              s: "ID & address validation before you go live.",
            },
            {
              n: "03",
              t: "Publish & manage",
              s: "Priority placement, concierge messaging, clear payouts.",
            },
          ].map((x) => (
            <div
              key={x.n}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-sm text-white/70 mb-1">{x.n}</div>
              <div className="font-extrabold text-lg">{x.t}</div>
              <p className="text-white/70 mt-1 text-sm">{x.s}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={continueToPost} className="btn-gold">
            Continue to post
          </button>
          <button
            onClick={() => nav("/onboarding/kyc/apply?role=host")}
            className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white/90"
          >
            Become a Host
          </button>
          <button
            onClick={() => nav("/onboarding/kyc/apply?role=partner")}
            className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white/90"
          >
            Verified Partner
          </button>
        </div>

        {!user && (
          <p className="text-white/60 text-sm mt-3">
            You’ll create an account before posting.
          </p>
        )}
      </section>

      {/* Luxury Plans */}
      <section className="mt-8 grid md:grid-cols-3 gap-4">
        {/* Classic */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col">
          <div className="text-sm text-white/60 mb-1">Classic</div>
          <div className="text-2xl font-extrabold">Free</div>
          <div className="text-white/60 text-sm mt-1">Refined essentials</div>
          <ul className="mt-4 text-sm text-white/80 space-y-2 list-disc pl-5">
            <li>Post up to 2 listings</li>
            <li>Standard placement</li>
            <li>In-app messaging</li>
            <li>Basic support</li>
          </ul>
          <button onClick={continueToPost} className="btn-gold mt-5">
            Start free
          </button>
        </div>

        {/* Host Luxe */}
        <div className="rounded-2xl border border-yellow-400/30 bg-white/5 p-5 flex flex-col relative">
          <span className="absolute -top-2 right-4 text-[11px] font-bold px-2 py-0.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-200">
            Luxe Pick
          </span>
          <div className="text-sm text-white/60 mb-1">Host Luxe</div>
          <div className="text-2xl font-extrabold">
            ₦19,500
            <span className="text-base font-bold text-white/60"> /mo</span>
          </div>
          <div className="text-white/60 text-sm mt-1">Priority & polish</div>
          <ul className="mt-4 text-sm text-white/80 space-y-2 list-disc pl-5">
            <li>Up to 15 listings</li>
            <li>Priority placement & featured eligibility</li>
            <li>Photo guideline review (white-glove tips)</li>
            <li>Lower booking fee</li>
            <li>Priority chat & email support</li>
          </ul>
          <button
            onClick={() => nav("/subscribe?plan=host-luxe")}
            className="btn-gold mt-5"
          >
            Choose Host Luxe
          </button>
        </div>

        {/* Signature Partner */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col">
          <div className="text-sm text-white/60 mb-1">Signature Partner</div>
          <div className="text-2xl font-extrabold">Custom</div>
          <div className="text-white/60 text-sm mt-1">Portfolio excellence</div>
          <ul className="mt-4 text-sm text-white/80 space-y-2 list-disc pl-5">
            <li>Unlimited listings</li>
            <li>Commission tracking & scheduled payouts</li>
            <li>Account manager & concierge onboarding</li>
            <li>API access & advanced reporting</li>
            <li>SLA support & escalation channel</li>
          </ul>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => nav("/onboarding/kyc/apply?role=partner")}
              className="btn-gold"
            >
              Apply as Partner
            </button>
            <button
              onClick={() => nav("/contact?topic=partner")}
              className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white/90"
            >
              Request a call →
            </button>
          </div>
        </div>
      </section>

      {/* Fine print */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/80">
          Booking fees vary by plan and payout method. Prices may adjust with FX.
          Upgrade anytime.
        </div>
      </section>

      {/* Assurance band */}
      <section className="mt-8 grid md:grid-cols-3 gap-4">
        {[
          {
            t: "Identity you can trust",
            s: "ID and address checks before you go live.",
          },
          {
            t: "Payouts with poise",
            s: "Reliable cycles via leading payment partners. Clear statements.",
          },
          {
            t: "Support with taste",
            s: "From quick answers to white-glove guidance for premium portfolios.",
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="font-extrabold">{x.t}</div>
            <p className="text-white/70 text-sm mt-2">{x.s}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

