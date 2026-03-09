// src/pages/CookiePolicyPage.js
import React from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "March 2026";

const COOKIE_TABLE = [
  // Strictly Necessary
  {
    category: "Strictly Necessary",
    name: "__session",
    provider: "NestaNg",
    purpose: "Maintains your authenticated session across page loads.",
    duration: "Session",
    type: "HTTP",
  },
  {
    category: "Strictly Necessary",
    name: "nesta_kyc_intent",
    provider: "NestaNg",
    purpose: "Remembers whether you are applying as a Host or Partner during KYC onboarding.",
    duration: "Session",
    type: "localStorage",
  },
  {
    category: "Strictly Necessary",
    name: "nesta_cookie_consent",
    provider: "NestaNg",
    purpose: "Stores your cookie consent preferences so you are not asked again.",
    duration: "12 months",
    type: "localStorage",
  },
  // Functional
  {
    category: "Functional",
    name: "firebase_auth",
    provider: "Google Firebase",
    purpose: "Persists your Firebase authentication state so you remain signed in across browser sessions.",
    duration: "Until sign-out",
    type: "IndexedDB",
  },
  {
    category: "Functional",
    name: "flutterwave_tx",
    provider: "NestaNg",
    purpose: "Temporarily stores Flutterwave payment context during checkout to handle redirects.",
    duration: "Session",
    type: "sessionStorage",
  },
  {
    category: "Functional",
    name: "paystack_tx",
    provider: "NestaNg",
    purpose: "Temporarily stores Paystack payment context during checkout to handle redirects.",
    duration: "Session",
    type: "sessionStorage",
  },
  // Analytics
  {
    category: "Analytics",
    name: "_ga",
    provider: "Google Analytics",
    purpose: "Registers a unique ID to generate statistical data on how you use the website.",
    duration: "2 years",
    type: "HTTP",
  },
  {
    category: "Analytics",
    name: "_ga_*",
    provider: "Google Analytics",
    purpose: "Used by Google Analytics to persist session state.",
    duration: "2 years",
    type: "HTTP",
  },
  // Marketing
  {
    category: "Marketing",
    name: "_fbp",
    provider: "Meta (Facebook)",
    purpose: "Used by Facebook to deliver advertisements and track visits across websites.",
    duration: "3 months",
    type: "HTTP",
  },
];

const CATEGORY_META = {
  "Strictly Necessary": {
    description:
      "These cookies are essential for the Platform to function. They cannot be disabled. Without them, services such as login, checkout, and KYC onboarding would not work.",
    canDisable: false,
  },
  Functional: {
    description:
      "These cookies enable enhanced functionality such as staying signed in across browser sessions and handling payment redirects. Disabling them may affect your experience.",
    canDisable: true,
  },
  Analytics: {
    description:
      "These cookies help us understand how visitors interact with NestaNg so we can improve the platform. All data is aggregated and anonymised.",
    canDisable: true,
  },
  Marketing: {
    description:
      "These cookies are used to deliver relevant advertisements on third-party platforms. They track your visits across websites.",
    canDisable: true,
  },
};

const CATEGORIES = ["Strictly Necessary", "Functional", "Analytics", "Marketing"];

function CategoryBadge({ category }) {
  const colours = {
    "Strictly Necessary": "bg-emerald-400/15 border-emerald-400/30 text-emerald-300",
    Functional: "bg-blue-400/15 border-blue-400/30 text-blue-300",
    Analytics: "bg-amber-400/15 border-amber-400/30 text-amber-300",
    Marketing: "bg-purple-400/15 border-purple-400/30 text-purple-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
        colours[category] || "bg-white/10 border-white/20 text-white/60"
      }`}
    >
      {category}
    </span>
  );
}

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-20 text-white">
      <div className="max-w-4xl mx-auto px-4 space-y-10">

        {/* ── Header ── */}
        <header className="space-y-3 pt-6">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-300/70">
            NestaNg · Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Cookie Policy
          </h1>
          <p className="text-sm text-white/50">
            Last updated: {LAST_UPDATED} · Nesta Connect Limited
          </p>
          <p className="text-sm text-white/70 max-w-2xl leading-relaxed pt-1">
            This policy explains what cookies and similar technologies NestaNg uses, why
            we use them, and how you can control them. It should be read alongside our{" "}
            <Link to="/privacy" className="underline text-amber-300/80 hover:text-amber-300">
              Privacy Policy
            </Link>
            .
          </p>
        </header>

        {/* ── What are cookies ── */}
        <section className="rounded-3xl border border-white/10 bg-[#0d1017] p-6 md:p-8 space-y-3">
          <h2 className="text-lg font-bold">What are cookies?</h2>
          <p className="text-sm text-white/65 leading-relaxed">
            Cookies are small text files placed on your device when you visit a website.
            We also use similar technologies including <strong className="text-white/80">localStorage</strong>,{" "}
            <strong className="text-white/80">sessionStorage</strong>, and{" "}
            <strong className="text-white/80">IndexedDB</strong> to store data locally on
            your device. In this policy, we refer to all of these collectively as
            "cookies".
          </p>
          <p className="text-sm text-white/65 leading-relaxed">
            Cookies are used to make the Platform work, remember your preferences, and
            help us understand how people use NestaNg so we can improve it.
          </p>
        </section>

        {/* ── Categories ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Cookie categories</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              return (
                <div
                  key={cat}
                  className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge category={cat} />
                    {!meta.canDisable && (
                      <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">
                        Always active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{meta.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Cookie inventory table ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Cookies we use</h2>
          <p className="text-sm text-white/55">
            The table below lists the specific cookies and local storage items currently
            in use on nestanaija.com.
          </p>

          <div className="rounded-3xl border border-white/10 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Category</th>
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Provider</th>
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Purpose</th>
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Duration</th>
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_TABLE.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-amber-300/80 whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={row.category} />
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{row.provider}</td>
                      <td className="px-4 py-3 text-white/55 leading-relaxed">{row.purpose}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{row.duration}</td>
                      <td className="px-4 py-3 text-white/50 font-mono whitespace-nowrap">{row.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {COOKIE_TABLE.map((row, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-amber-300/80 text-sm">{row.name}</span>
                    <CategoryBadge category={row.category} />
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">{row.purpose}</p>
                  <div className="flex gap-4 text-[11px] text-white/40">
                    <span>{row.provider}</span>
                    <span>·</span>
                    <span>{row.duration}</span>
                    <span>·</span>
                    <span className="font-mono">{row.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Managing cookies ── */}
        <section className="rounded-3xl border border-white/10 bg-[#0d1017] p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-bold">Managing your cookie preferences</h2>

          <div className="space-y-3 text-sm text-white/65 leading-relaxed">
            <p>
              <strong className="text-white/85">Cookie banner: </strong>
              When you first visit NestaNg, a consent banner allows you to accept or
              decline optional cookies. You can change your preferences at any time by
              clicking the cookie settings link in the footer.
            </p>
            <p>
              <strong className="text-white/85">Browser settings: </strong>
              Most browsers allow you to refuse cookies or delete cookies already stored
              on your device. Note that blocking strictly necessary cookies will prevent
              the Platform from functioning correctly.
            </p>
            <p>
              <strong className="text-white/85">Google Analytics opt-out: </strong>
              You can prevent Google Analytics from collecting data by installing the{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-amber-300/80 hover:text-amber-300"
              >
                Google Analytics Opt-out Browser Add-on
              </a>
              .
            </p>
            <p>
              <strong className="text-white/85">Meta/Facebook opt-out: </strong>
              You can manage Facebook advertising preferences via{" "}
              <a
                href="https://www.facebook.com/settings/?tab=ads"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-amber-300/80 hover:text-amber-300"
              >
                Facebook Ad Settings
              </a>
              .
            </p>
          </div>
        </section>

        {/* ── Third parties ── */}
        <section className="rounded-3xl border border-white/10 bg-[#0d1017] p-6 md:p-8 space-y-3">
          <h2 className="text-lg font-bold">Third-party cookies</h2>
          <p className="text-sm text-white/65 leading-relaxed">
            Some cookies on NestaNg are set by third parties whose privacy policies govern
            their use. These third parties include Google (Firebase, Analytics), Meta
            (Facebook Pixel), Paystack, and Flutterwave. We do not control these
            third-party cookies and recommend reviewing their respective privacy policies.
          </p>
        </section>

        {/* ── Updates ── */}
        <section className="rounded-3xl border border-white/10 bg-[#0d1017] p-6 md:p-8 space-y-3">
          <h2 className="text-lg font-bold">Changes to this policy</h2>
          <p className="text-sm text-white/65 leading-relaxed">
            We may update this Cookie Policy from time to time. Material changes will be
            notified via the consent banner on your next visit. The "Last updated" date
            at the top of this page always reflects the most recent revision.
          </p>
        </section>

        {/* ── Contact ── */}
        <section className="rounded-3xl border border-amber-400/15 bg-amber-400/5 p-6 md:p-8 space-y-2">
          <h2 className="text-lg font-bold">Contact us</h2>
          <p className="text-sm text-white/65 leading-relaxed">
            If you have questions about our use of cookies, contact our Data Protection
            team at{" "}
            <a
              href="mailto:hello@nestanaija.com"
              className="underline text-amber-300/80 hover:text-amber-300"
            >
              hello@nestanaija.com
            </a>
            . You may also lodge a complaint with the Nigeria Data Protection Commission
            (NDPC) at{" "}
            <a
              href="https://ndpc.gov.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-amber-300/80 hover:text-amber-300"
            >
              ndpc.gov.ng
            </a>
            .
          </p>
        </section>

        {/* ── Back links ── */}
        <div className="flex flex-wrap gap-4 text-sm text-white/40 pt-2">
          <Link to="/privacy" className="hover:text-white/70 underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white/70 underline">Terms of Use</Link>
          <Link to="/cancellation-policy" className="hover:text-white/70 underline">Cancellation Policy</Link>
          <Link to="/" className="hover:text-white/70 underline">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}