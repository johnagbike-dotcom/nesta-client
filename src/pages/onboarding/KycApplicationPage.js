// src/pages/onboarding/KycApplicationPage.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import {
  createInitialKycProfile,
  loadKycProfile,
  saveKycProfile,
} from "../../api/kycProfile";

// ─── KYC consent version — bump when data collection scope changes ────────────
const KYC_CONSENT_VERSION = "v1.0";

// ─── Firestore: record KYC consent acceptance ─────────────────────────────────
async function recordKycConsent(uid, targetRole, version) {
  const ref = doc(db, "users", uid, "agreements", "kyc_consent");
  await setDoc(ref, {
    agreementType: "kyc_consent",
    version,
    targetRole,
    acceptedAt: serverTimestamp(),
    method: "checkbox",
  }, { merge: true });
}

// ─── KYC Consent Gate ─────────────────────────────────────────────────────────
function KycConsentGate({ targetRole, onAccept }) {
  const [checked1, setChecked1] = useState(false); // data collection
  const [checked2, setChecked2] = useState(false); // sharing with processors
  const [checked3, setChecked3] = useState(false); // retention period
  const canProceed = checked1 && checked2 && checked3;

  const isPartner = targetRole === "partner";

  return (
    <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6 md:p-8 space-y-5 mb-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/70">
          NestaNg · NDPR Data Consent
        </p>
        <h2 className="text-lg font-black text-white">
          Before we collect your information
        </h2>
        <p className="text-sm text-white/60 max-w-2xl">
          Nigerian law (NDPR / NDPA) requires us to obtain your explicit consent
          before collecting identity and verification documents. Please read each
          item carefully and confirm your consent before proceeding.
        </p>
      </div>

      {/* What we collect */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
        <p className="text-xs font-bold text-white/80 uppercase tracking-wider">
          What we collect
        </p>
        <ul className="text-xs text-white/60 space-y-1.5 leading-relaxed">
          <li>• Full legal name, date of birth, and contact details</li>
          <li>• Government-issued photo ID (passport, NIN, driver's licence, or voter's card)</li>
          <li>• Bank Verification Number (BVN) for Nigerian residents</li>
          <li>• Proof of address (utility bill or bank statement)</li>
          {isPartner && (
            <>
              <li>• CAC Certificate of Incorporation and business registration documents</li>
              <li>• Proof of authority to manage or let listed properties</li>
            </>
          )}
          {!isPartner && (
            <li>• Proof of right to let the property (C of O, tenancy agreement, or authorisation letter)</li>
          )}
        </ul>
      </div>

      {/* Why we collect it */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
        <p className="text-xs font-bold text-white/80 uppercase tracking-wider">
          Why we collect it
        </p>
        <p className="text-xs text-white/60 leading-relaxed">
          We collect this data to verify your identity and right to list on the
          NestaNg platform, comply with Nigerian AML and KYC regulations, protect
          guests and other hosts from fraud, and process payouts to your verified
          bank account. The legal basis for processing is contractual necessity
          and legal obligation under the NDPA 2023 and CBN guidelines.
        </p>
      </div>

      {/* Three consent checkboxes */}
      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={checked1}
            onChange={(e) => setChecked1(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-400 flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed group-hover:text-white/90">
            <span className="font-semibold text-white/90">Data collection consent: </span>
            I consent to NestaNg (Nesta Connect Limited) collecting and processing
            my personal and identity verification data for the purpose of KYC
            verification as described above. By proceeding I also confirm I have read and agree to NestaNg's{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-amber-300/80 hover:text-amber-300">Terms of Use</a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-amber-300/80 hover:text-amber-300">Privacy Policy</a>.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={checked2}
            onChange={(e) => setChecked2(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-400 flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed group-hover:text-white/90">
            <span className="font-semibold text-white/90">Third-party sharing consent: </span>
            I understand my data may be shared with NestaNg's approved KYC
            verification providers, payment processors (Paystack, Flutterwave),
            and cloud infrastructure providers (Google Firebase) for the purpose
            of verification and platform operation. All processors are bound by
            data processing agreements.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={checked3}
            onChange={(e) => setChecked3(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-400 flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed group-hover:text-white/90">
            <span className="font-semibold text-white/90">Retention consent: </span>
            I understand my KYC documents will be retained for 5 years after our
            relationship ends, as required by Nigerian law. I may request
            correction or deletion of my data by contacting{" "}
            <a href="mailto:hello@nestanaija.com" className="underline text-amber-300/80 hover:text-amber-300">
              hello@nestanaija.com
            </a>.
          </span>
        </label>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => canProceed && onAccept()}
          disabled={!canProceed}
          className="px-6 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
        >
          I consent — proceed to verification form
        </button>
        {!canProceed && (
          <p className="mt-2 text-[11px] text-white/35">
            All three consent items must be confirmed before proceeding.
          </p>
        )}
      </div>
    </div>
  );
}

const COUNTRY_DEFAULT = "Nigeria";

function safe(str) {
  return String(str || "").trim();
}

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();
  if (r === "partner" || r === "verified_partner") return "partner";
  return "host";
}

function normalizeIntent(raw) {
  const s = String(raw || "").toLowerCase().trim();
  return s === "partner" ? "partner" : "host";
}

function normalizeKycStatus(profile = {}) {
  return String(
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || ""
  )
    .toLowerCase()
    .trim();
}

export default function KycApplicationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, profile: authProfile } = useAuth();
  const { profile: liveProfile } = useUserProfile();
  const userProfile = liveProfile || authProfile || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const queryRole = searchParams.get("role");
  const queryIntent = searchParams.get("intent");

  const storedIntent = (() => {
    try {
      return localStorage.getItem("nesta_kyc_intent");
    } catch {
      return "";
    }
  })();

  const kycStatus = useMemo(() => normalizeKycStatus(userProfile), [userProfile]);
  const isKycApproved =
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  // precedence: query intent > query role > local storage intent > profile role/type
  const targetRole = useMemo(() => {
    const candidate =
      queryIntent ||
      queryRole ||
      storedIntent ||
      userProfile?.role ||
      userProfile?.accountType ||
      userProfile?.type ||
      "host";

    return normalizeIntent(candidate);
  }, [queryIntent, queryRole, storedIntent, userProfile?.role, userProfile?.accountType, userProfile?.type]);

  const isHost = targetRole === "host";
  const isPartner = targetRole === "partner";

  const [form, setForm] = useState({
    role: targetRole,
    accountType: isHost ? "individual" : "individual",
    fullName: "",
    phone: "",
    dob: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateRegion: "",
    country: COUNTRY_DEFAULT,
    postcode: "",
    idType: "International passport",
    idNumber: "",
    idExpiry: "",
    companyName: "",
    companyRegNo: "",
    companyCountry: COUNTRY_DEFAULT,
    companyWebsite: "",
    companyContactName: "",
    companyContactRole: "",
  });

  // keep intent persisted
  useEffect(() => {
    try {
      localStorage.setItem("nesta_kyc_intent", targetRole);
    } catch {
      // ignore
    }
  }, [targetRole]);

  // if user is already approved and already has the final role, send them straight in
  useEffect(() => {
    if (!user) return;

    const currentRole = normalizeRole(userProfile?.role || userProfile?.type || "");

    if (isKycApproved && currentRole === "host" && targetRole === "host") {
      navigate("/host", { replace: true });
      return;
    }

    if (isKycApproved && currentRole === "partner" && targetRole === "partner") {
      navigate("/partner", { replace: true });
    }
  }, [user, userProfile?.role, userProfile?.type, isKycApproved, targetRole, navigate]);

  /* ---------- load / create existing KYC profile ---------- */
  useEffect(() => {
    let live = true;

    async function run() {
      if (!user?.uid) {
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      try {
        const existing = await loadKycProfile(user.uid);

        if (!existing) {
          await createInitialKycProfile(user.uid, targetRole);
        } else {
          const docRole = normalizeRole(existing.role || targetRole);
          if (docRole !== targetRole) {
            await saveKycProfile(user.uid, { role: targetRole });
          }
        }

        const data = (await loadKycProfile(user.uid)) || null;

        if (live && data) {
          const finalRole = normalizeRole(data.role || targetRole);
          const finalIsHost = finalRole === "host";

          setForm((prev) => ({
            ...prev,
            ...data,
            role: finalRole,
            accountType:
              finalIsHost
                ? "individual"
                : data.accountType === "company"
                ? "company"
                : "individual",
            country: data.country || COUNTRY_DEFAULT,
            companyCountry: data.companyCountry || COUNTRY_DEFAULT,
          }));
        } else if (live) {
          setForm((prev) => ({
            ...prev,
            role: targetRole,
            accountType: targetRole === "host" ? "individual" : prev.accountType || "individual",
          }));
        }
      } catch (e) {
        console.error(e);
        if (live) setError("Could not load your application details.");
      } finally {
        if (live) setLoading(false);
      }
    }

    run();

    return () => {
      live = false;
    };
  }, [user?.uid, targetRole, navigate]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountTypeChange = (type) => {
    if (isHost) return;
    setForm((prev) => ({ ...prev, accountType: type }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!user?.uid) {
      navigate("/login", { replace: true });
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        role: targetRole,
        accountType: isHost ? "individual" : form.accountType,
        step: 2,
      };

      // Record NDPR consent acceptance before saving KYC profile
      try {
        await recordKycConsent(user.uid, targetRole, KYC_CONSENT_VERSION);
      } catch (consentErr) {
        console.error("Consent record failed (non-blocking):", consentErr);
      }

      await saveKycProfile(user.uid, payload);

      try {
        localStorage.setItem("nesta_kyc_intent", targetRole);
      } catch {
        // ignore
      }

      navigate(`/onboarding/kyc?intent=${encodeURIComponent(targetRole)}`, {
        replace: true,
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not save your application.");
    } finally {
      setSaving(false);
    }
  };

  const handleConsentAccept = useCallback(async () => {
    // Pre-record consent at gate — also recorded again on actual submit as backup
    if (user?.uid) {
      try {
        await recordKycConsent(user.uid, targetRole, KYC_CONSENT_VERSION);
      } catch (e) {
        console.error("Pre-consent record failed (non-blocking):", e);
      }
    }
    setConsentGiven(true);
  }, [user?.uid, targetRole]);

  if (loading) return null;

  const accountType = isHost ? "individual" : form.accountType;
  const isCompany = isPartner && accountType === "company";

  const headerLabel = isHost ? "Host application" : "Partner application";
  const accountQuestionVisible = isPartner;

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 px-4 text-white">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <p className="text-xs tracking-[0.35em] uppercase text-amber-200/80">
            NestaNg • KYC • Step 2 of 3
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            Tell us about you
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/70 max-w-2xl">
            We ask for these details once to keep NestaNg safe and compliant. For a
            company partner, fill in both the company and primary contact
            details.
          </p>
          <p className="mt-2 text-xs text-white/45">
            Application intent:{" "}
            <span className="font-semibold text-white/80 capitalize">{targetRole}</span>
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[#070b12] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* ── KYC Consent Gate — shown until user explicitly consents ── */}
          {!consentGiven && (
            <KycConsentGate
              targetRole={targetRole}
              onAccept={handleConsentAccept}
            />
          )}
          {/* ── Form body — only rendered after consent ── */}
          {consentGiven && (
          <>
          <div className="flex items-start justify-between gap-4 mb-4 md:mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-400/90 flex items-center justify-center text-black font-bold text-lg">
                {safe(user?.displayName || user?.email || "N").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Application details
                </div>
                <div className="text-sm text-white/70">
                  This is kept private and used only for verification.
                </div>
              </div>
            </div>

            <div className="text-xs md:text-sm text-white/60 font-semibold">
              {headerLabel}
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {accountQuestionVisible ? (
              <div>
                <p className="text-sm font-semibold mb-2">
                  Are you onboarding as an individual or a company?
                </p>

                <div className="inline-flex rounded-full bg-white/5 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleAccountTypeChange("individual")}
                    className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold ${
                      accountType === "individual"
                        ? "bg-amber-400 text-black"
                        : "text-white/75"
                    }`}
                  >
                    Individual account
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAccountTypeChange("company")}
                    className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold ${
                      accountType === "company"
                        ? "bg-amber-400 text-black"
                        : "text-white/75"
                    }`}
                  >
                    Company
                  </button>
                </div>

                <p className="mt-1 text-xs text-white/50">
                  Choose company if you are applying on behalf of a registered
                  business or agency.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold mb-1">Account type</p>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm text-white/80">
                  Individual account
                </div>
              </div>
            )}

            {isCompany && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h2 className="text-sm font-semibold text-white/80">
                  Company details
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-xs md:text-sm space-y-1">
                    Company name
                    <input
                      name="companyName"
                      value={form.companyName}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="Nesta Luxury Homes Ltd."
                      required={isCompany}
                    />
                  </label>

                  <label className="text-xs md:text-sm space-y-1">
                    Registration / RC number
                    <input
                      name="companyRegNo"
                      value={form.companyRegNo}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="RC1234567"
                      required={isCompany}
                    />
                  </label>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-xs md:text-sm space-y-1">
                    Company country
                    <input
                      name="companyCountry"
                      value={form.companyCountry}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="Nigeria"
                    />
                  </label>

                  <label className="text-xs md:text-sm space-y-1">
                    Company website (optional)
                    <input
                      name="companyWebsite"
                      value={form.companyWebsite}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="https://example.com"
                    />
                  </label>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-xs md:text-sm space-y-1">
                    Primary contact name
                    <input
                      name="companyContactName"
                      value={form.companyContactName}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="Name of authorised signatory"
                    />
                  </label>

                  <label className="text-xs md:text-sm space-y-1">
                    Role / title
                    <input
                      name="companyContactRole"
                      value={form.companyContactRole}
                      onChange={onChange}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                      placeholder="Director, Operations Lead…"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-white/10">
              <h2 className="text-sm font-semibold text-white/80">
                Primary contact details
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-xs md:text-sm space-y-1">
                  Full name (as on ID)
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                    placeholder="Full legal name"
                    required
                  />
                </label>

                <label className="text-xs md:text-sm space-y-1">
                  Mobile / WhatsApp
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                    placeholder="+234…"
                    required
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-xs md:text-sm space-y-1">
                  Date of birth (optional)
                  <input
                    type="date"
                    name="dob"
                    value={form.dob}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <h2 className="text-sm font-semibold text-white/80">
                Serviceable address
              </h2>

              <label className="text-xs md:text-sm space-y-1">
                Address line 1
                <input
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={onChange}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  required
                />
              </label>

              <label className="text-xs md:text-sm space-y-1">
                Address line 2 (optional)
                <input
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={onChange}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                />
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-xs md:text-sm space-y-1">
                  City / Area
                  <input
                    name="city"
                    value={form.city}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                    required
                  />
                </label>

                <label className="text-xs md:text-sm space-y-1">
                  State / Region
                  <input
                    name="stateRegion"
                    value={form.stateRegion}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                    required
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-xs md:text-sm space-y-1">
                  Country
                  <input
                    name="country"
                    value={form.country}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  />
                </label>

                <label className="text-xs md:text-sm space-y-1">
                  Postcode (if applicable)
                  <input
                    name="postcode"
                    value={form.postcode}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <h2 className="text-sm font-semibold text-white/80">
                Primary ID document
              </h2>

              <div className="grid md:grid-cols-3 gap-4">
                <label className="text-xs md:text-sm space-y-1">
                  ID type
                  <select
                    name="idType"
                    value={form.idType}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  >
                    <option>International passport</option>
                    <option>National ID</option>
                    <option>Driver’s licence</option>
                    <option>Voter’s card</option>
                    <option>Other government ID</option>
                  </select>
                </label>

                <label className="text-xs md:text-sm space-y-1">
                  ID number (optional)
                  <input
                    name="idNumber"
                    value={form.idNumber}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  />
                </label>

                <label className="text-xs md:text-sm space-y-1">
                  Expiry date
                  <input
                    type="date"
                    name="idExpiry"
                    value={form.idExpiry}
                    onChange={onChange}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="mt-2 text-sm text-red-300 bg-red-900/30 border border-red-500/50 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm md:text-base hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save & continue to uploads"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-sm text-white/60 hover:text-white/90"
              >
                ← Back to home
              </button>
            </div>
          </form>
          </> /* end consentGiven */
          )}
        </section>

        <p className="mt-4 text-xs text-white/45 max-w-2xl">
          For luxury and compliance, NestaNg may request additional documents for
          very high-value properties. You’ll always be able to review and update
          these details later from your account settings.
        </p>
      </div>
    </main>
  );
}