// src/pages/CancellationPolicyPage.js
import React from "react";

export default function CancellationPolicy() {
  return (
    <main className="min-h-screen bg-[#05070a] text-white px-4 pb-16 pt-24">
      <div className="mx-auto max-w-4xl">

        {/* Heading */}
        <header className="mb-8">
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            NESTA • CANCELLATIONS & REFUNDS
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            Cancellations & Refund Policy
          </h1>
          <p className="mt-2 text-white/70 text-sm md:text-base max-w-2xl">
            A clear, fair and hospitality-driven framework for booking changes and refunds across the Nesta platform.
          </p>
        </header>

        {/* Section 1 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">1. General Principles</h2>
          <p className="text-white/70 leading-relaxed">
            Every stay listed on Nesta is managed by a Host or Verified Partner. 
            Because each property is unique, cancellation terms may differ across listings. 
            However, all cancellation policies must comply with Nesta’s platform standards, 
            and all refunds must be processed securely through our approved payment providers.
          </p>
        </section>

        {/* Section 2 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">
            2. How Cancellations Work
          </h2>
          <p className="text-white/70 leading-relaxed mb-3">
            Guests may request a cancellation directly from their booking page by selecting{" "}
            <strong>“Request cancel”</strong>. Requests are reviewed by the Host or Verified Partner, 
            who will respond in line with the applicable policy and any local regulations.
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-2">
            <p>
              • You will receive email or in-app confirmation once your request is reviewed.
            </p>
            <p>
              • Refund eligibility depends on the booking’s cancellation window and the Host’s conditions.
            </p>
            <p>
              • If a booking has already started, refunds are generally not permitted unless exceptional circumstances apply.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">3. Refund Eligibility</h2>

          <p className="text-white/70 leading-relaxed mb-3">
            Refunds may apply in the following situations, subject to the Host’s cancellation rules:
          </p>

          <ul className="list-disc pl-5 space-y-1 text-white/75 text-sm">
            <li>Cancellation within the free-cancellation window (if provided by the Host).</li>
            <li>Cancellation made before check-in where partial refund terms apply.</li>
            <li>A Host or Partner cancels the booking for operational or availability reasons.</li>
            <li>Verified issues at check-in that significantly prevent access or safe use of the property.</li>
          </ul>

          <p className="text-white/60 mt-3 text-sm">
            In all cases, refund amounts are calculated based on the service fee, nightly rate, 
            cleaning fee (if applicable), and any non-refundable components disclosed at booking.
          </p>
        </section>

        {/* Section 4 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">
            4. Refund Timelines
          </h2>
          <p className="text-white/70 leading-relaxed mb-3">
            Once approved, refunds are processed securely through our payment partners.
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-2">
            <p>• Most banks reflect refunds within <strong>5–10 business days</strong>.</p>
            <p>• Refund speed may vary depending on your bank, card issuer or mobile money provider.</p>
            <p>• Nesta does not control bank processing times after a refund is issued.</p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">
            5. Non-Refundable Stays
          </h2>
          <p className="text-white/70 leading-relaxed">
            Some listings offer discounted or promotional rates that are strictly non-refundable. 
            These conditions are displayed clearly before booking. By completing such a booking, 
            guests acknowledge that refunds will not be available unless required by law or safety considerations.
          </p>
        </section>

        {/* Section 6 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">6. Exceptional Circumstances</h2>
          <p className="text-white/70 leading-relaxed mb-3">
            In rare cases involving safety, access issues, or unforeseeable events, Nesta may support 
            resolution beyond the standard policy. This includes:
          </p>

          <ul className="list-disc pl-5 text-white/75 text-sm space-y-1">
            <li>Property is materially different from the listing.</li>
            <li>Severe cleanliness, utility, or safety issues at check-in.</li>
            <li>Host misconduct, misrepresentation, or breach of policy.</li>
            <li>Force majeure events preventing travel or access.</li>
          </ul>

          <p className="text-white/60 mt-3 text-sm">
            Verification is required, and supporting documents may be requested.
          </p>
        </section>

        {/* Section 7 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">7. Service Fees</h2>
          <p className="text-white/70 leading-relaxed">
            Nesta’s service fee supports platform security, customer support, and payment operations. 
            Service fees may be refundable or non-refundable depending on the stage and nature of the cancellation. 
            This will always be communicated clearly during resolution.
          </p>
        </section>

        {/* Section 8 */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">8. How to Request Refund Support</h2>

          <p className="text-white/70 leading-relaxed mb-3">
            If you believe you qualify for a refund or if your cancellation request is time-sensitive, 
            you may contact our support team directly:
          </p>

          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100 space-y-1">
            <p>For refund or cancellation support:</p>
            <p>
              Email:{" "}
              <a
                href="mailto:support@nestanaija.com"
                className="underline text-amber-200"
              >
                support@nestanaija.com
              </a>
            </p>
            <p>
              Serious concerns:{" "}
              <a
                href="mailto:complaints@nestanaija.com"
                className="underline text-amber-200"
              >
                complaints@nestanaija.com
              </a>
            </p>
          </div>

          <p className="text-white/50 text-xs mt-3">
            Please include booking reference, dates, and a brief explanation to help our team respond promptly.
          </p>
        </section>

      </div>
    </main>
  );
}
