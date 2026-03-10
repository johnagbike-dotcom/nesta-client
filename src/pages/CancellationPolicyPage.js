// src/pages/CancellationPolicyPage.js
import React from "react";
import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "June 2025";
const COMPANY = "Nesta Connect Limited";

const sections = [
  {
    id: "1",
    title: "Preliminary",
    subsections: [
      {
        id: "1.1",
        title: "Purpose and Scope",
        content: `This Cancellation and Refund Policy ("Policy") governs the rights and obligations of Guests, Hosts, and Verified Partners in relation to the cancellation of Bookings and the processing of refunds on the NestaNg Platform operated by Nesta Connect Limited. This Policy applies to all Bookings made through the Platform on or after the Effective Date. Where a Booking was made prior to the Effective Date, the policy applicable at the time of Booking applies.`,
      },
      {
        id: "1.2",
        title: "Relationship to Terms of Use",
        content: `This Policy forms an integral part of NestaNg's Terms of Use. Capitalised terms used in this Policy have the meanings given to them in the Terms of Use unless otherwise defined herein.`,
      },
      {
        id: "1.3",
        title: "Platform's Role",
        content: `NestaNg facilitates the processing of cancellations and refunds as a technology intermediary. NestaNg is not a party to the underlying accommodation agreement between Guests and Accommodation Providers. However, NestaNg sets and enforces the cancellation framework within which Accommodation Providers must operate and may, in defined circumstances, exercise discretion to override standard policy outcomes.`,
      },
    ],
  },
  {
    id: "2",
    title: "Cancellation Policy Tiers",
    subsections: [
      {
        id: "2.1",
        title: "Available Tiers",
        content: `Each Listing on the Platform must designate one of three cancellation policy tiers. The applicable tier is disclosed to Guests on the Listing page and at checkout before payment is made.`,
        table: [
          ["Tier", "Free Cancellation Window", "Partial Refund", "No Refund"],
          ["Flexible", "Up to 24 hrs before check-in — 100% refund", "Less than 24 hrs — 50% of nightly rate", "After check-in"],
          ["Moderate", "Up to 5 days before check-in — 100% refund", "Less than 5 days — 50% of nightly rate", "After check-in"],
          ["Firm", "Up to 14 days before check-in — 100% refund", "7–14 days before — 50% of nightly rate", "Less than 7 days / after check-in"],
        ],
        note: `Refund percentages apply to the nightly rate only. The Platform Fee and cleaning fees are subject to separate treatment under Clauses 7 and 8. The cancellation window is calculated by reference to local time at the Accommodation's location.`,
      },
      {
        id: "2.2",
        title: "Non-Refundable Listings",
        content: `Accommodation Providers may, with NestaNg's approval, designate a Listing as offering a non-refundable rate. Non-refundable rates are typically offered at a discount. Where a Guest selects a non-refundable rate, no refund shall be available in respect of any guest-initiated cancellation, save in the exceptional circumstances set out in Clause 10. Non-refundable designations must be clearly displayed on the Listing page and confirmed at checkout. An Accommodation Provider may not retroactively designate a Booking as non-refundable after payment has been received.`,
      },
    ],
  },
  {
    id: "3",
    title: "Guest Cancellations",
    subsections: [
      {
        id: "3.1",
        title: "Cancellation Process",
        content: `A Guest may cancel a confirmed Booking at any time prior to the commencement of the Stay by submitting a cancellation request through the Platform via the Guest's account dashboard. Verbal or email cancellations are not valid unless directed by NestaNg's support team in writing.`,
      },
      {
        id: "3.2",
        title: "Effective Date of Cancellation",
        content: `A cancellation is effective at the date and time at which the Guest submits the cancellation request through the Platform ("Cancellation Date"). The Cancellation Date is used to determine refund eligibility under Clause 2.1.`,
      },
      {
        id: "3.3",
        title: "Refund Calculation",
        content: `The refund payable to a Guest upon cancellation is determined by the applicable policy tier, the Cancellation Date relative to the Check-in Date, and whether the Accommodation has been accessed. Where a partial refund applies, the retained amount is disbursed to the Accommodation Provider's wallet as a pending balance, subject to the deferred payout rules in the Host or Partner Agreement.`,
      },
      {
        id: "3.4",
        title: "Prohibition on Post-Check-in Refunds",
        content: `Except as provided in Clause 10 (Exceptional Circumstances), no refund shall be available in respect of a cancellation made after the Check-in Date or after the Guest has accessed the Accommodation.`,
      },
      {
        id: "3.5",
        title: "No-Shows",
        content: `A Guest who fails to check in by the agreed time without prior notification to the Accommodation Provider and without a valid cancellation request shall be treated as a no-show. No refund is available for no-shows. The Accommodation Provider is entitled to retain the full nightly rate for the Booking, subject to the applicable policy tier.`,
      },
    ],
  },
  {
    id: "4",
    title: "Host Cancellations",
    subsections: [
      {
        id: "4.1",
        title: "Obligation to Honour Bookings",
        content: `A Host is under a binding obligation to honour every confirmed Booking unless cancellation is expressly permitted by this Policy. Cancellation of a confirmed Booking by a Host is a serious matter that directly harms the Guest and the integrity of the Platform.`,
      },
      {
        id: "4.2",
        title: "Permitted Host Cancellations",
        content: `A Host may cancel a confirmed Booking without penalty only in the following limited circumstances: (a) a major structural, electrical, plumbing, or safety emergency at the Accommodation that makes it uninhabitable for the Booking period; (b) a force majeure event directly preventing access to or use of the Accommodation; (c) a regulatory prohibition, legal restriction, or court order preventing the short-term letting of the Accommodation; (d) the Guest has materially breached the Platform's Terms of Use or house rules in a prior Stay; or (e) the Accommodation has been sold or its ownership transferred in a manner that extinguishes the Host's right to let. In all cases, the Host must notify NestaNg in writing through the Platform before or immediately upon cancellation, with supporting documentation.`,
      },
      {
        id: "4.3",
        title: "Consequences of Unjustified Host Cancellation",
        content: `Where a Host cancels a confirmed Booking other than on the permitted grounds: (a) the Guest is entitled to a full refund of the Total Price, including the Platform Fee; (b) the Host forfeits their payout in respect of the cancelled Booking; (c) NestaNg may apply a cancellation penalty against the Host's account; and (d) repeated cancellations may result in suspension or permanent removal of the Host's account and Listings.`,
      },
      {
        id: "4.4",
        title: "Guest Assistance",
        content: `Where a Host cancellation occurs with less than 72 hours' notice before the Check-in Date, NestaNg will make commercially reasonable efforts to assist the affected Guest in finding comparable alternative accommodation.`,
      },
    ],
  },
  {
    id: "5",
    title: "Verified Partner Cancellations",
    subsections: [
      {
        id: "5.1",
        title: "Enhanced Obligations",
        content: `Verified Partners are professional operators who hold themselves out as providing a consistent, professional accommodation service. Verified Partners are therefore subject to enhanced cancellation obligations beyond those applicable to individual Hosts.`,
      },
      {
        id: "5.2",
        title: "Permitted Partner Cancellations",
        content: `The grounds for permitted cancellation by a Verified Partner are the same as those in Clause 4.2. NestaNg acknowledges that Verified Partners managing large portfolios may encounter unavoidable operational conflicts. NestaNg and each Verified Partner may agree in the Partner Agreement to a maximum annual cancellation rate that will not trigger penalties.`,
      },
      {
        id: "5.3",
        title: "Calendar Accuracy Obligation",
        content: `Verified Partners are solely responsible for maintaining accurate real-time availability across all listed units. A Verified Partner may not cite a double-booking, a calendar synchronisation failure, or a system error as a ground for cancellation unless the Partner can demonstrate that the failure was caused by a verifiable technical fault entirely outside the Partner's control.`,
      },
      {
        id: "5.4",
        title: "Consequences of Unjustified Partner Cancellation",
        content: `In addition to the consequences in Clause 4.3, a Verified Partner who cancels Bookings without valid grounds may be subject to: formal notice of breach of the Verified Partner Agreement; financial clawback of any advanced disbursements; temporary or permanent suspension of all Listings; and termination of the Verified Partner Agreement where cancellations reach the threshold specified therein.`,
      },
      {
        id: "5.5",
        title: "Commission and Payout Impact",
        content: `Where a Guest cancels and a partial nightly rate is retained, the Verified Partner's net payout on that retained amount is calculated as the retained nightly rate minus NestaNg's applicable Platform Fee. Where a Booking is cancelled in full within the free window, no payout is due in respect of that Booking. The Platform Dashboard reflects the applicable payout calculation in real time.`,
      },
    ],
  },
  {
    id: "6",
    title: "Refund Processing",
    subsections: [
      {
        id: "6.1",
        title: "Eligibility Determination",
        content: `Upon receipt of a cancellation request, the Platform will automatically calculate refund eligibility based on the applicable policy tier, the Cancellation Date, and the Booking details. The Platform will notify the Guest and Accommodation Provider of the refund determination.`,
      },
      {
        id: "6.2",
        title: "Refund Method",
        content: `All refunds are processed to the original payment method used by the Guest at checkout. NestaNg does not issue cash refunds or transfer funds to a different payment method or bank account.`,
      },
      {
        id: "6.3",
        title: "Refund Timeline",
        content: `Once a refund is issued by NestaNg, most banks reflect the credit within 5–10 business days. NestaNg does not control the processing times of third-party banks, card networks, or mobile money operators. Where a Guest has not received a refund within fifteen (15) business days, the Guest should first contact their bank before escalating to NestaNg.`,
      },
      {
        id: "6.4",
        title: "Currency",
        content: `Refunds are processed in the same currency as the original transaction. NestaNg does not compensate Guests for exchange rate fluctuations.`,
      },
    ],
  },
  {
    id: "7",
    title: "Platform Fee",
    subsections: [
      {
        id: "7.1",
        title: "Structure",
        content: `NestaNg charges a Platform Fee to Guests in connection with each Booking. The exact amount is disclosed at checkout. The Platform Fee supports NestaNg's payment infrastructure, fraud prevention, customer support, and platform maintenance.`,
      },
      {
        id: "7.2",
        title: "Refundability",
        content: `The Platform Fee is fully refundable where a cancellation is made within the applicable free cancellation window. Where a Booking is cancelled outside the free window, or where a non-refundable rate applies, the Platform Fee is non-refundable. Where a Host or Verified Partner cancels a confirmed Booking without valid grounds, the Platform Fee is refunded to the Guest in full.`,
      },
      {
        id: "7.3",
        title: "Accommodation Provider Fee",
        content: `NestaNg charges Accommodation Providers a commission on each Booking as set out in the Host or Verified Partner account terms. The Accommodation Provider's net payout reflects the Booking amount after deduction of this fee.`,
      },
    ],
  },
  {
    id: "8",
    title: "Cleaning Fees and Supplemental Charges",
    subsections: [
      {
        id: "8.1",
        title: "Cleaning Fees",
        content: `Where an Accommodation Provider charges a cleaning fee, that fee is included in the Total Price. Cleaning fees are fully refundable where a Booking is cancelled within the applicable free window. Where a cancellation occurs after the Stay has commenced and the Accommodation has been prepared for the Guest's arrival, the cleaning fee is non-refundable.`,
      },
      {
        id: "8.2",
        title: "Security Deposits",
        content: `Where an Accommodation Provider requires a security deposit, that deposit is held separately and released to the Guest following the Stay, subject to any deduction for verified damage, missing items, or breach of house rules. Security deposit disputes are governed by NestaNg's dispute resolution process.`,
      },
      {
        id: "8.3",
        title: "Additional Charges",
        content: `Any additional charges agreed between a Guest and an Accommodation Provider outside the Platform (such as late check-out fees, excess occupancy charges, or additional service fees) are not governed by this Policy and are subject solely to the direct agreement between the parties.`,
      },
    ],
  },
  {
    id: "9",
    title: "Booking Modifications",
    subsections: [
      {
        id: "9.1",
        title: "Date Changes",
        content: `A Guest may request a modification to the dates of a confirmed Booking through the Platform. The Accommodation Provider is under no obligation to accept a modification request. Where a modification is accepted: if the modified Booking results in a lower Total Price, a refund of the difference shall be made in accordance with this Policy; if it results in a higher Total Price, the Guest shall pay the additional amount; and the applicable cancellation policy tier remains that of the original Booking.`,
      },
      {
        id: "9.2",
        title: "Effect on Cancellation Windows",
        content: `Where a modification is accepted and new Check-in or Check-out Dates are agreed, the cancellation windows in Clause 2.1 are calculated by reference to the new Check-in Date.`,
      },
    ],
  },
  {
    id: "10",
    title: "Exceptional Circumstances",
    subsections: [
      {
        id: "10.1",
        title: "Scope",
        content: `In defined exceptional circumstances, NestaNg may, at its sole and absolute discretion, provide a refund that departs from the standard outcomes under this Policy. This clause does not create any right or entitlement to an exceptional refund.`,
      },
      {
        id: "10.2",
        title: "Qualifying Circumstances",
        content: `NestaNg may consider exceptional treatment where: (a) the Accommodation is materially different from its Listing description in a way that significantly impairs the Guest's use and enjoyment; (b) the Accommodation contains severe cleanliness, structural, utility, or safety issues at Check-in that are not rectified within a reasonable time; (c) the Accommodation Provider has engaged in misconduct, misrepresentation, or breach of NestaNg's policies; (d) the Guest is unable to travel due to a government-mandated restriction, natural disaster, or force majeure event directly affecting travel to the location; or (e) a medical emergency affecting the Guest or an immediate family member that prevents travel, supported by appropriate documentation.`,
      },
      {
        id: "10.3",
        title: "Process",
        content: `To request exceptional treatment, the Guest must: (a) submit a report to NestaNg via the Complaints page or by email to complaints@nestanaija.com within twenty-four (24) hours of the Check-in Date; (b) provide supporting evidence, which may include photographs, video, medical certificates, or official documentation; and (c) allow NestaNg up to five (5) business days to investigate. NestaNg's determination on exceptional circumstance requests is final and binding within the Platform. Providing false or misleading information constitutes a serious breach of the Terms of Use.`,
      },
      {
        id: "10.4",
        title: "Force Majeure",
        content: `A force majeure event affecting the Platform does not automatically entitle Guests or Accommodation Providers to a refund. Where a force majeure event makes a Stay impossible or illegal, NestaNg will determine a fair resolution on a case-by-case basis.`,
      },
    ],
  },
  {
    id: "11",
    title: "Dispute Resolution",
    subsections: [
      {
        id: "11.1",
        title: "Internal Escalation",
        content: `Where a Guest or Accommodation Provider disputes a refund determination, they may escalate the matter to NestaNg's support team within seven (7) days of the determination. Escalations must be submitted in writing to complaints@nestanaija.com and must include the Booking reference number, the nature of the dispute, and all supporting evidence.`,
      },
      {
        id: "11.2",
        title: "Review Process",
        content: `NestaNg will review the escalation within five (5) business days. Both parties will be contacted for their account of events. NestaNg's final written determination will be issued to both parties and will be binding within the Platform.`,
      },
      {
        id: "11.3",
        title: "Remedies Outside the Platform",
        content: `Nothing in this Policy prevents any party from exercising their rights under applicable Nigerian consumer protection law or from lodging a complaint with the Federal Competition and Consumer Protection Commission (FCCPC). NestaNg's internal determination does not constitute a waiver of any party's legal rights.`,
      },
      {
        id: "11.4",
        title: "Governing Law",
        content: `This Policy is governed by the laws of the Federal Republic of Nigeria. Disputes arising from this Policy that cannot be resolved internally shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.`,
      },
    ],
  },
];

export default function CancellationPolicyPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Legal · Bookings</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">Cancellations &amp; Refund Policy</h1>
          <p className="mt-3 text-sm md:text-base text-white/70 leading-relaxed max-w-2xl">
            A clear, fair and hospitality-driven framework for booking changes and refunds across the NestaNg platform. This Policy forms part of the NestaNg Terms of Use and must be read in conjunction with those terms.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/40">
            <span>Effective: {EFFECTIVE_DATE}</span>
            <span>·</span>
            <span>{COMPANY} · RC-8801447</span>
          </div>
        </section>

        {/* Table of contents */}
        <section className="rounded-2xl border border-white/8 bg-[#0c0f16] px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60 mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6">
            {sections.map((s) => (
              <a key={s.id} href={`#section-${s.id}`}
                className="text-sm text-white/50 hover:text-amber-300 transition-colors py-0.5">
                {s.id}. {s.title}
              </a>
            ))}
          </div>
        </section>

        {/* Policy tiers quick reference */}
        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Quick Reference</p>
          <h2 className="text-base font-semibold text-white">Cancellation Policy Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/70 border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  {["Tier", "Free Cancellation", "Partial Refund (50%)", "No Refund"].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 text-white/50 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Flexible",  "Up to 24 hrs before check-in",   "Less than 24 hrs before",       "After check-in"],
                  ["Moderate",  "Up to 5 days before check-in",   "Less than 5 days before",       "After check-in"],
                  ["Firm",      "Up to 14 days before check-in",  "7–14 days before check-in",     "Less than 7 days / after check-in"],
                  ["Non-Refundable", "None", "None", "All cancellations (save Clause 10)"],
                ].map(([tier, free, partial, none]) => (
                  <tr key={tier} className="border-b border-white/6 last:border-0">
                    <td className="py-2 pr-4 font-semibold text-white/80">{tier}</td>
                    <td className="py-2 pr-4">{free}</td>
                    <td className="py-2 pr-4">{partial}</td>
                    <td className="py-2">{none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/40">Refund percentages apply to the nightly rate only. Platform Fee and cleaning fee treatment: see Clauses 7 and 8.</p>
        </section>

        {/* Sections */}
        {sections.map((s) => (
          <section key={s.id} id={`section-${s.id}`}
            className="space-y-4 text-sm leading-relaxed text-white/75 border-b border-white/6 pb-8 last:border-0 scroll-mt-28">
            <h2 className="text-base font-semibold text-white">{s.id}. {s.title}</h2>
            {s.subsections && s.subsections.map((sub) => (
              <div key={sub.id} className="space-y-2 pl-4 border-l border-white/8">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">{sub.id} — {sub.title}</p>
                <p>{sub.content}</p>
                {sub.note && (
                  <p className="text-xs text-white/40 italic">{sub.note}</p>
                )}
              </div>
            ))}
          </section>
        ))}

        {/* Contact section */}
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-6 py-5 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">12. Contact</p>
          <h2 className="text-base font-semibold text-white">Cancellation &amp; Refund Support</h2>
          <p className="text-sm text-white/70">
            For questions, cancellation support, or to submit a dispute in connection with this Policy, please contact us. Include your booking reference, dates, and a brief explanation to help our team respond promptly.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { label: "General support", email: "support@nestanaija.com" },
              { label: "Complaints & disputes", email: "complaints@nestanaija.com" },
              { label: "Legal notices", email: "hello@nestanaija.com" },
            ].map(({ label, email }) => (
              <div key={email} className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                <p className="text-xs text-white/40 mb-0.5">{label}</p>
                <a href={`mailto:${email}`} className="text-amber-300 hover:underline">{email}</a>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <section className="pt-2 text-xs text-white/35 flex flex-wrap gap-4 justify-between items-center">
          <p>© {year} {COMPANY}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/terms" className="hover:text-amber-300 transition-colors">Terms of Use</Link>
            <Link to="/privacy" className="hover:text-amber-300 transition-colors">Privacy Policy</Link>
            <Link to="/host-agreement" className="hover:text-amber-300 transition-colors">Host Agreement</Link>
            <Link to="/partner-agreement" className="hover:text-amber-300 transition-colors">Partner Agreement</Link>
          </div>
        </section>

      </div>
    </main>
  );
}