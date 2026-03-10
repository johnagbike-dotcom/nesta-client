// src/pages/HostAgreementPage.js
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
      `In this Agreement: "Accommodation" means the property or unit listed by the Host on the Platform; "Booking" means a confirmed reservation made by a Guest through the Platform; "Check-in Date" means the first day of a Guest's Stay; "Commission" means NestaNg's fee deducted from the gross nightly rate as set out in Schedule 1; "Guest" means a user who makes a Booking through the Platform; "KYC" means the identity and property verification process required by NestaNg; "Listing" means the Host's property listing published on the Platform; "Net Payout" means the amount payable to the Host after deduction of Commission and applicable withholding tax; "Platform" means the NestaNg website and mobile application operated by Nesta Connect Limited; "Stay" means the period of a Guest's occupation of the Accommodation pursuant to a Booking; "Wallet" means the Host's account balance on the Platform.`,
    ],
  },
  {
    id: "2",
    title: "Eligibility and Onboarding",
    subsections: [
      {
        id: "2.1",
        title: "Eligibility Requirements",
        content: `To be eligible to list as a Host on the NestaNg Platform, you must: (a) be at least 18 years of age; (b) be a Nigerian citizen, permanent resident, or holder of a valid permit authorising you to conduct business in Nigeria; (c) have the legal right to let the Accommodation on a short-stay basis — whether as owner, authorised agent, or under a lease that permits subletting; (d) not be a party to any legal proceedings or regulatory action that would prevent you from entering into this Agreement; and (e) successfully complete NestaNg's KYC verification process.`,
      },
      {
        id: "2.2",
        title: "Corporate Hosts",
        content: `Where the Host is a company or other legal entity, the individual accepting this Agreement on its behalf represents and warrants that they have full authority to bind the entity to this Agreement.`,
      },
      {
        id: "2.3",
        title: "Single Host Account",
        content: `Each individual or entity may hold only one Host account. Duplicate accounts will be suspended. If you manage multiple properties professionally, you should apply for a Verified Partner account instead.`,
      },
    ],
  },
  {
    id: "3",
    title: "Identity and Property Verification (KYC)",
    subsections: [
      {
        id: "3.1",
        title: "Mandatory KYC",
        content: `All Hosts must complete NestaNg's KYC process before any Listing may be published or any payout may be received. KYC is a continuing obligation — NestaNg may request updated documentation at any time.`,
      },
      {
        id: "3.2",
        title: "Required Documents",
        content: `KYC requirements include, at minimum: (a) valid government-issued photographic identification (NIN slip, national ID card, international passport, or driver's licence); (b) Bank Verification Number (BVN); (c) proof of address (utility bill, bank statement, or government correspondence dated within 3 months); (d) proof of right to let the Accommodation — Certificate of Occupancy, deed of assignment, tenancy agreement, or signed authorisation letter from the property owner; and (e) clear, current photographs of the Accommodation.`,
      },
      {
        id: "3.3",
        title: "Ongoing Compliance",
        content: `You must notify NestaNg immediately if your right to let the Accommodation changes, expires, or is revoked. Failure to do so constitutes a material breach of this Agreement.`,
      },
      {
        id: "3.4",
        title: "KYC Data",
        content: `KYC documentation is processed in accordance with NestaNg's Privacy Policy and applicable data protection law. Documents are retained for the period required by law and will not be shared with third parties except where required by law or by NestaNg's approved KYC service providers.`,
      },
    ],
  },
  {
    id: "4",
    title: "Listings",
    subsections: [
      {
        id: "4.1",
        title: "Host Responsibility",
        content: `You are solely responsible for the content, accuracy, and currency of your Listing(s). Each Listing must accurately describe the Accommodation as it will appear to Guests at the time of their Stay.`,
      },
      {
        id: "4.2",
        title: "Listing Requirements",
        content: `Each Listing must include: accurate property type, size, location and layout; a complete amenities list; current representative photographs; the correct nightly rate and all additional charges; an accurate and up-to-date availability calendar; the selected cancellation policy tier; all applicable house rules; and any material restrictions affecting a Guest's use of the Accommodation.`,
      },
      {
        id: "4.3",
        title: "Listing Review and Removal",
        content: `All Listings are subject to review and approval by NestaNg before publication. NestaNg reserves the right to reject, suspend, or permanently remove any Listing that violates this Agreement, NestaNg's policies, or applicable law, without prior notice and without liability to the Host.`,
      },
      {
        id: "4.4",
        title: "Pricing",
        content: `You set your own nightly rate and applicable fees. NestaNg does not fix or control pricing, though it may display suggested pricing ranges. You are not obligated to follow any pricing suggestion.`,
      },
      {
        id: "4.5",
        title: "Calendar Accuracy",
        content: `You are responsible for maintaining an accurate availability calendar at all times. Where you list on multiple platforms, you are solely responsible for avoiding double-bookings. A double-booking or calendar error is not a valid ground for cancellation of a confirmed NestaNg Booking.`,
      },
    ],
  },
  {
    id: "5",
    title: "Bookings and Host Obligations",
    subsections: [
      {
        id: "5.1",
        title: "Obligation to Honour Bookings",
        content: `Upon confirmation of a Booking, you are under a binding obligation to: (a) ensure the Accommodation is clean, safe, and fully accessible from the agreed Check-in time; (b) provide accurate and timely check-in instructions; (c) be reachable by the Guest throughout the Stay; (d) honour the amenities, features, and conditions described in the Listing; and (e) comply with all applicable laws relating to short-stay letting.`,
      },
      {
        id: "5.2",
        title: "Guest Communication",
        content: `All material communications with Guests in connection with a Booking must be conducted through the NestaNg Platform messaging system. Off-platform communication is permitted for operational logistics (e.g. sharing access codes) once a Booking is confirmed, but must not be used to solicit off-platform payments.`,
      },
      {
        id: "5.3",
        title: "Host Cancellation",
        content: `You may cancel a confirmed Booking without penalty only on the limited grounds set out in NestaNg's Cancellation and Refund Policy. Unjustified cancellations will result in: (a) forfeiture of your payout for the cancelled Booking; (b) a financial penalty applied against your account; (c) possible suspension or removal of your Listings; and (d) a permanent record of the cancellation on your Host profile.`,
      },
      {
        id: "5.4",
        title: "Property Standards",
        content: `You must maintain the Accommodation to a standard consistent with its Listing description at all times. NestaNg reserves the right to conduct periodic quality reviews and to downgrade, restrict, or remove Listings that consistently fail to meet the standard represented.`,
      },
    ],
  },
  {
    id: "6",
    title: "Commission and Payouts",
    subsections: [
      {
        id: "6.1",
        title: "Commission",
        content: `NestaNg charges a Commission on each confirmed Booking, calculated as a percentage of the gross nightly rate as set out in Schedule 1. NestaNg reserves the right to revise the Commission rate with not less than thirty (30) days' written notice.`,
      },
      {
        id: "6.2",
        title: "Net Payout Calculation",
        content: `Your Net Payout for each Booking is: gross nightly rate × nights, less Commission and applicable withholding tax. Cleaning fees (if charged) are passed through in full to the Host.`,
      },
      {
        id: "6.3",
        title: "Payout Release",
        content: `NestaNg operates a deferred payout model. Your Net Payout will be credited to your NestaNg Wallet as a pending balance upon confirmation of a completed Booking. Pending balances are released to your available balance twenty-four (24) hours after the Guest's Check-in Date, subject to no active dispute or complaint.`,
      },
      {
        id: "6.4",
        title: "Withdrawal",
        content: `Once funds are available in your Wallet, you may submit a withdrawal request through the Platform. Withdrawals are processed to your registered and verified bank account. NestaNg does not transfer payouts to third-party accounts, mobile wallets, or unverified bank accounts.`,
      },
      {
        id: "6.5",
        title: "Payout Holds",
        content: `NestaNg reserves the right to place a hold on your Wallet balance where: (a) a Guest dispute or complaint is pending; (b) there is suspected fraudulent or policy-violating activity; (c) a refund obligation has arisen; or (d) NestaNg is required to do so by law.`,
      },
      {
        id: "6.6",
        title: "Taxes",
        content: `You are solely responsible for all taxes arising from your short-stay rental income, including income tax and VAT where applicable. NestaNg may be required by law to withhold certain taxes at source, in which case the withheld amount will be disclosed to you.`,
      },
    ],
  },
  {
    id: "7",
    title: "Damage and Liability",
    subsections: [
      {
        id: "7.1",
        title: "Guest Damage Claims",
        content: `If a Guest causes damage during a Stay, you must: (a) document the damage with dated photographs within 48 hours of Check-out; (b) submit a damage claim through the Platform within 48 hours of Check-out; and (c) provide supporting evidence including photographs, repair quotes, or receipts. NestaNg will review the claim but is not liable for Guest damage and does not provide a damage guarantee or host protection insurance.`,
      },
      {
        id: "7.2",
        title: "Host's Own Insurance",
        content: `You are strongly recommended to hold appropriate property and public liability insurance covering short-stay letting. NestaNg does not provide any form of insurance to Hosts and shall not be liable for any loss, damage, injury, or harm arising at the Accommodation.`,
      },
      {
        id: "7.3",
        title: "Host Liability to Guests",
        content: `You are responsible for ensuring the Accommodation is safe, habitable, and free from hazards at the time of Check-in. You accept liability for any harm to a Guest caused by your failure to maintain the Accommodation in a safe condition, and agree to indemnify NestaNg against any claim arising therefrom.`,
      },
    ],
  },
  {
    id: "8",
    title: "Host Conduct and Prohibited Activities",
    content: [
      `As a Host, you agree not to: (a) discriminate against any Guest or prospective Guest on grounds of race, ethnicity, religion, gender, disability, sexual orientation, or any other protected characteristic; (b) request or accept payment from any Guest outside the NestaNg Platform; (c) publish a Listing for an Accommodation to which you do not have the legal right to let; (d) publish false, misleading, or materially inaccurate Listing content; (e) offer Guests incentives to leave positive reviews or suppress negative ones; (f) create or operate multiple Host accounts; (g) use the Platform to promote a competing accommodation platform or direct Guests to book elsewhere; or (h) engage in any conduct that is abusive, threatening, or harassing towards any Guest, NestaNg employee, or other Platform user.`,
    ],
  },
  {
    id: "9",
    title: "Term and Termination",
    subsections: [
      {
        id: "9.1",
        title: "Term",
        content: `This Agreement commences on the date you accept it during onboarding and continues until terminated by either Party in accordance with this Clause.`,
      },
      {
        id: "9.2",
        title: "Termination by Host",
        content: `You may terminate this Agreement at any time by closing your Host account through the Platform settings. Termination does not affect confirmed Bookings — you remain obligated to honour all Bookings with Check-in dates falling within thirty (30) days of your termination notice.`,
      },
      {
        id: "9.3",
        title: "Termination by NestaNg",
        content: `NestaNg may suspend or terminate this Agreement and your Host account, with or without notice, where: (a) you have materially breached this Agreement or NestaNg's Terms of Use; (b) you have engaged in fraudulent, illegal, or abusive conduct; (c) your KYC verification has lapsed or been revoked; (d) your Listings are repeatedly cancelled without valid grounds; (e) your Guest reviews consistently reflect failure to meet the standards described in your Listing; or (f) NestaNg is required to do so by law.`,
      },
      {
        id: "9.4",
        title: "Effect of Termination",
        content: `Upon termination: all active Listings will be removed from the Platform; available Wallet balances will be disbursed to your verified bank account within thirty (30) days, subject to any outstanding disputes or holds.`,
      },
    ],
  },
  {
    id: "10",
    title: "Liability and Indemnification",
    subsections: [
      {
        id: "10.1",
        title: "NestaNg's Limitation of Liability",
        content: `NestaNg's liability to you is limited to the Net Payout attributable to the specific Booking giving rise to the claim. NestaNg shall not be liable for any indirect, consequential, or special loss.`,
      },
      {
        id: "10.2",
        title: "Host's Indemnification",
        content: `You agree to indemnify, defend, and hold harmless NestaNg and its directors, officers, and employees from and against any claims, losses, liabilities, damages, costs, and expenses (including reasonable legal fees) arising out of or related to: (a) your breach of this Agreement; (b) your Listing content; (c) any Guest's Stay at your Accommodation; (d) any third-party claim arising from the condition or safety of your Accommodation; or (e) your violation of any applicable law.`,
      },
    ],
  },
  {
    id: "11",
    title: "General Provisions",
    subsections: [
      {
        id: "11.1",
        title: "Relationship of the Parties",
        content: `Nothing in this Agreement creates a partnership, joint venture, agency, franchise, or employment relationship between the Parties. You are an independent operator with no authority to bind NestaNg in any way.`,
      },
      {
        id: "11.2",
        title: "Entire Agreement",
        content: `This Agreement, together with NestaNg's Terms of Use, Privacy Policy, and Cancellation and Refund Policy (all incorporated by reference), constitutes the entire agreement between the Parties regarding your use of the Platform as a Host.`,
      },
      {
        id: "11.3",
        title: "Amendments",
        content: `NestaNg may amend this Agreement with thirty (30) days' written notice. Your continued operation as a Host after the effective date of an amendment constitutes your acceptance of the revised Agreement.`,
      },
      {
        id: "11.4",
        title: "Governing Law and Jurisdiction",
        content: `This Agreement is governed by the laws of the Federal Republic of Nigeria. Any dispute that cannot be resolved informally shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.`,
      },
      {
        id: "11.5",
        title: "Severability",
        content: `If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`,
      },
    ],
  },
];

export default function HostAgreementPage() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* HEADER */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Legal · Hosts</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">Host Agreement</h1>
          <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed max-w-2xl">
            This Agreement governs your relationship with NestaNg as a Host. By completing Host onboarding and checking the acceptance box, you agree to be bound by these terms.
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
          <p><span className="text-white/40">Host:</span> The individual or entity that accepts this Agreement during NestaNg Host onboarding</p>
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
          <p className="text-sm text-white/70">The following Commission rates apply to all Bookings made through the NestaNg Platform by Hosts operating under this Agreement:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/70 border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-6 text-white/50 font-medium">Listing Type</th>
                  <th className="text-left py-2 text-white/50 font-medium">Commission Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6">
                  <td className="py-2 pr-6">Standard Host Listing</td>
                  <td className="py-2">12% of gross nightly rate</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">Featured Host Listing</td>
                  <td className="py-2">10% of gross nightly rate</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/40">Commission rates are subject to revision with thirty (30) days' written notice. The rate applicable to each Booking is the rate in effect at the time of Booking confirmation.</p>
        </section>

        {/* ACCEPTANCE */}
        <section className="rounded-2xl border border-white/8 bg-[#0c0f16] px-6 py-5 space-y-3 text-sm text-white/70">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60 mb-1">Acceptance</p>
          <p>By checking the acceptance box and completing Host onboarding on the NestaNg Platform, the Host confirms that:</p>
          <ul className="space-y-1.5 ml-4">
            {[
              "they have read, understood, and agree to be bound by this Host Agreement;",
              "they have read NestaNg's Terms of Use, Privacy Policy, and Cancellation and Refund Policy;",
              "all information provided during onboarding and KYC is accurate and complete; and",
              "they have the legal right to list the Accommodation(s) on the Platform.",
            ].map((item, i) => (
              <li key={i} className="flex gap-2"><span className="text-amber-400/50 flex-shrink-0">·</span>{item}</li>
            ))}
          </ul>
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