// src/pages/Terms.js
import React from "react";
import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "1 April 2025";
const COMPANY = "Nesta Connect Limited";
const RC = "RC-8801447";
const EMAIL_SUPPORT = "support@nestanaija.com";
const EMAIL_LEGAL = "hello@nestanaija.com";

const sections = [
  {
    id: "1",
    title: "About NestaNg & These Terms",
    content: [
      `NestaNg is a curated short-stay marketplace operated by ${COMPANY} (${RC}), a company incorporated under the laws of the Federal Republic of Nigeria ("Nesta", "we", "us", "our"). We connect guests seeking premium short-stay accommodation with independent hosts and verified partners ("Accommodation Providers") across Nigeria.`,
      `These Terms of Use ("Terms") govern your access to and use of the NestaNg website (nestanaija.com), mobile application, and all related services (collectively, the "Platform"). By registering an account, making a booking, or listing a property on the Platform, you confirm that you have read, understood and agree to be bound by these Terms and all policies referenced herein.`,
      `If you do not agree to these Terms, you must not use the Platform. We recommend you save or print a copy of these Terms for your records.`,
    ],
  },
  {
    id: "2",
    title: "Eligibility & Account Registration",
    content: [
      `You must be at least 18 years of age and have the legal capacity to enter into binding contracts under Nigerian law to use the Platform.`,
      `When registering an account, you agree to: (a) provide accurate, current and complete information; (b) maintain and promptly update your account information; (c) keep your password secure and confidential; and (d) accept responsibility for all activity conducted through your account.`,
      `You may not create multiple accounts, share your account credentials, impersonate another person or entity, or use the Platform on behalf of a third party without their explicit authorisation. Nesta reserves the right to suspend or permanently terminate any account that violates these requirements.`,
      `Business or corporate accounts must be registered by an authorised representative of the entity, who warrants that they have authority to bind that entity to these Terms.`,
    ],
  },
  {
    id: "3",
    title: "The NestaNg Platform & Our Role",
    content: [
      `Nesta operates as a marketplace facilitator. We do not own, operate, manage or inspect most listed properties. Each listing is provided by an independent Accommodation Provider, and a direct contractual relationship is formed between the guest and the Accommodation Provider upon confirmation of a booking.`,
      `Nesta's role includes: operating and maintaining the Platform; processing payments on behalf of Accommodation Providers; enforcing platform policies; facilitating dispute resolution; and providing customer support.`,
      `Nesta does not guarantee the accuracy of listings, the conduct of any user, or the suitability of any property for any particular purpose. We are not a party to the underlying accommodation agreement between guest and Accommodation Provider.`,
    ],
  },
  {
    id: "4",
    title: "Bookings, Payments & Fees",
    content: [
      `When you initiate a booking on NestaNg, you submit a binding offer to reserve the selected property at the displayed price. Your booking is confirmed when you receive a written confirmation from Nesta by email.`,
      `All prices displayed on the Platform are in Nigerian Naira (₦) and inclusive of the applicable Nesta service fee unless otherwise stated. The service fee is calculated as a percentage of the accommodation cost and is displayed clearly at checkout before payment is completed.`,
      `Payments are processed by licensed payment service providers operating in Nigeria, currently including Paystack and Flutterwave. By completing a payment, you authorise the collection of the displayed amount from your chosen payment method. Nesta does not store full card details on its servers.`,
      `Accommodation Providers receive their payout — being the booking amount less Nesta's commission and applicable withholding tax — following the completion of a guest's stay, subject to Nesta's payout schedule and any hold periods imposed for dispute resolution or compliance purposes.`,
      `Nesta's commission is deducted automatically at the time of payout. Current commission rates are set out in the Host Agreement and Verified Partner Agreement, as applicable, and may be updated with 30 days' written notice.`,
    ],
  },
  {
    id: "5",
    title: "Cancellations, Refunds & No-Shows",
    hasCancellationLink: true,
    content: [
      `Cancellations and refunds are governed by our Cancellation & Refund Policy, which forms part of these Terms.`,
      `If a guest cancels a confirmed booking, the refund eligibility depends on when the cancellation is made relative to the check-in date, as set out in the Cancellation & Refund Policy.`,
      `If an Accommodation Provider cancels a confirmed booking, the guest will receive a full refund of all amounts paid. Nesta reserves the right to impose penalties on Accommodation Providers for unjustified cancellations, including temporary suspension or removal from the Platform.`,
      `In the event of a no-show (guest fails to check in without prior cancellation), no refund will be issued unless expressly provided for in the applicable cancellation policy.`,
      `If a listed property is significantly different from its description, guests must notify Nesta within 24 hours of check-in. Nesta will investigate and may, at its discretion, provide a partial or full refund.`,
    ],
  },
  {
    id: "6",
    title: "Guest Responsibilities",
    content: [
      `As a guest, you agree to: (a) use the accommodation solely for lawful purposes and in accordance with the Accommodation Provider's house rules; (b) treat the property, its contents and neighbours with respect; (c) not exceed the maximum occupancy stated in the listing; (d) vacate the property by the agreed checkout time; and (e) report any damage, safety issues or concerns promptly to Nesta or the Accommodation Provider.`,
      `You are responsible for any damage caused to a property during your stay beyond normal wear and tear. Nesta may, at its discretion, facilitate a claim by the Accommodation Provider against you for damages, up to the value of the security deposit or as otherwise agreed.`,
      `Guests must not sublet, assign or otherwise transfer their booking to any third party without prior written consent from both the Accommodation Provider and Nesta.`,
    ],
  },
  {
    id: "7",
    title: "Host & Partner Responsibilities",
    content: [
      `By listing a property on NestaNg, you agree to the separate Host Agreement or Verified Partner Agreement (as applicable), which governs your specific obligations, commission structure and payout terms. Those agreements form part of these Terms.`,
      `All Accommodation Providers warrant that: (a) they have the legal right to list and rent the property; (b) all listing information — including descriptions, photographs, amenities and pricing — is accurate and not misleading; (c) the property meets all applicable health, safety and building regulations; (d) all necessary permits, consents and licences required under Nigerian law have been obtained; and (e) any applicable taxes, including income tax and VAT, will be paid.`,
      `Accommodation Providers must honour all confirmed bookings. Repeated or unjustified cancellations may result in delisting, account suspension or financial penalties as set out in the applicable Host or Partner Agreement.`,
    ],
  },
  {
    id: "8",
    title: "Prohibited Conduct",
    content: [
      `You agree not to use the Platform to: (a) engage in any fraudulent, deceptive or misleading activity, including creating false bookings or submitting fraudulent chargebacks; (b) bypass, circumvent or undermine Nesta's fee structure, including soliciting off-platform transactions; (c) harass, threaten, defame or abuse any other user; (d) list, offer or seek accommodation for unlawful purposes; (e) upload, transmit or distribute any malicious code, virus or harmful content; (f) scrape, copy or reproduce Platform content without authorisation; or (g) attempt to gain unauthorised access to Nesta's systems or another user's account.`,
      `Violations may result in immediate account suspension, permanent banning from the Platform, reversal of transactions, and where appropriate, referral to relevant law enforcement authorities.`,
    ],
  },
  {
    id: "9",
    title: "Intellectual Property",
    content: [
      `All content on the Platform — including the NestaNg name, logo, design, text, software, photographs (except where uploaded by users), graphics and compiled data — is the intellectual property of Nesta Connect Limited and is protected under applicable Nigerian and international intellectual property laws.`,
      `By uploading listing photographs or other content to the Platform, you grant Nesta a non-exclusive, royalty-free, worldwide licence to use, display, reproduce and distribute that content solely for the purpose of operating and promoting the Platform. You warrant that you own or have the necessary rights to all content you upload.`,
      `You may not reproduce, republish, distribute or commercially exploit any Platform content without our prior written consent.`,
    ],
  },
  {
    id: "10",
    title: "Privacy & Data",
    hasPrivacyLink: true,
    content: [
      `Your use of the Platform is subject to our Privacy Policy, which explains how we collect, use, store and protect your personal data in accordance with the Nigeria Data Protection Act 2023. By using the Platform, you consent to the data practices described in the Privacy Policy.`,
    ],
  },
  {
    id: "11",
    title: "Disclaimers & Limitation of Liability",
    content: [
      `The Platform is provided on an "as is" and "as available" basis. To the fullest extent permitted by Nigerian law, Nesta makes no warranties — express or implied — regarding the Platform's accuracy, reliability, availability or fitness for a particular purpose.`,
      `Nesta shall not be liable for: (a) any indirect, incidental, special or consequential loss arising from your use of the Platform; (b) the acts or omissions of any Accommodation Provider, including property condition, injury, theft or damage during a stay; (c) any interruption, suspension or termination of the Platform; or (d) any loss of data or unauthorised access to your account resulting from your own failure to maintain account security.`,
      `Where liability cannot be excluded by law, Nesta's total aggregate liability to any user in connection with any claim arising from these Terms shall not exceed the total amount paid by that user for the specific booking in question, or ₦100,000 (whichever is lower).`,
    ],
  },
  {
    id: "12",
    title: "Indemnification",
    content: [
      `You agree to indemnify, defend and hold harmless Nesta Connect Limited, its directors, officers, employees and agents from and against any claims, liabilities, damages, losses, costs and expenses (including reasonable legal fees) arising from: (a) your use of the Platform in breach of these Terms; (b) your violation of any applicable law or third-party right; (c) any content you submit to the Platform; or (d) any dispute between you and another user.`,
    ],
  },
  {
    id: "13",
    title: "Force Majeure",
    content: [
      `Nesta shall not be held liable for any failure or delay in performing its obligations under these Terms to the extent such failure or delay is caused by circumstances beyond our reasonable control, including but not limited to: acts of God, natural disasters, government actions, civil unrest, power or internet outages, pandemics, or failure of third-party service providers.`,
      `In such circumstances, guests and Accommodation Providers are encouraged to communicate directly and reach a mutually agreed resolution. Nesta will provide reasonable assistance where possible.`,
    ],
  },
  {
    id: "14",
    title: "Termination & Suspension",
    content: [
      `You may close your account at any time by contacting us at ${EMAIL_SUPPORT}. Upon closure, any pending bookings will be subject to our standard cancellation policy.`,
      `Nesta reserves the right to suspend or permanently terminate your access to the Platform at any time, with or without notice, if we reasonably believe you have violated these Terms, engaged in fraudulent or harmful activity, or where required by law.`,
      `Upon termination, your right to use the Platform ceases immediately. Provisions that by their nature should survive termination — including sections on liability, indemnification, intellectual property and dispute resolution — shall continue to apply.`,
    ],
  },
  {
    id: "15",
    title: "Dispute Resolution & Governing Law",
    content: [
      `In the event of a dispute between a guest and an Accommodation Provider, both parties are encouraged to first attempt resolution directly and in good faith. If unsuccessful, either party may escalate the matter to Nesta by contacting ${EMAIL_SUPPORT} with full details of the dispute.`,
      `Nesta will review the matter and may, at its discretion, facilitate a resolution, make a determination, or withhold or release funds as appropriate. Nesta's determination on platform-related matters shall be final, subject to applicable Nigerian law.`,
      `These Terms and any disputes arising from them shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. The parties submit to the exclusive jurisdiction of the courts of Lagos State, Nigeria.`,
    ],
  },
  {
    id: "16",
    title: "Changes to These Terms",
    content: [
      `Nesta may update these Terms from time to time to reflect changes in our services, business practices or applicable law. We will notify users of material changes by posting an updated version on the Platform and, where appropriate, by email notification.`,
      `Your continued use of the Platform after the effective date of any updated Terms constitutes your acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the Platform.`,
    ],
  },
  {
    id: "17",
    title: "Contact & Legal Notices",
    isContact: true,
    content: [`For questions about these Terms or to serve legal notices, please contact us at:`],
  },
];

export default function Terms() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* HEADER */}
        <section className="rounded-3xl border border-white/10 bg-[#0a0e14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Legal</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">Terms of Use</h1>
          <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed max-w-2xl">
            These Terms govern your use of the NestaNg platform. By creating an account, making a booking or listing a property, you agree to be bound by them. Please read carefully.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/40">
            <span>Effective: {EFFECTIVE_DATE}</span>
            <span>·</span>
            <span>{COMPANY} · {RC}</span>
          </div>
        </section>

        {/* TABLE OF CONTENTS */}
        <section className="rounded-2xl border border-white/8 bg-[#0c0f16] px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60 mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#section-${s.id}`}
                className="text-sm text-white/50 hover:text-amber-300 transition-colors py-0.5"
              >
                {s.id}. {s.title}
              </a>
            ))}
          </div>
        </section>

        {/* SECTIONS */}
        {sections.map((s) => (
          <section
            key={s.id}
            id={`section-${s.id}`}
            className="space-y-3 text-sm leading-relaxed text-white/75 scroll-mt-28 border-b border-white/6 pb-8 last:border-0"
          >
            <h2 className="text-base font-semibold text-white">
              {s.id}. {s.title}
            </h2>

            {s.hasCancellationLink ? (
              <>
                <p>
                  Cancellations and refunds are governed by our{" "}
                  <Link to="/cancellation-policy" className="underline decoration-amber-400/50 hover:text-amber-300 transition-colors">
                    Cancellation &amp; Refund Policy
                  </Link>
                  , which forms part of these Terms.
                </p>
                {s.content.slice(1).map((p, i) => <p key={i}>{p}</p>)}
              </>
            ) : s.hasPrivacyLink ? (
              <>
                <p>{s.content[0]}</p>
                <p>
                  Our Privacy Policy is available at{" "}
                  <Link to="/privacy" className="underline decoration-amber-400/50 hover:text-amber-300 transition-colors">
                    nestanaija.com/privacy
                  </Link>.
                </p>
              </>
            ) : s.isContact ? (
              <>
                <p>{s.content[0]}</p>
                <div className="rounded-2xl border border-white/8 bg-[#0c0f16] px-5 py-4 space-y-2 text-sm text-white/65 mt-2">
                  <p><span className="text-white/35 w-24 inline-block">Company:</span> {COMPANY} ({RC})</p>
                  <p><span className="text-white/35 w-24 inline-block">Email:</span> <a href={`mailto:${EMAIL_LEGAL}`} className="text-amber-300/80 hover:text-amber-300 transition-colors">{EMAIL_LEGAL}</a></p>
                  <p><span className="text-white/35 w-24 inline-block">Support:</span> <a href={`mailto:${EMAIL_SUPPORT}`} className="text-amber-300/80 hover:text-amber-300 transition-colors">{EMAIL_SUPPORT}</a></p>
                  <p><span className="text-white/35 w-24 inline-block">Jurisdiction:</span> Lagos State, Federal Republic of Nigeria</p>
                </div>
              </>
            ) : (
              s.content.map((p, i) => <p key={i}>{p}</p>)
            )}
          </section>
        ))}

        {/* PAGE FOOTER */}
        <section className="pt-4 text-xs text-white/35 flex flex-wrap gap-4 justify-between items-center">
          <p>© {year} {COMPANY}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-amber-300 transition-colors">Privacy Policy</Link>
            <Link to="/cancellation-policy" className="hover:text-amber-300 transition-colors">Cancellation Policy</Link>
            <Link to="/cookie-policy" className="hover:text-amber-300 transition-colors">Cookie Policy</Link>
          </div>
        </section>

      </div>
    </main>
  );
}