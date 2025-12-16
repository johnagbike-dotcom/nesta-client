// src/pages/Privacy.js
import React from "react";
import { Link } from "react-router-dom";

export default function Privacy() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* HEADER */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">
            PRIVACY
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            Nesta Privacy Policy
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed max-w-2xl">
            This Privacy Policy explains how Nesta collects, uses, stores and
            protects your information when you use our platform. It is designed
            with transparency, security and trust at the centre of your
            experience.
          </p>
        </section>

        {/* SECTION 1 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">1. Who We Are</h2>
          <p>
            Nesta (“we”, “us”, “our”) is a digital platform that connects guests
            with verified hosts and partners offering premium short-stay
            accommodation across Nigeria.  
          </p>
          <p>
            We operate as a technology service provider and facilitate secure
            bookings, payments, communication and identity verification.
          </p>
        </section>

        {/* SECTION 2 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            2. Information We Collect
          </h2>
          <p>We collect information in the following categories:</p>

          <h3 className="font-semibold text-white/90 mt-3">
            a) Information you provide directly
          </h3>
          <ul className="list-disc ml-6 space-y-2">
            <li>Name, email, phone number.</li>
            <li>Profile details such as photo and preferences.</li>
            <li>Booking information (dates, number of guests, special notes).</li>
            <li>
              Host/Partner onboarding information including identity documents,
              bank details, business information and property descriptions.
            </li>
          </ul>

          <h3 className="font-semibold text-white/90 mt-3">
            b) Automatically collected information
          </h3>
          <ul className="list-disc ml-6 space-y-2">
            <li>Device and browser information.</li>
            <li>IP address, location approximation and usage analytics.</li>
            <li>App performance logs and error diagnostics.</li>
          </ul>

          <h3 className="font-semibold text-white/90 mt-3">
            c) Payment information
          </h3>
          <p>
            Payments are processed by secure third-party providers such as
            Paystack or Flutterwave.  
            We do not store full card details. We only receive:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Transaction reference</li>
            <li>Amount paid</li>
            <li>Payment status</li>
          </ul>

          <h3 className="font-semibold text-white/90 mt-3">
            d) Communication & messaging
          </h3>
          <p>
            Messages exchanged between guests and hosts/partners through Nesta
            may be stored to:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Ensure safety</li>
            <li>Resolve disputes</li>
            <li>Improve service quality</li>
          </ul>
        </section>

        {/* SECTION 3 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            3. How We Use Your Information
          </h2>
          <p>We use your information to:</p>

          <ul className="list-disc ml-6 space-y-2">
            <li>Create and manage your Nesta account.</li>
            <li>Facilitate bookings and secure payments.</li>
            <li>
              Verify host/partner identity and ensure property authenticity.
            </li>
            <li>
              Provide customer support and send important notifications.
            </li>
            <li>
              Prevent fraud, enhance safety and enforce platform policies.
            </li>
            <li>
              Improve platform performance, user experience and new features.
            </li>
          </ul>
        </section>

        {/* SECTION 4 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            4. How We Share Information
          </h2>
          <p>Your information may be shared only in the following situations:</p>

          <ul className="list-disc ml-6 space-y-2">
            <li>
              <b>With Hosts/Partners:</b> when you make a booking, key details
              (name, number of guests, check-in dates, etc.) are shared so your
              stay can be prepared.
            </li>
            <li>
              <b>With Payment Providers:</b> to verify and complete transactions.
            </li>
            <li>
              <b>With Government Authorities:</b> when legally required (e.g.
              fraud investigation, court orders).
            </li>
            <li>
              <b>With Service Providers:</b> for analytics, cloud hosting and
              customer support tools.
            </li>
          </ul>

          <p>
            We **never** sell your personal information to advertisers or third
            parties.
          </p>
        </section>

        {/* SECTION 5 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            5. Host & Partner KYC Information
          </h2>
          <p>
            Hosts and partners may be required to submit identity documents and
            property verification materials.  
            These are used strictly for:
          </p>

          <ul className="list-disc ml-6 space-y-2">
            <li>Fraud prevention</li>
            <li>Platform safety</li>
            <li>Compliance with local regulations</li>
            <li>Authenticating property ownership or management rights</li>
          </ul>

          <p>
            Sensitive documents are stored securely and access is tightly
            controlled.
          </p>
        </section>

        {/* SECTION 6 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            6. Data Storage & Retention
          </h2>
          <p>We retain data only as long as necessary:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Bookings: minimum of 6 years (for records & dispute resolution)</li>
            <li>
              Messages: retained for safety, dispute resolution and service
              improvements
            </li>
            <li>Host identity documents: retained while account remains active</li>
          </ul>
        </section>

        {/* SECTION 7 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            7. Your Rights (NDPR / GDPR-Inspired)
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion (where applicable)</li>
            <li>Withdraw consent for marketing</li>
            <li>Request a copy of your data</li>
          </ul>

          <p>
            Requests can be made via{" "}
            <a href="mailto:support@nestaapp.ng" className="underline decoration-amber-400">
              support@nestaapp.ng
            </a>
            .
          </p>
        </section>

        {/* SECTION 8 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            8. Cookies & Tracking
          </h2>
          <p>We use cookies and analytics tools to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Improve app performance</li>
            <li>Personalise your experience</li>
            <li>Understand platform usage trends</li>
          </ul>
          <p>
            You may disable cookies in your browser settings, but certain
            features may not function correctly.
          </p>
        </section>

        {/* SECTION 9 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">9. Security</h2>
          <p>
            We implement robust administrative, technical and physical
            safeguards including:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Encrypted communication (HTTPS)</li>
            <li>Secure Firebase authentication</li>
            <li>Role-based access controls</li>
            <li>Suspicious activity monitoring</li>
            <li>Regular security reviews</li>
          </ul>
          <p>
            No platform can guarantee 100% security, but we continuously improve
            our protections.
          </p>
        </section>

        {/* SECTION 10 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy periodically.  
            Significant changes will be communicated through the app or email.
          </p>
        </section>

        {/* SECTION 11 */}
        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">11. Contact Us</h2>
          <p>For privacy concerns, contact:</p>
          <ul className="space-y-1 text-sm">
            <li>• support@nestaapp.ng</li>
            <li>• legal@nestaapp.ng</li>
          </ul>
        </section>

        <section className="pt-6 border-t border-white/10 text-xs text-white/45">
          <p>© {year} Nesta Connect Ltd — All rights reserved.</p>
        </section>
      </div>
    </main>
  );
}
