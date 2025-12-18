import React from "react";

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#0b0f14] text-white px-4 pt-28 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-amber-300 mb-4">
          Security at Nesta
        </h1>
        <p className="text-lg text-white/70 max-w-2xl">
          Nesta is built as a security-first platform. From encrypted checkouts
          to strict access controls, we design every layer to protect your data,
          your payments, and your stays.
        </p>

        {/* 1. Our Security Principles */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Our Security Principles</h2>
          <p className="text-white/70 leading-relaxed">
            We follow industry best practices for modern web platforms, with a
            focus on confidentiality, integrity, and availability. That means:
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Encrypting data in transit with HTTPS/TLS.</li>
            <li>• Minimising the data we collect and store.</li>
            <li>• Strict access controls for internal tools.</li>
            <li>• Continuous monitoring for unusual or abusive activity.</li>
          </ul>
        </section>

        {/* 2. Data Protection */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Data Protection</h2>
          <p className="text-white/70 leading-relaxed">
            All communication with Nesta is protected using modern encryption
            protocols. We do not store raw card details on our servers; payment
            information is handled by trusted, PCI-DSS compliant providers.
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• All app and dashboard traffic is secured over HTTPS.</li>
            <li>• Sensitive fields are restricted to authorised team members.</li>
            <li>• Access to production systems is audited and role-based.</li>
          </ul>
        </section>

        {/* 3. Payments & Payouts */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Payments &amp; Payouts</h2>
          <p className="text-white/70 leading-relaxed">
            Payments on Nesta are processed through regulated payment gateways
            such as Paystack and Flutterwave. These providers handle card
            tokenisation, fraud checks and secure authorisation.
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Card details never touch Nesta&apos;s database in raw form.</li>
            <li>• Encrypted checkouts with bank-grade security.</li>
            <li>• Payouts to hosts and partners use verified bank accounts.</li>
          </ul>
        </section>

        {/* 4. Account & Login Security */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Account &amp; Login Security</h2>
          <p className="text-white/70 leading-relaxed">
            Your Nesta account is the key to your bookings, listings and
            payouts. We protect it with modern authentication and verification
            flows.
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Phone / OTP sign-in with session management.</li>
            <li>• Optional multi-factor authentication (where enabled).</li>
            <li>• Automatic timeouts and revocation of invalid sessions.</li>
            <li>• Alerts for unusual login or account activity (where applicable).</li>
          </ul>
        </section>

        {/* 5. Platform & Infrastructure Security */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">
            Platform &amp; Infrastructure Security
          </h2>
          <p className="text-white/70 leading-relaxed">
            Nesta runs on modern cloud infrastructure with hardened defaults and
            least-privilege access.
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Access to servers and consoles is restricted and logged.</li>
            <li>• Firestore security rules and API guards protect data access.</li>
            <li>• Regular dependency and security updates on core services.</li>
          </ul>
        </section>

        {/* 6. Incident Response */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Incident Response</h2>
          <p className="text-white/70 leading-relaxed">
            While we work hard to prevent incidents, we also maintain a clear
            response process in case something goes wrong.
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Triage and investigation of security reports.</li>
            <li>• Containment and remediation of confirmed issues.</li>
            <li>• User notifications where required by law or policy.</li>
            <li>• Root cause analysis to prevent future occurrences.</li>
          </ul>
          <p className="text-white/70 leading-relaxed mt-3">
            If you believe you have found a vulnerability or security weakness,
            please contact us at{" "}
            <a
              href="mailto:security@nestanaija.com"
              className="text-amber-300 hover:underline"
            >
              security@nestanaija.com
            </a>{" "}
            with as much detail as possible.
          </p>
        </section>

        {/* 7. Your Role in Security */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Your Role in Security</h2>
          <p className="text-white/70 leading-relaxed">
            Security is a shared responsibility. To help protect your account
            and bookings:
          </p>
          <ul className="mt-3 space-y-2 text-white/70 leading-relaxed">
            <li>• Never share OTP codes or login links with anyone.</li>
            <li>• Only make payments through Nesta&apos;s secure checkout.</li>
            <li>• Be cautious of unsolicited messages asking for personal data.</li>
            <li>• Report suspicious activity immediately to our team.</li>
          </ul>
        </section>

        {/* 8. Contact */}
        <section className="mt-14 border-t border-white/10 pt-8">
          <p className="text-white/60 leading-relaxed">
            For any security-related question, please email{" "}
            <a
              href="mailto:security@nestanaija.com"
              className="text-amber-300 hover:underline"
            >
              security@nestanaija.com
            </a>{" "}
            or contact us via the{" "}
            <a href="/help" className="text-amber-300 hover:underline">
              Help &amp; Support
            </a>{" "}
            page.
          </p>
        </section>
      </div>
    </main>
  );
}
