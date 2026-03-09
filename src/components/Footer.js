// src/components/Footer.js
import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  const linkClass =
    "text-white/72 transition-all duration-300 hover:text-amber-300 hover:translate-x-[2px]";
  const headingClass =
    "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45";

  return (
    <footer className="relative mt-12 overflow-hidden border-t border-white/10 bg-[#05070a] text-white">
      {/* Soft luxury background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
        <div className="absolute -top-16 left-0 h-40 w-40 rounded-full bg-amber-300/6 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-white/4 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        {/* Top row */}
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand block */}
          <div className="max-w-md">
            <div className="inline-flex items-center">
              <span className="text-[1.35rem] font-semibold tracking-[0.16em] text-amber-400 transition duration-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.22)] hover:drop-shadow-[0_0_10px_rgba(251,191,36,0.42)]">
                NestaNg
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-white/72 md:text-[15px]">
              A curated marketplace for premium apartments, villas and suites
              across Nigeria. Thoughtful stays, hosted by professionals.
            </p>

            <p className="mt-3 text-xs leading-6 text-white/48">
              Product of{" "}
              <span className="font-semibold text-white/78">
                Nesta Connect Limited
              </span>{" "}
              (CAC-registered).
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 text-sm md:grid-cols-3 md:gap-x-20">
            {/* Explore */}
            <div>
              <h3 className={headingClass}>Explore</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/" className={linkClass}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className={linkClass}>
                    Browse stays
                  </Link>
                </li>
                <li>
                  <Link to="/post-ad" className={linkClass}>
                    List your property
                  </Link>
                </li>
                <li>
                  <Link to="/help" className={linkClass}>
                    Help &amp; support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className={headingClass}>Company</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/about" className={linkClass}>
                    About NestaNg
                  </Link>
                </li>
                <li>
                  <Link to="/press" className={linkClass}>
                    Press &amp; media
                  </Link>
                </li>
                <li>
                  <Link to="/careers" className={linkClass}>
                    Careers
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className={linkClass}>
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal & safety */}
            <div>
              <h3 className={headingClass}>Legal &amp; safety</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/terms" className={linkClass}>
                    Terms of use
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className={linkClass}>
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link to="/cancellation-policy" className={linkClass}>
                    Cancellations &amp; refunds
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className={linkClass}>
                    Cookie policy
                  </Link>
                </li>
                <li>
                  <Link to="/trust-and-safety" className={linkClass}>
                    Trust &amp; Safety
                  </Link>
                </li>
                <li>
                  <Link to="/security" className={linkClass}>
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-5 md:mt-10 md:flex-row md:items-center md:justify-between">
          <p className="text-xs tracking-[0.02em] text-white/45">
            © {year} Nesta Connect Limited. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/55">
            <a
              href="mailto:hello@nestanaija.com"
              className="transition-colors duration-300 hover:text-amber-300"
            >
              hello@nestanaija.com
            </a>

            <span className="hidden text-white/20 md:inline">•</span>

            <a
              href="mailto:support@nestanaija.com"
              className="transition-colors duration-300 hover:text-amber-300"
            >
              support@nestanaija.com
            </a>

            <span className="hidden text-white/20 md:inline">•</span>

            <span className="text-white/45">CAC: RC8801447</span>
          </div>
        </div>
      </div>
    </footer>
  );
}