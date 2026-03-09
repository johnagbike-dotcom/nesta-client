// src/components/Footer.js
import React from "react";
import { Link } from "react-router-dom";

const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/nestanaija/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61587022831024",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/nesta-naija/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@NestaNaija",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#05070a"/>
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/2348138588058",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.549 4.1 1.512 5.831L.057 23.143a.75.75 0 0 0 .916.911l5.424-1.426A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.001-1.369l-.358-.214-3.718.977.994-3.628-.234-.373A9.818 9.818 0 1 1 12 21.818z"/>
      </svg>
    ),
  },
];

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

          {/* Social icons */}
          <div className="flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-white/40 hover:text-amber-300 transition-colors duration-300"
              >
                {s.icon}
              </a>
            ))}
          </div>

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