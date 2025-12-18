import React from "react";

export default function TrustPage() {
  return (
    <main className="min-h-screen bg-[#0b0f14] text-white px-4 pt-28 pb-20">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-amber-300 mb-4">
          Trust & Safety
        </h1>
        <p className="text-lg text-white/70 max-w-2xl">
          Safety isn’t a feature — it’s our foundation. Nesta blends modern 
          technology with luxury hospitality to ensure every stay is secure, 
          verified, and worry-free for both guests and hosts.
        </p>

        {/* Section 1 — Our Commitment */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold mb-3">Our Commitment</h2>
          <p className="text-white/70 leading-relaxed">
            Every stay on Nesta is protected by industry-leading safety standards.
            From verified listings to secure payments and identity checks, we build 
            trust into every interaction. Whether you are booking a weekend 
            getaway or hosting your premium apartment, Nesta is designed to keep 
            you safe, supported, and fully informed.
          </p>
        </section>

        {/* Section 2 — Listing Verification */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Verified & Authentic Listings</h2>
          <ul className="space-y-3 text-white/70 leading-relaxed">
            <li>• All listings undergo manual review by our verification team.</li>
            <li>• Hosts and partners must provide government-issued identification.</li>
            <li>• Property images, pricing, and details are quality-checked before going live.</li>
            <li>• Suspicious or duplicate listings are automatically flagged and removed.</li>
          </ul>
        </section>

        {/* Section 3 — Host Authentication */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Host Identity & Compliance</h2>
          <ul className="space-y-3 text-white/70 leading-relaxed">
            <li>• All hosts and partners complete mandatory KYC verification.</li>
            <li>• BVN/NIN verification for Nigerian hosts ensures real identity matching.</li>
            <li>• Hosts must comply with local regulations and property ownership guidelines.</li>
            <li>• Fraud detection systems monitor unusual activity in real time.</li>
          </ul>
        </section>

        {/* Section 4 — Secure Payments */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Secure Payments</h2>
          <p className="text-white/70 leading-relaxed">
            Payments processed through Nesta use bank-grade encryption powered by 
            trusted partners such as Paystack and Flutterwave. Your card details 
            are never stored on Nesta servers. Every transaction is protected with:
          </p>
          <ul className="space-y-3 text-white/70 leading-relaxed mt-3">
            <li>• PCI-DSS compliant payment gateways</li>
            <li>• Encrypted checkouts with HTTPS/TLS security</li>
            <li>• Auto-refund workflows for eligible cancellations</li>
            <li>• Secure wallet-to-bank settlements for hosts</li>
          </ul>
        </section>

        {/* Section 5 — During the Stay */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">During Your Stay</h2>
          <ul className="space-y-3 text-white/70 leading-relaxed">
            <li>• In-app chat ensures secure communication between guest and host.</li>
            <li>• Check-in guides provide verified access instructions.</li>
            <li>• Emergency contact information is available in every booking.</li>
            <li>• Report any issue and our team will intervene promptly.</li>
          </ul>
        </section>

        {/* Section 6 — Guest Protections */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Guest Protection</h2>
          <ul className="space-y-3 text-white/70 leading-relaxed">
            <li>• Your payment is held securely until check-in is confirmed.</li>
            <li>• If a listing is misrepresented, our Remediation Team will assist you immediately.</li>
            <li>• Guests may be eligible for refund under our cancellation policy.</li>
            <li>• Safety-first support available when issues arise.</li>
          </ul>
        </section>

        {/* Section 7 — Host Protection */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Host Protection</h2>
          <ul className="space-y-3 text-white/70 leading-relaxed">
            <li>• Hosts receive confirmed booking notifications and secured payouts.</li>
            <li>• Fraud screening prevents chargeback-prone or suspicious bookings.</li>
            <li>• Detailed booking information helps hosts prepare appropriately.</li>
            <li>• 24/7 support in case of guest misconduct or no-shows.</li>
          </ul>
        </section>

        {/* Section 8 — Safety & Reporting */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-3">Report a Safety Concern</h2>
          <p className="text-white/70 leading-relaxed">
            If you encounter any issue — before, during, or after a stay — please let 
            us know immediately. Reports can be submitted through the Help page, 
            the in-app support button, or by emailing:{" "}
            <a href="mailto:safety@nestanaija.com" className="text-amber-300 hover:underline">
              safety@nestanaija.com
            </a>.
          </p>
        </section>

        {/* Section 9 — Final Note */}
        <section className="mt-14 border-t border-white/10 pt-8">
          <p className="text-white/60 italic">
            Nesta was built with one vision: to redefine premium short-stay living 
            in Nigeria. Trust is the foundation — luxury is the experience.
          </p>
        </section>
      </div>
    </main>
  );
}
