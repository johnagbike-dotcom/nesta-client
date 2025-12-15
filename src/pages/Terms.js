// src/pages/Terms.js
import React from "react";
import { Link } from "react-router-dom";

export default function Terms() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* HEADER */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">
            LEGAL
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            Terms of Use
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed max-w-2xl">
            These Terms explain how Nesta operates, what guests, hosts and
            partners can expect, and the responsibilities involved in using
            the platform. Please read them carefully — using Nesta means you
            agree to these Terms.
          </p>
        </section>

        {/* SECTION 1 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">1. About Nesta</h2>
          <p>
            Nesta is a digital platform that connects guests with independent
            hosts and partners offering short-stay accommodation across Nigeria.
            Nesta does not own or operate most listed properties. Each stay is
            provided directly by the host or partner (“Accommodation Provider”),
            and you enter into a separate agreement with them when you book.
          </p>
          <p>
            Nesta operates the website and app, manages payments, provides
            communication tools, enforces policies, and ensures the platform is
            safe, curated and trustworthy.
          </p>
        </section>

        {/* SECTION 2 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">2. Eligibility & Accounts</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>You must be at least 18 years old to use Nesta.</li>
            <li>
              You are responsible for keeping your account secure and ensuring
              the information you provide is accurate.
            </li>
            <li>
              You agree not to create multiple accounts, impersonate others, or
              use the platform for fraudulent activity.
            </li>
          </ul>
        </section>

        {/* SECTION 3 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">3. Bookings & Payments</h2>
          <p>When booking a stay on Nesta, you agree to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>The pricing shown at checkout, including service fees.</li>
            <li>
              The cancellation and refund policy displayed on the listing and
              detailed in our{" "}
              <Link
                to="/cancellation-policy"
                className="underline decoration-amber-400"
              >
                Refund & Cancellation Policy
              </Link>.
            </li>
            <li>
              Providing accurate guest information, including check-in names and
              arrival details when requested.
            </li>
            <li>
              Ensuring your method of payment is authorised and valid at the
              time of booking.
            </li>
          </ul>
          <p className="mt-2">
            Payments on Nesta are processed in partnership with licensed payment
            providers in Nigeria. In the event of a dispute, Nesta may hold,
            release or refund funds in accordance with our policies.
          </p>
        </section>

        {/* SECTION 4 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">4. Responsibilities of Guests</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Respect the property, neighbours and building rules.</li>
            <li>
              Provide accurate check-in information and communicate promptly with
              hosts or partners when issues arise.
            </li>
            <li>
              Avoid activities that may cause damage, nuisance, or violate the
              law.
            </li>
            <li>
              Report safety or access issues immediately through the app or via
              email.
            </li>
          </ul>
        </section>

        {/* SECTION 5 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">5. Responsibilities of Hosts & Partners</h2>
          <p>By listing on Nesta, Hosts and Partners agree to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              Provide accurate listing descriptions, photos and pricing.
            </li>
            <li>
              Ensure the accommodation is clean, safe and available for the
              booked dates.
            </li>
            <li>
              Respond to guest enquiries promptly and professionally.
            </li>
            <li>
              Comply with local regulations, including taxes and building codes.
            </li>
            <li>
              Honour bookings unless cancellations are permitted by policy.
            </li>
          </ul>
        </section>

        {/* SECTION 6 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">6. Behaviour, misuse & prohibited activity</h2>
          <p>You agree not to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Create fraudulent bookings or chargebacks.</li>
            <li>Use Nesta to bypass or avoid fees.</li>
            <li>Harass, threaten or abuse other users.</li>
            <li>List unsafe, illegal or misrepresented spaces.</li>
            <li>Interfere with data, security or platform operations.</li>
          </ul>
          <p>
            Nesta may suspend or remove accounts involved in unsafe,
            unprofessional or fraudulent activity.
          </p>
        </section>

        {/* SECTION 7 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">7. Cancellations, Refunds & No-Shows</h2>
          <p>
            Guests and hosts must follow the cancellation rules shown during the
            booking process. Refund eligibility is also governed by our{" "}
            <Link
              to="/cancellation-policy"
              className="underline decoration-amber-400"
            >
              Refund & Cancellation Policy
            </Link>
            .
          </p>
          <p>
            If a host fails to provide access or the listing is significantly
            misrepresented, Nesta may step in to review the situation and
            facilitate a fair resolution.
          </p>
        </section>

        {/* SECTION 8 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">8. Liability</h2>
          <p>
            Nesta is not responsible for property conditions, personal injuries,
            losses or damages that occur during a stay, except where required by
            Nigerian law. Hosts and partners are solely responsible for their
            accommodation and compliance with legal requirements.
          </p>
          <p>
            To the fullest extent permitted by law, Nesta’s liability is limited
            to the total amount paid by the guest for the specific booking in
            question.
          </p>
        </section>

        {/* SECTION 9 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">9. Changes to Terms</h2>
          <p>
            Nesta may update these Terms periodically. Continued use of the
            platform indicates acceptance of the updated Terms. Major changes
            will be communicated on the platform.
          </p>
        </section>

        {/* SECTION 10 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">10. Contact</h2>
          <p className="text-white/80">
            If you have questions about these Terms, contact us at:
          </p>
          <ul className="space-y-1 text-sm">
            <li>• support@nestaapp.ng</li>
            <li>• partners@nestaapp.ng</li>
          </ul>
        </section>

        <section className="pt-6 border-t border-white/10 text-xs text-white/45">
          <p>© {year} Nesta Stays — All rights reserved.</p>
        </section>
      </div>
    </main>
  );
}
