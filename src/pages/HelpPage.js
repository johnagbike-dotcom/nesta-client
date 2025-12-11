// src/pages/HelpPage.js
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const FAQ_SECTIONS = [
  {
    id: "bookings",
    label: "Bookings & Stays",
    items: [
      {
        q: "How do I view or manage my bookings?",
        a: (
          <>
            Go to <strong>Dashboard → Your Bookings</strong> or visit{" "}
            <Link to="/bookings" className="text-amber-300 underline">
              nestaapp.ng/bookings
            </Link>
            . There you can see upcoming and past stays, and in some cases request
            a date change or cancellation in line with the host’s policy.
          </>
        ),
      },
      {
        q: "Can I request a date change?",
        a: (
          <>
            For many confirmed bookings, you can select{" "}
            <strong>“Request date change”</strong> from your booking card. Your
            host or verified partner will review the request and respond based on
            availability and the applicable cancellation policy.
          </>
        ),
      },
      {
        q: "Where can I see my check-in details?",
        a: (
          <>
            Once a booking is confirmed, key details such as{" "}
            <strong>check-in time, contact details and guidance</strong> will be
            shared via your booking view and may also be sent by email or chat.
            For any uncertainty, use the{" "}
            <strong>“Chat with Host/Partner”</strong> button in your booking.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    label: "Account & Login",
    items: [
      {
        q: "I can’t sign in to my Nesta account.",
        a: (
          <>
            First, ensure you are using the{" "}
            <strong>same phone number or email</strong> you registered with. If
            you have issues receiving OTP codes, wait a few minutes and try again
            or switch to a stronger network connection. For persistent problems,
            contact{" "}
            <a
              href="mailto:support@nestaapp.ng"
              className="text-amber-300 underline"
            >
              support@nestaapp.ng
            </a>{" "}
            with a brief description and screenshots if possible.
          </>
        ),
      },
      {
        q: "How do I update my profile details?",
        a: (
          <>
            After logging in, visit your profile area (or account menu) to update
            details such as your name and basic contact information. Certain
            fields which relate to KYC or security may require support
            verification to change.
          </>
        ),
      },
    ],
  },
  {
    id: "payments",
    label: "Payments, Refunds & Cancellations",
    items: [
      {
        q: "How are payments processed?",
        a: (
          <>
            Payments on Nesta are securely processed through{" "}
            <strong>trusted payment providers</strong>. You may see{" "}
            <strong>Paystack, Flutterwave or your card issuer</strong> referenced
            on your receipt or bank statement, depending on the integration in
            use. We do not store your full card details on Nesta servers.
          </>
        ),
      },
      {
        q: "When will I receive my refund?",
        a: (
          <>
            If a booking is cancelled and a refund is due, it will be processed in
            line with our{" "}
            <Link
              to="/cancellation-policy"
              className="text-amber-300 underline"
            >
              Cancellations &amp; Refunds Policy
            </Link>{" "}
            and the host’s terms. Refund timelines may vary by payment provider,
            but most banks reflect successfully processed refunds within{" "}
            <strong>5–10 working days</strong>.
          </>
        ),
      },
      {
        q: "How do I request a cancellation?",
        a: (
          <>
            From{" "}
            <Link to="/bookings" className="text-amber-300 underline">
              Your Bookings
            </Link>
            , choose the relevant stay and click{" "}
            <strong>“Request cancel”</strong> (if available). This sends a
            cancellation request to the host or partner, who will respond based on
            the agreed policy. For urgent cases (e.g. safety or severe issues),
            contact{" "}
            <a
              href="mailto:support@nestaapp.ng"
              className="text-amber-300 underline"
            >
              support@nestaapp.ng
            </a>{" "}
            immediately.
          </>
        ),
      },
    ],
  },
  {
    id: "hosting",
    label: "Hosting & Partners",
    items: [
      {
        q: "How do I become a Host on Nesta?",
        a: (
          <>
            Visit{" "}
            <Link to="/onboarding/host" className="text-amber-300 underline">
              Become a Host
            </Link>{" "}
            to start the onboarding process. We will guide you through KYC,
            property verification, and listing setup so your stay appears with
            Nesta’s premium presentation.
          </>
        ),
      },
      {
        q: "What is a Verified Partner?",
        a: (
          <>
            Verified Partners are professional property managers, portfolio
            owners, or hospitality operators who manage multiple units at Nesta’s
            standard. Learn more or start the process via{" "}
            <Link
              to="/onboarding/partner"
              className="text-amber-300 underline"
            >
              Partner Onboarding
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: "safety",
    label: "Trust, Safety & Security",
    items: [
      {
        q: "How does Nesta keep guests and hosts safe?",
        a: (
          <>
            Safety is at the centre of the platform. We combine{" "}
            <strong>identity verification (KYC)</strong>, curated listings,
            policy-backed bookings, secure payments and responsive human support.
            Read more in our{" "}
            <Link
              to="/trust-and-safety"
              className="text-amber-300 underline"
            >
              Trust &amp; Safety
            </Link>{" "}
            and{" "}
            <Link to="/security" className="text-amber-300 underline">
              Security
            </Link>{" "}
            pages.
          </>
        ),
      },
      {
        q: "How do I raise a complaint or serious concern?",
        a: (
          <>
            For any serious concern (safety, discrimination, fraud, or severe
            service issues), you may use the dedicated{" "}
            <Link to="/complaints" className="text-amber-300 underline">
              Complaints
            </Link>{" "}
            page or email{" "}
            <a
              href="mailto:complaints@nestaapp.ng"
              className="text-amber-300 underline"
            >
              complaints@nestaapp.ng
            </a>
            . We treat these matters discreetly and seriously.
          </>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");

  const flatFaqs = useMemo(() => {
    const qNorm = query.trim().toLowerCase();
    if (!qNorm) return FAQ_SECTIONS;
    // Filter sections & items based on text match
    return FAQ_SECTIONS.map((section) => {
      const items = section.items.filter((item) => {
        const text =
          (typeof item.q === "string" ? item.q : "") +
          " " +
          (typeof item.a === "string" ? item.a : "");
        return text.toLowerCase().includes(qNorm);
      });
      return { ...section, items };
    }).filter((section) => section.items.length > 0);
  }, [query]);

  const hasResults = flatFaqs.some((s) => s.items.length > 0);

  return (
    <main className="min-h-screen bg-[#05070a] text-white px-4 pb-12 pt-24">
      <div className="mx-auto max-w-5xl">
        {/* Hero / intro */}
        <header className="mb-8">
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            NESTA • HELP CENTRE
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            How can we help with your stay?
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/70 max-w-2xl">
            A calm support space for guests, hosts, and partners. Browse answers
            to common questions, or reach our team directly if something feels
            urgent or unclear.
          </p>
        </header>

        {/* Quick actions row */}
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/bookings"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/60">
              Guests
            </div>
            <div className="mt-1 font-semibold">View my bookings</div>
            <div className="text-xs text-white/60 mt-0.5">
              Check status, dates and receipts.
            </div>
          </Link>

          <Link
            to="/help"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/60">
              Hosts &amp; Partners
            </div>
            <div className="mt-1 font-semibold">Hosting support</div>
            <div className="text-xs text-white/60 mt-0.5">
              Onboarding, listings and payouts.
            </div>
          </Link>

          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1 sm:flex-row lg:flex-col">
            <Link
              to="/complaints"
              className="flex-1 rounded-2xl border border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/20 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200">
                Serious concern
              </div>
              <div className="mt-1 font-semibold text-amber-100">
                Submit a complaint
              </div>
              <div className="text-xs text-amber-100/80 mt-0.5">
                Safety, misconduct, or unresolved issues.
              </div>
            </Link>
          </div>
        </section>

        {/* Search */}
        <section className="mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
            <span className="text-white/50 text-sm">Search help</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a keyword (e.g. refund, login, host, safety)…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/35"
            />
          </div>
          {query && (
            <p className="mt-1 text-[11px] text-white/50">
              Showing results for:{" "}
              <span className="font-mono text-white/80">{query}</span>
            </p>
          )}
        </section>

        {/* FAQ sections */}
        <section className="space-y-6">
          {!hasResults && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
              We couldn’t find a match for your search. You can{" "}
              <a
                href="mailto:support@nestaapp.ng"
                className="text-amber-300 underline"
              >
                email support@nestaapp.ng
              </a>{" "}
              or{" "}
              <Link to="/contact" className="text-amber-300 underline">
                contact us here
              </Link>
              .
            </div>
          )}

          {flatFaqs.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 md:px-5 md:py-5"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
                  {section.label}
                </h2>
              </div>
              <div className="space-y-3">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-sm"
                  >
                    <div className="font-semibold text-white">
                      {item.q}
                    </div>
                    <div className="mt-1 text-white/75 text-xs md:text-sm">
                      {item.a}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Final contact strip */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-[#111827] to-[#020617] px-4 py-4 md:px-5 md:py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/50">
              Still need a human?
            </p>
            <p className="text-sm text-white/75 mt-1">
              Our team is available to support you with bookings, hosting, and
              safety concerns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              to="/contact"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/15"
            >
              Contact Nesta
            </Link>
            <a
              href="mailto:support@nestaapp.ng"
              className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-amber-100 hover:bg-amber-500/20"
            >
              Email support@nestaapp.ng
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
