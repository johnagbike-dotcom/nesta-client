// src/pages/onboarding/KycApplicationPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import {
  createInitialKycProfile,
  loadKycProfile,
  saveKycProfile,
} from "../../api/kycProfile";

const COUNTRY_DEFAULT = "Nigeria";

function safe(str) {
  return String(str || "");
}

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  return r === "partner" || r === "verified_partner" ? "partner" : "host";
}

export default function KycApplicationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const { profile: userProfile } = useUserProfile(user?.uid);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // role from URL (?role=host|partner) or inferred fallback
  const urlRole = normalizeRole(searchParams.get("role"));
  const inferredRole = normalizeRole(
    urlRole ||
      safe(userProfile?.role).toLowerCase() ||
      safe(userProfile?.accountType).toLowerCase() ||
      safe(userProfile?.type).toLowerCase()
  );

  const targetRole = inferredRole; // "host" | "partner"
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

  /* ---------- load / create existing KYC profile (defensive) ---------- */
  useEffect(() => {
    let live = true;

    async function run() {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      try {
        // ✅ Ensure doc exists (handles direct hits to /apply)
        const existing = await loadKycProfile(user.uid);
        if (!existing) {
          await createInitialKycProfile(user.uid, targetRole);
        } else {
          // ✅ keep role aligned with intent (URL > profile)
          const docRole = normalizeRole(existing.role);
          if (docRole !== targetRole) {
            await saveKycProfile(user.uid, { role: targetRole });
          }
        }

        const data = (await loadKycProfile(user.uid)) || null;

        if (live && data) {
          const finalRole = normalizeRole(data.role || targetRole);

          setForm((prev) => ({
            ...prev,
            ...data,
            role: finalRole,
            accountType:
              finalRole === "host"
                ? "individual"
                : data.accountType === "company"
                ? "company"
                : "individual",
            country: data.country || COUNTRY_DEFAULT,
            companyCountry: data.companyCountry || COUNTRY_DEFAULT,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, targetRole]);

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
    if (!user) {
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

      await saveKycProfile(user.uid, payload);

      // after saving details → go to uploads page (step 3)
      navigate("/onboarding/kyc", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not save your application.");
    } finally {
      setSaving(false);
    }
  };

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
            Nesta • KYC • Step 2 of 3
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            Tell us about you
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/70 max-w-2xl">
            We ask for these details once to keep Nesta safe and compliant. For a
            company partner, fill in both the company and primary contact
            details.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[#070b12] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
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
        </section>

        <p className="mt-4 text-xs text-white/45 max-w-2xl">
          For luxury and compliance, Nesta may request additional documents for
          very high-value properties. You’ll always be able to review and update
          these details later from your account settings.
        </p>
      </div>
    </main>
  );
}
