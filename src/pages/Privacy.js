// src/pages/PrivacyPage.js
import React from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "June 2025";

function Section({ id, title, children }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-[13px] text-white/70 leading-relaxed">{children}</div>
    </section>
  );
}

function InfoBox({ title, children, tone = "default" }) {
  const cls =
    tone === "amber"
      ? "border-amber-400/25 bg-amber-400/5"
      : tone === "green"
      ? "border-emerald-500/25 bg-emerald-500/5"
      : "border-white/8 bg-[#0c0f16]";
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${cls}`}>
      {title && <h3 className="font-bold text-white text-sm">{title}</h3>}
      <div className="text-[13px] text-white/70 leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

const NAV = [
  "Who we are", "What we collect", "How we use it", "Legal basis",
  "Sharing your data", "International transfers", "Retention",
  "Your rights", "Cookies", "Children", "Changes", "Contact",
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto">

        <header className="mb-10 space-y-3">
          <p className="text-[11px] tracking-[0.24em] text-amber-300/70">
            NestaNg · Legal
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-white/60 text-sm max-w-2xl leading-relaxed">
            Nesta Connect Limited respects your privacy. This policy explains what personal data we
            collect, why we collect it, who we share it with, and what rights you have — in plain
            language and in compliance with Nigeria's NDPR and applicable data protection law.
          </p>
          <p className="text-[12px] text-white/35">Last updated: {LAST_UPDATED}</p>
        </header>

        {/* Quick nav */}
        <nav className="mb-10 flex flex-wrap gap-2">
          {NAV.map((n, i) => (
            <a
              key={i}
              href={`#s${i + 1}`}
              className="px-3 py-1.5 rounded-full text-[12px] border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-400/30 transition-all"
            >
              {n}
            </a>
          ))}
        </nav>

        <div className="space-y-12">

          <Section id="s1" title="1. Who We Are">
            <p>
              Nesta Connect Limited ("<strong className="text-white">Nesta</strong>", "we", "us", "our") is a
              digital accommodation marketplace registered in Nigeria. We operate the NestaNg platform,
              including the website at <strong className="text-white">nestanaija.com</strong> and any associated
              mobile applications.
            </p>
            <p>
              NestaNg is the data controller for personal data collected through the platform. Our
              designated Data Protection Officer can be contacted at{" "}
              <a href="mailto:hello@nestanaija.com" className="text-amber-300 underline underline-offset-2">
                hello@nestanaija.com
              </a>.
            </p>
          </Section>

          <Section id="s2" title="2. What Personal Data We Collect">
            <p>We collect different types of data depending on how you use NestaNg.</p>

            <InfoBox title="Data you give us directly">
              <ul className="list-disc list-inside space-y-1">
                <li>Name, email address, phone number (on registration).</li>
                <li>Profile photo (optional).</li>
                <li>Identity documents submitted during KYC verification (hosts/partners).</li>
                <li>Bank account details provided for payouts (hosts/partners).</li>
                <li>Booking information — dates, guest count, special requests.</li>
                <li>Messages sent via NestaNg's in-app chat.</li>
                <li>Reviews and feedback you submit.</li>
                <li>Complaints, support requests, and correspondence with our team.</li>
              </ul>
            </InfoBox>

            <InfoBox title="Data collected automatically">
              <ul className="list-disc list-inside space-y-1">
                <li>IP address, browser type, device identifiers.</li>
                <li>Pages visited, time on site, click and navigation patterns.</li>
                <li>Geolocation (approximate, for city-based search, where permitted).</li>
                <li>Referral source (how you found NestaNg).</li>
                <li>Cookies and similar tracking technologies (see Section 9).</li>
              </ul>
            </InfoBox>

            <InfoBox title="Data from third parties">
              <ul className="list-disc list-inside space-y-1">
                <li>Identity verification data from KYC providers (BVN/NIN lookup, where applicable).</li>
                <li>Payment data from Paystack and Flutterwave (transaction IDs, masked card details).</li>
                <li>Profile data imported during Google Sign-In (name, email, photo).</li>
              </ul>
            </InfoBox>
          </Section>

          <Section id="s3" title="3. How We Use Your Data">
            <p>We process your personal data for the following purposes:</p>
            <InfoBox>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-white">Creating and managing your account.</strong></li>
                <li><strong className="text-white">Processing bookings</strong> — confirming, managing and modifying reservations.</li>
                <li><strong className="text-white">Processing payments and issuing refunds</strong> through our licensed payment partners.</li>
                <li><strong className="text-white">Verifying host and partner identity</strong> as part of our KYC and onboarding process.</li>
                <li><strong className="text-white">Facilitating communication</strong> between guests and hosts/partners via in-app chat.</li>
                <li><strong className="text-white">Customer support</strong> — responding to queries, complaints and disputes.</li>
                <li><strong className="text-white">Fraud detection and platform safety</strong> — monitoring unusual activity and enforcing our policies.</li>
                <li><strong className="text-white">Improving the platform</strong> — analytics, A/B testing, product development.</li>
                <li><strong className="text-white">Legal compliance</strong> — meeting our obligations under Nigerian and applicable international law.</li>
                <li><strong className="text-white">Marketing</strong> (where you have opted in) — updates, promotions and new features.</li>
              </ul>
            </InfoBox>
            <p>
              We do not sell your personal data to third parties. We do not allow advertisers to
              target you based on your NestaNg activity.
            </p>
          </Section>

          <Section id="s4" title="4. Legal Basis for Processing">
            <p>
              Under Nigeria's NDPR and applicable data protection frameworks, we process your data on
              the following lawful grounds:
            </p>
            <InfoBox>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-white">Contractual necessity</strong> — to provide the booking and accommodation services you request.</li>
                <li><strong className="text-white">Legal obligation</strong> — to comply with NDPR, FCCPA, AML/CFT regulations, and other applicable Nigerian law.</li>
                <li><strong className="text-white">Legitimate interests</strong> — to detect fraud, secure the platform, and improve our service, where those interests are not overridden by your rights.</li>
                <li><strong className="text-white">Consent</strong> — for marketing communications and non-essential cookies. You may withdraw consent at any time.</li>
              </ul>
            </InfoBox>
          </Section>

          <Section id="s5" title="5. Sharing Your Data">
            <p>
              We share personal data only where necessary, with the following categories of
              recipients:
            </p>
            <InfoBox title="Service providers (processors)">
              <ul className="list-disc list-inside space-y-1">
                <li>Payment processors: Paystack, Flutterwave.</li>
                <li>Identity verification providers (KYC).</li>
                <li>Cloud infrastructure and database providers (Firebase / Google Cloud).</li>
                <li>Email and SMS communication providers.</li>
                <li>Analytics platforms (aggregate, anonymised data only).</li>
              </ul>
              <p className="mt-1.5 text-[12px] text-white/45">
                All processors are bound by data processing agreements requiring them to handle
                your data securely and only for specified purposes.
              </p>
            </InfoBox>
            <InfoBox title="Other users of the platform">
              <ul className="list-disc list-inside space-y-1">
                <li>Hosts/partners see your first name and booking details for confirmed stays.</li>
                <li>Guests see host/partner first name, verified status, and response rate.</li>
                <li>Your full address and contact details are only shared with hosts/partners after booking confirmation.</li>
              </ul>
            </InfoBox>
            <InfoBox title="Legal and regulatory disclosure">
              <p>
                We may disclose personal data to law enforcement, regulators or courts where required
                by law, court order, or where we believe disclosure is necessary to protect safety or
                prevent serious harm.
              </p>
            </InfoBox>
          </Section>

          <Section id="s6" title="6. International Data Transfers">
            <p>
              NestaNg primarily stores and processes data within Nigeria. Where data is transferred
              outside Nigeria (e.g., through our cloud infrastructure providers), we ensure
              appropriate safeguards are in place, including standard contractual clauses or
              transfer to countries with an adequate level of data protection as recognised by
              Nigeria's NDPR regulations.
            </p>
          </Section>

          <Section id="s7" title="7. Data Retention">
            <InfoBox>
              <ul className="list-disc list-inside space-y-1.5">
                <li>Account data is retained for the duration of your account plus <strong className="text-white">5 years</strong> for audit and legal compliance purposes.</li>
                <li>Booking records are retained for <strong className="text-white">7 years</strong> to comply with financial record-keeping obligations.</li>
                <li>KYC documents are retained for <strong className="text-white">5 years</strong> from the date of submission, as required by AML/CFT law.</li>
                <li>Chat messages are retained for <strong className="text-white">2 years</strong> after the related booking, for dispute resolution purposes.</li>
                <li>Marketing data is retained until you withdraw consent.</li>
                <li>Deleted accounts: most data is erased within <strong className="text-white">90 days</strong>; legal retention obligations may require us to keep certain records longer.</li>
              </ul>
            </InfoBox>
          </Section>

          <Section id="s8" title="8. Your Rights">
            <p>
              Under Nigeria's NDPR and applicable law, you have the following rights regarding
              your personal data:
            </p>
            <InfoBox>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-white">Right of access</strong> — request a copy of the personal data we hold about you.</li>
                <li><strong className="text-white">Right to rectification</strong> — ask us to correct inaccurate or incomplete data.</li>
                <li><strong className="text-white">Right to erasure</strong> — ask us to delete your data where there is no overriding legal reason to retain it.</li>
                <li><strong className="text-white">Right to restrict processing</strong> — ask us to limit how we use your data in certain circumstances.</li>
                <li><strong className="text-white">Right to object</strong> — object to processing based on legitimate interests or for direct marketing.</li>
                <li><strong className="text-white">Right to data portability</strong> — receive your data in a structured, machine-readable format.</li>
                <li><strong className="text-white">Right to withdraw consent</strong> — where processing is based on consent, withdraw it at any time without affecting prior lawful processing.</li>
              </ul>
            </InfoBox>
            <InfoBox tone="amber">
              <p>
                To exercise any of these rights, email{" "}
                <a href="mailto:hello@nestanaija.com" className="text-amber-300 underline underline-offset-2">
                  hello@nestanaija.com
                </a>{" "}
                with your name, registered email address, and a description of your request. We will
                respond within <strong className="text-amber-200">30 days</strong>. We may request identity
                verification before processing the request.
              </p>
            </InfoBox>
            <p>
              If you believe we have not handled your data appropriately, you may lodge a complaint
              with the Nigeria Data Protection Commission (NDPC) at{" "}
              <a href="https://ndpc.gov.ng" target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-2">
                ndpc.gov.ng
              </a>.
            </p>
          </Section>

          <Section id="s9" title="9. Cookies & Tracking">
            <p>
              NestaNg uses cookies and similar technologies to operate the platform, remember your
              preferences, and analyse usage patterns.
            </p>
            <InfoBox title="Types of cookies we use">
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-white">Strictly necessary</strong> — session management, authentication, security. Cannot be disabled.</li>
                <li><strong className="text-white">Functional</strong> — remembering your preferences (city, language, currency). Optional.</li>
                <li><strong className="text-white">Analytics</strong> — understanding how pages are used to improve the platform. Aggregate and anonymised data only. Optional.</li>
                <li><strong className="text-white">Marketing</strong> — only set where you have explicitly opted in. Not used for third-party ad targeting.</li>
              </ul>
            </InfoBox>
            <p>
              You can manage your cookie preferences in your browser settings or via the cookie
              banner shown on your first visit. Disabling functional or analytics cookies may
              reduce the quality of your experience.
            </p>
          </Section>

          <Section id="s10" title="10. Children's Privacy">
            <p>
              NestaNg is not intended for anyone under the age of 18. We do not knowingly collect
              personal data from children. If we become aware that a child has registered or
              provided data, we will promptly delete it. If you believe a child has used NestaNg,
              please contact{" "}
              <a href="mailto:hello@nestanaija.com" className="text-amber-300 underline underline-offset-2">
                hello@nestanaija.com
              </a>.
            </p>
          </Section>

          <Section id="s11" title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in how we
              process data or changes in applicable law. Where changes are material, we will
              notify you via the platform or by email before they take effect. The "Last updated"
              date at the top of this page always reflects the current version.
            </p>
          </Section>

          <Section id="s12" title="12. Contact">
            <p>Questions, requests, or concerns about this policy:</p>
            <InfoBox tone="amber">
              <p><strong className="text-amber-200">Data Protection Officer</strong></p>
              <p>Nesta Connect Limited</p>
              <a href="mailto:hello@nestanaija.com" className="text-amber-300 underline underline-offset-2">
                hello@nestanaija.com
              </a>
            </InfoBox>
          </Section>

          {/* Related */}
          <div className="flex flex-wrap gap-3 text-sm pt-4 border-t border-white/8">
            <Link to="/terms" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Terms of Use
            </Link>
            <Link to="/cancellation-policy" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Cancellation Policy
            </Link>
            <Link to="/security" className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              Security
            </Link>
            <Link to="/help" className="px-4 py-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 text-amber-200 hover:bg-amber-400/10 transition-all">
              Help Centre →
            </Link>
          </div>

          <p className="text-[11px] text-white/30 pb-4">
            © {new Date().getFullYear()} Nesta Connect Limited — All rights reserved.
          </p>

        </div>
      </div>
    </main>
  );
}