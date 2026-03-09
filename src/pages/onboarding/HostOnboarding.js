// src/pages/onboarding/HostOnboarding.js
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";

// ─── Agreement version — bump this when the Host Agreement is updated ────────
const HOST_AGREEMENT_VERSION = "v1.0";

// ─── Firestore helper: record acceptance ─────────────────────────────────────
async function recordAgreementAcceptance(uid, type, version, extra = {}) {
  const ref = doc(db, "users", uid, "agreements", type);
  await setDoc(ref, {
    agreementType: type,
    version,
    acceptedAt: serverTimestamp(),
    method: "checkbox",
    ...extra,
  }, { merge: true });
}

// ─── Host Agreement Modal ─────────────────────────────────────────────────────
function HostAgreementModal({ onAccept, onClose, saving }) {
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setScrolled(true);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0d1017] border border-white/10 shadow-[0_32px_100px_rgba(0,0,0,0.85)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/70 mb-1">NestaNg · Host onboarding</p>
            <h2 className="text-lg font-black tracking-tight text-white">Host Agreement</h2>
            <p className="text-xs text-white/50 mt-0.5">Version {HOST_AGREEMENT_VERSION} · Please read before continuing</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-white/80 leading-relaxed"
        >
          <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
            This agreement is legally binding. By accepting, you confirm you have read and understood all terms.
          </p>

          {[
            {
              title: "1. Your obligations as a Host",
              body: "You must honour all confirmed Bookings, maintain your Accommodation in a clean and safe condition, provide accurate Listing information at all times, and comply with all applicable Nigerian laws relating to short-stay letting. You are responsible for holding any permits or licences required for your property.",
            },
            {
              title: "2. Identity verification (KYC)",
              body: "You must complete NestaNg's KYC process before any Listing can be published. KYC requires valid government-issued ID, BVN, proof of address, and proof of your right to let the Accommodation. KYC data is held in accordance with NestaNg's Privacy Policy and Nigerian data protection law.",
            },
            {
              title: "3. Commission and payouts",
              body: "NestaNg charges a Platform Commission on each Booking (rate disclosed in your account settings). Your net payout is credited to your NestaNg Wallet as a pending balance after Booking confirmation, released 24 hours after your Guest's check-in. You must request withdrawal through the Platform. Payouts are made to your verified bank account only.",
            },
            {
              title: "4. Cancellations",
              body: "Unjustified cancellation of a confirmed Booking will result in forfeiture of the Booking payout, a penalty charge, and may lead to suspension of your account. You may only cancel on the limited grounds set out in NestaNg's Cancellation Policy.",
            },
            {
              title: "5. Prohibited conduct",
              body: "You must not request or accept payments outside the Platform, publish false or misleading Listings, discriminate against Guests, or create multiple Host accounts. Violations may result in immediate account suspension.",
            },
            {
              title: "6. Liability",
              body: "NestaNg is a technology marketplace and is not responsible for damage, injury, or loss arising at your Accommodation. You are responsible for holding appropriate property and liability insurance. NestaNg's liability to you is limited to the net payout for the specific Booking in dispute.",
            },
            {
              title: "7. Governing law",
              body: "This agreement is governed by the laws of the Federal Republic of Nigeria. Disputes are subject to the jurisdiction of the courts of Lagos State. The full Host Agreement document is available at nestanaija.com/legal/host-agreement.",
            },
          ].map((s) => (
            <div key={s.title}>
              <p className="font-bold text-white/90 mb-1">{s.title}</p>
              <p className="text-white/65 text-xs leading-relaxed">{s.body}</p>
            </div>
          ))}

          <p className="text-[10px] text-white/35 pt-2 border-t border-white/10">
            The full Host Agreement document (v{HOST_AGREEMENT_VERSION}) is available for download from your account settings after onboarding.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 border-t border-white/10 flex-shrink-0 space-y-4">
          {!scrolled && (
            <p className="text-[11px] text-amber-300/70 text-center animate-pulse">
              ↓ Scroll to read the full agreement before accepting
            </p>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={!scrolled}
              className="mt-0.5 w-4 h-4 accent-amber-400 cursor-pointer disabled:opacity-40"
            />
            <span className={`text-xs leading-relaxed ${scrolled ? "text-white/80" : "text-white/35"}`}>
              I have read and understood the NestaNg Host Agreement (Version {HOST_AGREEMENT_VERSION}). I agree to be bound by its terms, including the commission structure, payout model, cancellation policy, and host obligations.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => checked && onAccept()}
              disabled={!checked || saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Accept & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();

  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";

  return r;
}

function normalizeKycStatus(profile = {}) {
  return String(
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || ""
  )
    .toLowerCase()
    .trim();
}

export default function OnboardingHost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const role = useMemo(
    () => normalizeRole(profile?.role || profile?.type),
    [profile?.role, profile?.type]
  );

  const kycStatus = useMemo(() => normalizeKycStatus(profile), [profile]);

  const isKycApproved =
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  // ─── Agreement modal state ────────────────────────────────────────────────
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementSaving, setAgreementSaving] = useState(false);
  // Pending destination — where to nav after agreement accepted
  const pendingNavRef = useRef(null);

  // Has the user already accepted the current version?
  const hasAccepted = Boolean(
    profile?.agreements?.host_agreement?.version === HOST_AGREEMENT_VERSION ||
    profile?.agreements?.host_agreement
  );

  const primaryLabel = useMemo(() => {
    if (role === "host" && isKycApproved) return "Go to host dashboard";
    if (isKycApproved) return "Continue host application";
    return "Complete KYC to continue";
  }, [role, isKycApproved]);

  useEffect(() => {
    if (!user) return;
    if (role === "host" && isKycApproved) {
      nav("/host", { replace: true });
    }
  }, [user, role, isKycApproved, nav]);

  // Navigate to destination — gated by agreement acceptance
  const navigateWithAgreement = useCallback((destination) => {
    if (hasAccepted) {
      nav(destination);
      return;
    }
    pendingNavRef.current = destination;
    setShowAgreement(true);
  }, [hasAccepted, nav]);

  const handleAgreementAccept = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setAgreementSaving(true);
      await recordAgreementAcceptance(user.uid, "host_agreement", HOST_AGREEMENT_VERSION);
      setShowAgreement(false);
      if (pendingNavRef.current) {
        nav(pendingNavRef.current);
        pendingNavRef.current = null;
      }
    } catch (err) {
      console.error("Failed to record agreement acceptance:", err);
      // Don't block the user — still navigate
      setShowAgreement(false);
      if (pendingNavRef.current) {
        nav(pendingNavRef.current);
        pendingNavRef.current = null;
      }
    } finally {
      setAgreementSaving(false);
    }
  }, [user?.uid, nav]);

  const handleStartHostApplication = () => {
    if (!user) {
      nav("/login?next=/onboarding/host");
      return;
    }

    if (role === "host" && isKycApproved) {
      nav("/host");
      return;
    }

    // Keep intent for downstream onboarding/KYC routing
    localStorage.setItem("nesta_kyc_intent", "host");

    const destination = !isKycApproved ? "/onboarding/kyc" : "/onboarding/kyc/apply";
    navigateWithAgreement(destination);
  };

  const goHostDashboard = () => nav("/host");

  return (
    <main className="min-h-screen bg-[#05070a] pt-24 pb-16 text-white">
      {/* Agreement modal — shown before KYC navigation if not yet accepted */}
      {showAgreement && (
        <HostAgreementModal
          onAccept={handleAgreementAccept}
          onClose={() => { setShowAgreement(false); pendingNavRef.current = null; }}
          saving={agreementSaving}
        />
      )}
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        <section className="rounded-3xl bg-gradient-to-br from-[#151826] via-[#090b13] to-black border border-white/5 p-6 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-200/80">
            Nesta • Host onboarding
          </p>

          <div className="mt-3 flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1 space-y-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                Become a Nesta Host.
              </h1>

              <p className="text-sm md:text-base text-slate-200/85 max-w-2xl">
                List a single home or a small collection of spaces with concierge
                support, verified guests, and a refined booking journey.
              </p>

              <div className="flex flex-wrap gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleStartHostApplication}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm md:text-base bg-amber-400 text-black hover:bg-amber-300"
                >
                  {primaryLabel}
                </button>

                {role === "host" && (
                  <button
                    type="button"
                    onClick={goHostDashboard}
                    className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs md:text-sm text-white/85 hover:bg-white/10"
                  >
                    Go to host dashboard
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                You can start as a <span className="font-semibold">single-property host</span>{" "}
                and upgrade later.
              </p>
            </div>

            <div className="w-full md:w-60 lg:w-64">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2">
                <div className="text-xs font-semibold text-white/60">Your status</div>

                <div className="text-sm">
                  <span className="text-white/70">Account: </span>
                  <span className="font-semibold">
                    {role === "host"
                      ? "Host"
                      : role === "partner"
                      ? "Verified Partner"
                      : "Guest"}
                  </span>
                </div>

                <div className="text-sm">
                  <span className="text-white/70">KYC: </span>
                  <span className="font-semibold capitalize">
                    {kycStatus || "not started"}
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-white/55">
                  KYC is required to protect hosts, guests, and partners.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              t: "Verify your identity",
              s: "Upload ID, selfie, and proof of address so our team can verify you.",
            },
            {
              n: "02",
              t: "Share your hosting details",
              s: "Tell us about your property and how you host.",
            },
            {
              n: "03",
              t: "Activate your first listing",
              s: "Once approved, you can publish your first home and access the host dashboard.",
            },
          ].map((x) => (
            <div
              key={x.n}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-xs text-white/60 mb-1">{x.n}</div>
              <div className="font-extrabold text-base md:text-lg">{x.t}</div>
              <p className="text-sm text-white/75 mt-1">{x.s}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}