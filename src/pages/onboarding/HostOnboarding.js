// src/pages/onboarding/HostOnboarding.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";
  return r;
}

export default function OnboardingHost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role = normalizeRole(profile?.role || profile?.type);
  const kycStatus = String(
    profile?.kycStatus ||
      profile?.kyc?.status ||
      profile?.kyc?.state ||
      ""
  ).toLowerCase();

  const isKycApproved =
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  const handleStartHostApplication = () => {
    // If somehow user not logged in (should already be guarded, but just in case)
    if (!user) {
      nav("/login?next=/onboarding/host");
      return;
    }

    // If KYC not approved yet, push them into KYC flow
    if (!isKycApproved) {
      // We also remember intent so the KYC wizard knows this is for a host
      localStorage.setItem("nesta_kyc_intent", "host");
      nav("/onboarding/kyc");
      return;
    }

    // KYC approved → go to the premium KYC application wizard, pre-tagged as host
    localStorage.setItem("nesta_kyc_intent", "host");
    nav("/onboarding/kyc/apply");
  };

  const goHostDashboard = () => nav("/host");

  return (
    <main className="min-h-screen bg-[#05070a] pt-24 pb-16 text-white">
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        {/* Header / hero */}
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
                List a single home or a small collection of spaces with
                concierge support, verified guests, and a refined booking
                journey. Nesta hosts are carefully screened for identity,
                quality, and reliability.
              </p>

              <div className="flex flex-wrap gap-3 mt-2">
                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={handleStartHostApplication}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm md:text-base bg-amber-400 text-black hover:bg-amber-300"
                >
                  {isKycApproved
                    ? "Start host application"
                    : "Complete KYC to continue"}
                </button>

                {/* If already host, subtle shortcut */}
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
                You can start as a{" "}
                <span className="font-semibold">single-property host</span>{" "}
                and upgrade later for more listings and visibility.
              </p>
            </div>

            {/* Side card with quick summary */}
            <div className="w-full md:w-60 lg:w-64">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2">
                <div className="text-xs font-semibold text-white/60">
                  Your status
                </div>
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
                  You’ll upload a valid ID and proof of address before we
                  approve your account for hosting.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps overview */}
        <section className="grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              t: "Verify your identity",
              s: "Upload a government ID, selfie, and proof of address so our team can verify you.",
            },
            {
              n: "02",
              t: "Share your hosting details",
              s: "Tell us about your property, expectations, and how you host. This is part of the application form.",
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
              <div className="font-extrabold text-base md:text-lg">
                {x.t}
              </div>
              <p className="text-sm text-white/75 mt-1">{x.s}</p>
            </div>
          ))}
        </section>

        {/* Info block: single-property focus */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
          <h2 className="text-lg md:text-xl font-extrabold">
            Designed for single-property hosts
          </h2>
          <p className="text-sm text-white/75 max-w-3xl">
            Nesta hosts usually start with one property. You can upgrade your
            plan to list more homes, unlock higher placement, and gain extra
            perks. For portfolio managers and agents, our{" "}
            <button
              type="button"
              onClick={() => nav("/onboarding/partner")}
              className="underline underline-offset-4 decoration-amber-300/70 hover:text-amber-200 text-xs md:text-sm"
            >
              Verified Partner
            </button>{" "}
            track is the better fit.
          </p>
        </section>
      </div>
    </main>
  );
}
