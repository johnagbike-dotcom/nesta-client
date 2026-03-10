// src/pages/PartnerAgreementPage.js
import React from "react";
import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "June 2025";
const COMPANY = "Nesta Connect Limited";
const RC = "RC-8801447";

const sections = [
  {
    id: "1",
    title: "Definitions",
    content: [
      `In this Agreement: "Authorised Signatory" means the individual with authority to legally bind the Partner; "Booking" means a confirmed reservation made by a Guest through the Platform; "Check-in Date" means the first day of a Guest's Stay; "Commission" means NestaNg's fee as set out in Schedule 1; "Guest" means a user who makes a Booking through the Platform; "KYC" means the enhanced identity and business verification process required by NestaNg; "Net Payout" means the amount payable to the Partner after deduction of Commission and applicable withholding tax; "Partner Portfolio" means the entire collection of Partner Units listed by the Partner on the Platform; "Partner Unit" means each individual Accommodation unit listed by the Partner; "Platform" means the NestaNg website and mobile application operated by Nesta Connect Limited; "SLA" means the Service Level Agreement set out in Schedule 2; "Stay" means the period of a Guest's occupation of a Partner Unit pursuant to a Booking; "Wallet" means the Partner's account balance on the Platform.`,
    ],
  },
  {
    id: "2",
    title: "Appointment and Scope",
    subsections: [
      {
        id: "2.1",
        title: "Appointment",
        content: `Subject to the terms of this Agreement and successful completion of KYC, NestaNg appoints the Partner as a non-exclusive Verified Partner on the NestaNg Platform, granting the Partner the right to list Partner Units and receive Bookings through the Platform.`,
      },
      {
        id: "2.2",
        title: "Non-Exclusivity",
        content: `This Agreement does not grant exclusivity in any geographic area or property category. NestaNg may appoint other Verified Partners and Hosts in the same locations. The Partner is not prohibited from listing on other platforms, provided that doing so does not result in double-bookings on NestaNg.`,
      },
      {
        id: "2.3",
        title: "No Agency",
        content: `The Partner is an independent contractor. Nothing in this Agreement creates a partnership, joint venture, employment, or agency relationship between NestaNg and the Partner. The Partner has no authority to bind NestaNg or represent NestaNg in any dealings with third parties.`,
      },
    ],
  },
  {
    id: "3",
    title: "Eligibility and KYC",
    subsections: [
      {
        id: "3.1",
        title: "Eligibility Requirements",
        content: `To be eligible for Verified Partner status, the Partner must: (a) be a duly incorporated company, registered business, or sole trader registered with the CAC; (b) hold all permits and licences required to operate as a short-stay property manager; (c) have the legal right to list and let each Partner Unit; (d) hold adequate property and public liability insurance for each Partner Unit; and (e) successfully complete and maintain NestaNg's enhanced KYC process.`,
      },
      {
        id: "3.2",
        title: "KYC Documents Required",
        content: `Enhanced KYC for Verified Partners requires: (a) CAC Certificate of Incorporation and current Annual Return; (b) Memorandum and Articles of Association; (c) valid ID for all directors and the Authorised Signatory; (d) BVN and NIN for the Authorised Signatory; (e) company bank account details and a bank reference letter; (f) proof of right to manage each listed property; and (g) sample insurance certificate demonstrating short-stay letting cover.`,
      },
      {
        id: "3.3",
        title: "Ongoing Verification",
        content: `NestaNg may request updated KYC documentation at any time. The Partner must provide updated documents within seven (7) business days of a request. Failure to comply may result in suspension of the Partner Account and all associated Listings.`,
      },
    ],
  },
  {
    id: "4",
    title: "Partner Portfolio and Listings",
    subsections: [
      {
        id: "4.1",
        title: "Listing Standards",
        content: `Each Partner Unit must be listed with full accuracy in accordance with NestaNg's Listing requirements. Partner Units must meet the following minimum standards: professional-quality photographs; complete and accurate amenity list; accurate and up-to-date availability calendar; correct cancellation policy tier; and fully operational facilities (power, water, internet, air conditioning where advertised) at the time of each Stay.`,
      },
      {
        id: "4.2",
        title: "Portfolio Changes",
        content: `The Partner must notify NestaNg in writing through the Platform before: (a) adding a new Partner Unit; (b) permanently removing a Partner Unit; or (c) making any material change to the description, amenities, or pricing structure of an existing Partner Unit.`,
      },
      {
        id: "4.3",
        title: "Calendar Accuracy Obligation",
        content: `The Partner is solely responsible for maintaining real-time availability accuracy across the entire Partner Portfolio. Where the Partner lists on multiple platforms, it must implement a reliable calendar synchronisation mechanism. Double-bookings resulting from calendar mismanagement are not a valid ground for cancellation and will attract the penalties set out in Clause 7.3.`,
      },
      {
        id: "4.4",
        title: "Quality Threshold",
        content: `NestaNg may impose a minimum average Guest rating threshold for continued Verified Partner status. Where any Partner Unit falls below this threshold consistently over a rolling ninety (90) day period, NestaNg may suspend that unit's Listing pending a quality review.`,
      },
    ],
  },
  {
    id: "5",
    title: "Operational Standards and SLA",
    subsections: [
      {
        id: "5.1",
        title: "Service Level Agreement",
        content: `The Partner agrees to comply with the Service Level Agreement set out in Schedule 2, governing response times, check-in readiness, Guest communication standards, and complaint resolution timeframes.`,
      },
      {
        id: "5.2",
        title: "Check-in Standards",
        content: `For each confirmed Booking, the Partner must: (a) ensure the Partner Unit is clean, guest-ready, and fully accessible from the agreed Check-in time; (b) provide the Guest with check-in instructions at least two (2) hours before Check-in; (c) respond to Guest queries within the timeframes in Schedule 2; and (d) resolve any maintenance or utility issue reported during a Stay within four (4) hours of notification.`,
      },
      {
        id: "5.3",
        title: "Operational Contact",
        content: `The Partner must designate a named Operational Contact available by phone and WhatsApp 24/7 for urgent operational matters. The Operational Contact's details must be registered with NestaNg and kept current.`,
      },
      {
        id: "5.4",
        title: "Insurance",
        content: `The Partner must maintain, at its own cost: (a) property insurance covering each Partner Unit for its full replacement value; and (b) public liability insurance with a minimum indemnity limit of ₦10,000,000 per occurrence. Evidence of insurance must be provided to NestaNg upon request and whenever a policy is renewed.`,
      },
    ],
  },
  {
    id: "6",
    title: "Commission and Payouts",
    subsections: [
      {
        id: "6.1",
        title: "Commission Structure",
        content: `NestaNg charges the Partner a Commission on each confirmed Booking at the rate set out in Schedule 1. Commission rates for Verified Partners are negotiated based on portfolio size, occupancy rates, and listing quality, and may differ from the standard Host Commission.`,
      },
      {
        id: "6.2",
        title: "Net Payout",
        content: `The Partner's Net Payout for each Booking is: gross nightly rate × nights, less Commission and applicable withholding tax. Cleaning fees (where separately charged) are passed through in full. The Platform Dashboard displays the real-time Net Payout calculation for each confirmed Booking.`,
      },
      {
        id: "6.3",
        title: "Payout Release and Wallet",
        content: `Net Payouts are credited to the Partner's Wallet as pending balances upon Booking confirmation. Pending balances are released twenty-four (24) hours after the Guest's Check-in Date, subject to no active dispute or complaint. The Partner may submit withdrawal requests for available balances at any time through the Platform.`,
      },
      {
        id: "6.4",
        title: "Withdrawal Processing",
        content: `Withdrawal requests are processed to the Partner's registered and verified company bank account. NestaNg will not process payouts to personal accounts, unverified accounts, or accounts belonging to a third party.`,
      },
      {
        id: "6.5",
        title: "Payout Holds and Clawbacks",
        content: `NestaNg reserves the right to hold or claw back payouts where: (a) a Guest dispute, refund obligation, or complaint is pending; (b) the Partner has made an unjustified cancellation and a refund has been issued; (c) fraudulent or policy-violating conduct is suspected or confirmed; or (d) NestaNg is required to do so by law.`,
      },
      {
        id: "6.6",
        title: "Commission Revision",
        content: `NestaNg may revise the Commission rate with not less than thirty (30) days' written notice. The revised rate applies to Bookings confirmed after the effective date of the revision.`,
      },
      {
        id: "6.7",
        title: "Taxes",
        content: `The Partner is solely responsible for all taxes arising from its rental income, including company income tax, VAT, and local levies. NestaNg may withhold tax at source where required by law.`,
      },
    ],
  },
  {
    id: "7",
    title: "Cancellations",
    subsections: [
      {
        id: "7.1",
        title: "Obligation to Honour Bookings",
        content: `The Partner is under a binding commercial obligation to honour every confirmed Booking. Cancellation of confirmed Bookings is a material breach of this Agreement.`,
      },
      {
        id: "7.2",
        title: "Permitted Cancellation Grounds",
        content: `The Partner may cancel a confirmed Booking without breach only on the grounds set out in NestaNg's Cancellation and Refund Policy. The Partner must notify NestaNg through the Platform immediately and provide supporting documentation.`,
      },
      {
        id: "7.3",
        title: "Cancellation Penalties",
        content: `Unjustified cancellations by the Partner will result in cumulative consequences including: forfeiture of the Booking payout; financial penalties; suspension of affected Listings; and where cancellations reach the termination threshold, termination of this Agreement. Specific penalty amounts are confirmed in writing at onboarding.`,
      },
    ],
  },
  {
    id: "8",
    title: "Data Protection and Confidentiality",
    subsections: [
      {
        id: "8.1",
        title: "Data Protection",
        content: `Each Party agrees to comply with applicable data protection law, including the NDPA and NDPR. Where the Partner processes Guest personal data received from NestaNg, it does so as a Data Processor and must: (a) process Guest data only for the purpose of managing the Booking and Stay; (b) implement appropriate security measures; (c) not share Guest data with any third party without NestaNg's prior written consent; and (d) delete or return Guest data to NestaNg promptly upon request or on termination.`,
      },
      {
        id: "8.2",
        title: "Confidentiality",
        content: `Each Party agrees to keep confidential all non-public information received from the other Party, including Commission rates, pricing strategies, Guest data, and business processes. Confidentiality obligations survive termination for a period of three (3) years.`,
      },
    ],
  },
  {
    id: "9",
    title: "Intellectual Property",
    content: [
      `The Partner grants NestaNg a non-exclusive, royalty-free licence to use, display, and reproduce all photographs, descriptions, and other content submitted for Listings, for the purpose of operating and marketing the Platform. NestaNg's trademarks, logos, and platform intellectual property remain the exclusive property of NestaNg. The Partner may not use NestaNg's brand assets without prior written approval.`,
    ],
  },
  {
    id: "10",
    title: "Term and Termination",
    subsections: [
      {
        id: "10.1",
        title: "Term",
        content: `This Agreement commences on the Commencement Date and continues for an initial term of twelve (12) months, thereafter renewing automatically for successive twelve (12) month periods unless terminated by either Party with thirty (30) days' written notice prior to a renewal date.`,
      },
      {
        id: "10.2",
        title: "Termination for Convenience",
        content: `Either Party may terminate this Agreement by giving thirty (30) days' written notice. During the notice period, the Partner must continue to honour all confirmed Bookings with Check-in dates falling within the notice period.`,
      },
      {
        id: "10.3",
        title: "Termination for Cause",
        content: `NestaNg may terminate this Agreement immediately upon written notice where the Partner: (a) commits a material breach incapable of remedy, or fails to remedy a remediable breach within fourteen (14) days of a breach notice; (b) engages in fraudulent, deceptive, or illegal conduct; (c) becomes insolvent or enters administration; (d) loses its CAC registration or required regulatory authorisations; (e) accumulates cancellations reaching the termination threshold in Clause 7.3; or (f) violates NestaNg's Terms of Use in a manner that poses a risk to Guests or the Platform.`,
      },
      {
        id: "10.4",
        title: "Effect of Termination",
        content: `On termination: all Partner Listings will be removed from the Platform; the Partner must honour all Bookings with Check-in dates within thirty (30) days of the termination date (where termination is not for Guest safety reasons); available Wallet balances will be disbursed within thirty (30) days subject to any holds.`,
      },
    ],
  },
  {
    id: "11",
    title: "Liability and Indemnification",
    subsections: [
      {
        id: "11.1",
        title: "NestaNg's Liability",
        content: `NestaNg's total liability to the Partner shall not exceed the aggregate Net Payouts paid to the Partner in the three (3) calendar months preceding the event giving rise to the claim. NestaNg shall not be liable for any indirect, consequential, or special loss.`,
      },
      {
        id: "11.2",
        title: "Partner's Indemnification",
        content: `The Partner shall indemnify, defend, and hold harmless NestaNg and its directors, officers, and employees from and against any claims, losses, liabilities, damages, costs, and expenses (including legal fees) arising from: (a) any breach of this Agreement by the Partner; (b) any claim by a Guest or third party arising from the condition, safety, or management of any Partner Unit; (c) the Partner's violation of any applicable law; or (d) any data breach caused by the Partner's failure to comply with Clause 8.`,
      },
    ],
  },
  {
    id: "12",
    title: "General Provisions",
    subsections: [
      {
        id: "12.1",
        title: "Entire Agreement",
        content: `This Agreement, including all Schedules, together with NestaNg's Terms of Use, Privacy Policy, and Cancellation and Refund Policy (incorporated by reference), constitutes the entire agreement between the Parties with respect to the subject matter hereof.`,
      },
      {
        id: "12.2",
        title: "Amendments",
        content: `No amendment to this Agreement shall be valid unless made in writing and signed by authorised representatives of both Parties. NestaNg's right to update the Terms of Use (which are incorporated by reference) is governed by the Terms of Use.`,
      },
      {
        id: "12.3",
        title: "Governing Law and Dispute Resolution",
        content: `This Agreement is governed by the laws of the Federal Republic of Nigeria. Any dispute that the Parties cannot resolve informally within thirty (30) days shall be referred to mediation by a mutually agreed mediator. If mediation fails, the dispute shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.`,
      },
      {
        id: "12.4",
        title: "Force Majeure",
        content: `Neither Party shall be in breach of this Agreement for any failure or delay caused by circumstances beyond their reasonable control. A Party invoking force majeure must notify the other Party promptly and take reasonable steps to mitigate the impact.`,
      },
      {
        id: "12.5",
        title: "Notices",
        content: `All formal notices under this Agreement must be in writing and delivered by email to: NestaNg: hello@nestanaija.com / Partner: the email address registered on the Partner Account. Notices are effective on the next business day after transmission.`,
      },
    ],
  },
];

export default function PartnerAgreementPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* HEADER */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Legal · Partners</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">Verified Partner Agreement</h1>
          <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed max-w-2xl">
            This is a commercial agreement between your business and Nesta Connect Limited. An authorised signatory must execute this agreement. Digital acceptance via the Platform constitutes a valid and binding signature.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/40">
            <span>Effective: {EFFECTIVE_DATE}</span>
            <span>·</span>
            <span>{COMPANY} · {RC}</span>
          </div>
        </section>

        {/* PARTIES */}
        <section className="rounded-2xl border border-white/8 bg-[#0c0f16] px-6 py-5 text-sm text-white/70 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60 mb-3">Parties</p>
          <p><span className="text-white/40">Platform Operator:</span> Nesta Connect Limited ({RC}), operating as NestaNg at nestanaija.com</p>
          <p><span className="text-white/40">Verified Partner:</span> The company, registered business, or sole trader that executes this Agreement during NestaNg Partner onboarding</p>
        </section>

        {/* TABLE OF CONTENTS */}
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

        {/* SECTIONS */}
        {sections.map((s) => (
          <section key={s.id} id={`section-${s.id}`}
            className="space-y-4 text-sm leading-relaxed text-white/75 border-b border-white/6 pb-8 last:border-0 scroll-mt-28">
            <h2 className="text-base font-semibold text-white">{s.id}. {s.title}</h2>
            {s.content && s.content.map((p, i) => <p key={i}>{p}</p>)}
            {s.subsections && s.subsections.map((sub) => (
              <div key={sub.id} className="space-y-1.5 pl-4 border-l border-white/8">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">{sub.id} — {sub.title}</p>
                <p>{sub.content}</p>
              </div>
            ))}
          </section>
        ))}

        {/* SCHEDULE 1 */}
        <section id="schedule-1" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5 space-y-3 scroll-mt-28">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Schedule 1</p>
          <h2 className="text-base font-semibold text-white">Commission Structure</h2>
          <p className="text-sm text-white/70">Commission rates for Verified Partners are confirmed in writing at onboarding. The applicable rate for this Partner is negotiated based on portfolio size, occupancy performance, and listing quality.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/70 border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-6 text-white/50 font-medium">Partner Tier</th>
                  <th className="text-left py-2 text-white/50 font-medium">Commission Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6"><td className="py-2 pr-6">Standard Partner</td><td className="py-2">12% of gross nightly rate</td></tr>
                <tr className="border-b border-white/6"><td className="py-2 pr-6">Growth Partner</td><td className="py-2">10% of gross nightly rate</td></tr>
                <tr><td className="py-2 pr-6">Premium Partner</td><td className="py-2">Negotiated at onboarding</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/40">Rates are subject to revision with thirty (30) days' written notice. The rate confirmed at signing applies to all Bookings made under this Agreement.</p>
        </section>

        {/* SCHEDULE 2 */}
        <section id="schedule-2" className="rounded-2xl border border-white/8 bg-[#0c0f16] px-6 py-5 space-y-3 scroll-mt-28">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60">Schedule 2</p>
          <h2 className="text-base font-semibold text-white">Service Level Agreement (SLA)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/70 border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-6 text-white/50 font-medium">Metric</th>
                  <th className="text-left py-2 text-white/50 font-medium">Standard</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Guest message response time", "Within 2 hours (operational hours)"],
                  ["Check-in instruction delivery", "At least 2 hours before Check-in time"],
                  ["Maintenance issue resolution", "Within 4 hours of Guest notification"],
                  ["Complaint acknowledgement", "Within 1 hour of complaint received"],
                  ["Complaint resolution", "Within 24 hours where possible"],
                  ["Operational Contact availability", "24/7 by phone and WhatsApp"],
                  ["Calendar accuracy", "Real-time — no tolerance for avoidable double-bookings"],
                ].map(([metric, standard], i) => (
                  <tr key={i} className="border-b border-white/6 last:border-0">
                    <td className="py-2 pr-6">{metric}</td>
                    <td className="py-2">{standard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FOOTER */}
        <section className="pt-4 text-xs text-white/35 flex flex-wrap gap-4 justify-between items-center">
          <p>© {year} {COMPANY}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/terms" className="hover:text-amber-300 transition-colors">Terms of Use</Link>
            <Link to="/privacy" className="hover:text-amber-300 transition-colors">Privacy Policy</Link>
            <Link to="/cancellation-policy" className="hover:text-amber-300 transition-colors">Cancellation Policy</Link>
          </div>
        </section>

      </div>
    </main>
  );
}