// src/components/Footer.js
import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-white/10 bg-[#05070a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {/* Top row: brand + nav */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-sm space-y-2">
            <div className="text-xl font-semibold tracking-[0.2em] uppercase text-amber-300">
              NESTA
            </div>
            <p className="text-sm text-white/70">
              A curated marketplace for premium apartments, villas and suites
              across Nigeria. Thoughtful stays, hosted by professionals.
            </p>
            <p className="text-xs text-white/50 mt-2">
              Product of{" "}
              <span className="font-semibold">Nesta Luxury Stays Ltd</span>{" "}
              (CAC-registered).
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-6 text-sm md:grid-cols-3">
            {/* Explore */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60 mb-2">
                Explore
              </h3>
              <ul className="space-y-1.5 text-white/75">
                <li>
                  <Link
                    to="/"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/explore"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Browse stays
                  </Link>
                </li>
                <li>
                  <Link
                    to="/post-ad"
                    className="hover:text-amber-300 transition-colors"
                  >
                    List your property
                  </Link>
                </li>
                <li>
                  <Link
                    to="/help"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Help &amp; support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60 mb-2">
                Company
              </h3>
              <ul className="space-y-1.5 text-white/75">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-amber-300 transition-colors"
                  >
                    About Nesta
                  </Link>
                </li>
                <li>
                  <Link
                    to="/press"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Press &amp; media
                  </Link>
                </li>
                <li>
                  <Link
                    to="/careers"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal & safety */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60 mb-2">
                Legal &amp; safety
              </h3>
              <ul className="space-y-1.5 text-white/75">
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Terms of use
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cancellation-policy"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Cancellations &amp; refunds
                  </Link>
                </li>
                <li>
                  <Link
                    to="/trust-and-safety"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Trust &amp; Safety
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="hover:text-amber-300 transition-colors"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider row */}
        <div className="mt-6 border-t border-white/10 pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left */}
          <p className="text-xs text-white/50">
            © {year} Nesta Connect Limited. All rights reserved.
          </p>

          {/* Right – contact & CAC */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
            <span>
              Email:{" "}
              <a
                href="mailto:hello@nestaapp.ng"
                className="hover:text-amber-300"
              >
                hello@nestaapp.ng
              </a>
            </span>
            <span className="hidden md:inline-block">•</span>
            <span>
              Support:{" "}
              <a
                href="mailto:support@nestaapp.ng"
                className="hover:text-amber-300"
              >
                support@nestaapp.ng
              </a>
            </span>
            <span className="hidden md:inline-block">•</span>
            <span>CAC: RC8801447.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
