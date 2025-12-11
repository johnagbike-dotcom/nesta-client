// src/pages/ComplaintsPage.js
import React from "react";

export default function ComplaintsPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] text-white pt-20 pb-20 px-4">
      <div className="max-w-4xl mx-auto space-y-14">

        {/* HERO */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-8 py-14 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">
            Guest & Host Assurance
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
            Customer Charter & Dispute Resolution
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/70 leading-relaxed max-w-2xl">
            At Nesta, we believe trust is the foundation of every booking.
            Whether you are a guest, host, or partner, your comfort and confidence 
            matter deeply to us. This charter outlines how we handle concerns, 
            resolve disputes, and uphold fairness across our platform.
          </p>
        </section>

        {/* OUR PROMISE */}
        <section className="space-y-6 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">Our Promise to You</h2>
          <p>
            We are committed to providing a seamless, respectful, and transparent 
            experience for everyone using Nesta. Our Customer Charter outlines 
            the standards we uphold and what you can expect from us at all times.
          </p>

          <ul className="list-disc ml-6 space-y-2">
            <li>We treat every concern with dignity, fairness, and confidentiality.</li>
            <li>We respond promptly and keep you informed throughout the process.</li>
            <li>We conduct all investigations objectively and professionally.</li>
            <li>We work toward peaceful resolution that respects all parties involved.</li>
            <li>Your safety, comfort, and trust guide every decision we make.</li>
          </ul>
        </section>

        {/* WHAT CAN BE REPORTED */}
        <section className="space-y-6 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">Issues You May Report</h2>
          <p className="text-white/70">
            We encourage you to contact us whenever something does not meet our 
            standards. Examples of concerns include:
          </p>

          <ul className="list-disc ml-6 space-y-2">
            <li>Host/partner unresponsiveness or professionalism issues</li>
            <li>Property misrepresentation or inaccurate listing details</li>
            <li>Cleanliness, safety, or access issues</li>
            <li>Payment or refund concerns</li>
            <li>Booking disputes between guests and hosts/partners</li>
            <li>Platform or technical errors affecting your reservation</li>
          </ul>
        </section>

        {/* HOW TO FILE A COMPLAINT */}
        <section className="space-y-6 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            How to Submit a Complaint
          </h2>

          <p>Your comfort and peace of mind matter. You may reach us through any of the following channels:</p>

          <div className="rounded-2xl bg-[#0d1117] border border-white/10 p-6 text-white/80 space-y-3">
            <p>
              <span className="text-white font-semibold">Email:</span>{" "}
              <a href="mailto:support@nestaapp.ng" className="underline decoration-amber-400">
                support@nestaapp.ng
              </a>
            </p>
            <p>
              <span className="text-white font-semibold">In-App:</span>{" "}
              Go to <b>Help & Support → New Complaint</b>.
            </p>
            <p>
              <span className="text-white font-semibold">Response Time:</span>{" "}
              We typically acknowledge complaints within 24 hours and aim for 
              full resolution within 2–5 business days.
            </p>
          </div>
        </section>

        {/* RESOLUTION PROCESS */}
        <section className="space-y-6 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">
            Our Resolution Process
          </h2>

          <ol className="list-decimal ml-6 space-y-3 text-white/70">
            <li>
              <b>Review & Acknowledgement:</b> Our team reads your complaint and 
              acknowledges receipt within 24 hours.
            </li>
            <li>
              <b>Investigation:</b> We gather information from all parties involved — 
              including hosts, partners, and guests.
            </li>
            <li>
              <b>Proposed Resolution:</b> We offer a fair solution, which may include 
              refunds, listing corrections, internal review actions, or mediation.
            </li>
            <li>
              <b>Final Outcome:</b> You receive a clear written summary of the decision 
              and next steps.
            </li>
          </ol>

          <p className="text-xs text-white/50">
            Note: In cases involving safety or misconduct, Neste may suspend or remove 
            listings or users to protect the community.
          </p>
        </section>

        {/* ESCALATION */}
        <section className="space-y-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-xl font-semibold text-white">Escalation Options</h2>

          <p className="text-white/70">
            If you feel a matter requires higher review, you may request 
            escalated handling. Serious unresolved cases may be referred to:
          </p>

          <ul className="list-disc ml-6 space-y-2 text-white/70">
            <li>Nesta Operations Leadership Team</li>
            <li>External mediation (where applicable)</li>
            <li>Regulatory authorities or consumer protection agencies</li>
          </ul>
        </section>

        {/* FINAL */}
        <section className="pt-8 border-t border-white/10 text-xs text-white/45">
          <p>© {year} Nesta Stays — All rights reserved.</p>
        </section>
      </div>
    </main>
  );
}
