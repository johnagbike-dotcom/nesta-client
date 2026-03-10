// src/pages/onboarding/PartnerOnboarding.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";

// ─── Agreement version — bump when Partner Agreement is updated ───────────────
const PARTNER_AGREEMENT_VERSION = "v1.0";

/* ─── API ─────────────────────────────────────────────────────────────────── */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

async function getBearerToken() {
  try {
    const a = getAuth();
    return a.currentUser ? await a.currentUser.getIdToken() : "";
  } catch { return ""; }
}

const api = {
  get: async (p) => {
    const token = await getBearerToken();
    const r = await fetch(`${API_BASE}${p}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) throw new Error((await r.text()) || "Request failed");
    return r.json();
  },
  post: async (p, body) => {
    const token = await getBearerToken();
    const r = await fetch(`${API_BASE}${p}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error((await r.text()) || "Request failed");
    return r.json();
  },
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();
  if (r === "verified_partner") return "partner";
  if (r === "verified_host") return "host";
  if (!r) return "guest";
  return r;
}

function normalizeKycStatus(profile = {}) {
  return String(
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || ""
  ).toLowerCase().trim();
}

function prettyStatus(v) {
  const s = String(v || "none").toLowerCase().trim();
  if (!s || s === "none") return "Not started";
  if (s === "under_review") return "Under review";
  if (s === "approved") return "Approved ✓";
  if (s === "rejected") return "Not approved";
  if (s === "pending") return "Pending";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusPillCls(s) {
  const v = String(s || "").toLowerCase().trim();
  if (v === "approved") return "bg-emerald-400/15 border-emerald-400/30 text-emerald-200";
  if (v === "under_review" || v === "pending") return "bg-amber-400/15 border-amber-400/30 text-amber-200";
  if (v === "rejected") return "bg-red-400/15 border-red-400/30 text-red-200";
  return "bg-white/8 border-white/15 text-white/60";
}

/* ─── Firestore: record agreement acceptance ─────────────────────────────── */
async function recordAgreementAcceptance(uid, type, version, extra = {}) {
  const ref = doc(db, "users", uid, "agreements", type);
  await setDoc(ref, {
    agreementType: type,
    version,
    acceptedAt: serverTimestamp(),
    method: "esignature",
    ...extra,
  }, { merge: true });
}

/* ─── Partner Agreement Modal ─────────────────────────────────────────────── */
function PartnerAgreementModal({ onAccept, onClose, saving }) {
  const [signedName, setSignedName] = useState("");
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
  }, []);

  const canAccept = scrolled && checked && signedName.trim().length >= 2;

  const sections = [
    { title: "1. Appointment", body: "NestaNg appoints you as a non-exclusive Verified Partner on the Platform. This permits you to list Partner Units and receive Bookings. The appointment does not grant geographic or category exclusivity." },
    { title: "2. KYC and eligibility", body: "You must be a duly registered Nigerian business (CAC-registered) and hold all required operating licences for short-stay property management. You must maintain valid KYC at all times. KYC lapses may result in immediate suspension of all your Listings." },
    { title: "3. Listing and calendar obligations", body: "You are solely responsible for real-time calendar accuracy across all listed units. Double-bookings caused by calendar mismanagement are not a valid cancellation ground and will attract penalties. All Listings must accurately reflect your properties' actual condition and amenities." },
    { title: "4. Service Level Agreement (SLA)", body: "You must respond to Guest messages within 2 hours (6am–10pm) and 6 hours overnight. Check-in instructions must be sent at least 2 hours before arrival. Maintenance issues must be resolved within 4 hours of a Guest report. A minimum average rating of 4.0/5.0 is required per unit over a rolling 90-day period." },
    { title: "5. Commission and payouts", body: "NestaNg charges a Commission on each Booking (rate confirmed at onboarding). Your net payout is credited to your NestaNg Wallet as a pending balance, released 24 hours after check-in. Withdrawals are processed to your verified company bank account only. Payout holds may apply where a Guest dispute is pending." },
    { title: "6. Cancellation penalties", body: "Unjustified cancellations attract escalating penalties: written warning and payout forfeiture for the 1st offence; financial penalty and Listing suspension for the 2nd; termination of this Agreement for the 3rd. Calendar errors are not an accepted justification." },
    { title: "7. Data protection", body: "You agree to process Guest personal data only for the purpose of managing Bookings, implement appropriate security measures, and not share Guest data with third parties. You accept NestaNg's Data Processing Agreement by accepting this Agreement." },
    { title: "8. Confidentiality", body: "You must keep confidential all non-public information received from NestaNg, including commission rates, pricing strategies, and Guest data. This obligation survives termination of this Agreement for 3 years." },
    { title: "9. Term and termination", body: "This Agreement runs for an initial 12-month term, auto-renewing annually. Either party may terminate with 30 days' notice. NestaNg may terminate immediately for material breach, fraud, or insolvency. On termination you must honour all Bookings with check-in dates within 30 days." },
    { title: "10. Liability", body: "NestaNg's liability to you is limited to net payouts from the 3 months preceding a claim. You indemnify NestaNg against all claims arising from your property's condition, management, or breach of this Agreement." },
    { title: "11. Governing law", body: "This Agreement is governed by Nigerian law. Disputes not resolved informally shall first be referred to mediation, then to the exclusive jurisdiction of the courts of Lagos State. The full Partner Agreement is available at nestanaija.com/legal/partner-agreement." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0d1017] border border-white/10 shadow-[0_32px_100px_rgba(0,0,0,0.85)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/70 mb-1">NestaNg · Verified Partner</p>
            <h2 className="text-lg font-black tracking-tight text-white">Verified Partner Agreement</h2>
            <p className="text-xs text-white/50 mt-0.5">Version {PARTNER_AGREEMENT_VERSION} · Commercial agreement — please read carefully</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-white/80 leading-relaxed"
        >
          <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
            This is a commercial agreement between your business and Nesta Connect Limited. An authorised signatory must execute this agreement. Your typed name below constitutes a valid digital signature.
          </p>

          {sections.map((s) => (
            <div key={s.title}>
              <p className="font-bold text-white/90 mb-1">{s.title}</p>
              <p className="text-white/65 text-xs leading-relaxed">{s.body}</p>
            </div>
          ))}

          <p className="text-[10px] text-white/35 pt-2 border-t border-white/10">
            The full Verified Partner Agreement (v{PARTNER_AGREEMENT_VERSION}) is available for download from your account settings after onboarding.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 border-t border-white/10 flex-shrink-0 space-y-4">
          {!scrolled && (
            <p className="text-[11px] text-amber-300/70 text-center animate-pulse">
              ↓ Scroll to read the full agreement before signing
            </p>
          )}

          {/* E-signature field */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/60">
              Type your full name to sign this agreement digitally
            </label>
            <input
              type="text"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              disabled={!scrolled}
              placeholder="Full legal name or authorised signatory name"
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-white/30 outline-none focus:border-amber-400/70 disabled:opacity-40"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={!scrolled}
              className="mt-0.5 w-4 h-4 accent-amber-400 cursor-pointer disabled:opacity-40"
            />
            <span className={`text-xs leading-relaxed ${scrolled ? "text-white/80" : "text-white/35"}`}>
              I confirm I am an authorised signatory and I agree to be bound by the NestaNg Verified Partner Agreement (Version {PARTNER_AGREEMENT_VERSION}), including the SLA, commission structure, cancellation penalty framework, and data protection obligations.{" "}
              I also agree to NestaNg's{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(245,158,11,0.8)", textDecoration: "underline" }}>Terms of Use</a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(245,158,11,0.8)", textDecoration: "underline" }}>Privacy Policy</a>.
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
              onClick={() => canAccept && onAccept(signedName.trim())}
              disabled={!canAccept || saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving signature…" : "Sign & Submit Application"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline notice ───────────────────────────────────────────────────────── */
function Notice({ tone = "red", children }) {
  const cls = tone === "amber"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-red-500/40 bg-red-500/10 text-red-200";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function PartnerOnboarding() {
  const nav = useNavigate();
  const { user, profile: authProfile } = useAuth();
  const { profile: liveProfile } = useUserProfile();

  const profile = liveProfile || authProfile || {};
  const uid = user?.uid || profile?.uid || null;

  const role = useMemo(
    () => normalizeRole(profile?.role || profile?.type),
    [profile?.role, profile?.type]
  );
  const kycStatus = useMemo(() => normalizeKycStatus(profile), [profile]);
  const isKycApproved =
    kycStatus === "approved" || kycStatus === "verified" || kycStatus === "complete";

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreementSaving, setAgreementSaving] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [kycWarning, setKycWarning] = useState(false);

  const [form, setForm] = useState({
    email: user?.email || profile?.email || "",
    portfolioUrl: "",
    note: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, email: user?.email || profile?.email || f.email || "" }));
  }, [user?.email, profile?.email]);

  useEffect(() => {
    if (!uid) return;
    try { localStorage.setItem("nesta_kyc_intent", "partner"); } catch {}
  }, [uid]);

  useEffect(() => {
    const s = String(status?.status || "").toLowerCase().trim();
    if (!user) return;
    if (role === "partner" && isKycApproved && s === "approved") {
      nav("/partner", { replace: true });
    }
  }, [user, role, isKycApproved, status?.status, nav]);

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      setLoading(true); setErr("");
      const res = await api.get(`/onboarding/partner/status?userId=${encodeURIComponent(uid)}`);
      const data = res?.data || res || null;
      setStatus(data);
      if (data?.portfolioUrl || data?.note) {
        setForm((f) => ({ ...f, portfolioUrl: data?.portfolioUrl || "", note: data?.note || "" }));
      }
    } catch (e) {
      console.error(e);
      setErr("Could not load your application status. Please try again.");
    } finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const appStatus = String(status?.status || "none").toLowerCase().trim();
  const formDisabled = !isKycApproved || appStatus === "under_review" || appStatus === "approved";

  function handleSubmitClick() {
    setKycWarning(false); setErr("");
    if (!isKycApproved) { setKycWarning(true); return; }
    setShowAgreement(true);
  }

  async function submitWithSignature(signedName) {
    if (!uid) return;
    // 1. Record agreement acceptance
    try {
      setAgreementSaving(true);
      await recordAgreementAcceptance(uid, "partner_agreement", PARTNER_AGREEMENT_VERSION, { signedName });
    } catch (e) {
      console.error("Agreement record failed (non-blocking):", e);
    } finally {
      setAgreementSaving(false);
      setShowAgreement(false);
    }
    // 2. Submit application
    try {
      setSubmitting(true); setErr("");
      await api.post("/onboarding/partner/apply", {
        userId: uid,
        email: form.email,
        portfolioUrl: form.portfolioUrl,
        note: form.note,
        agreementVersion: PARTNER_AGREEMENT_VERSION,
        agreementSignedName: signedName,
      });
      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not submit your application. Please check your connection and try again.");
    } finally { setSubmitting(false); }
  }

  // ─── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-[#05070a] pt-20 pb-16 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-3xl bg-[#0d1017] border border-white/10 p-8 text-center space-y-4">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/70">NestaNg · Verified Partner</p>
          <h1 className="text-2xl font-black">Partner Onboarding</h1>
          <p className="text-sm text-white/60">Please sign in to continue your Verified Partner application.</p>
          <Link to="/login?next=/onboarding/partner" className="inline-block mt-2 px-6 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300">
            Sign in to continue
          </Link>
        </div>
      </main>
    );
  }

  // ─── Main UI ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 text-white">
      {showAgreement && (
        <PartnerAgreementModal
          onAccept={submitWithSignature}
          onClose={() => setShowAgreement(false)}
          saving={agreementSaving || submitting}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 space-y-6">

        {/* Hero card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#151826] via-[#090b13] to-black border border-white/5 p-6 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-200/80">
            NestaNg · Verified Partner onboarding
          </p>
          <div className="mt-3 flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Become a Verified Partner.</h1>
              <p className="text-sm text-slate-200/80 max-w-xl">
                Scale your portfolio on NestaNg with dedicated partner support,
                real-time dashboard analytics, and direct payout management.
              </p>
              <p className="text-[11px] text-white/40">
                Verified Partners must complete KYC and sign the Partner Agreement before activation.
              </p>
            </div>

            {/* Status card */}
            <div className="w-full md:w-64 rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2.5 flex-shrink-0">
              <div className="text-xs font-semibold text-white/50 uppercase tracking-widest">Your status</div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusPillCls(appStatus)}`}>
                Application: {prettyStatus(appStatus)}
              </span>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusPillCls(isKycApproved ? "approved" : kycStatus)}`}>
                  KYC: {kycStatus || "not started"}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusPillCls(role === "partner" ? "approved" : "none")}`}>
                  {role === "partner" ? "Partner account" : role === "host" ? "Host account" : "Guest account"}
                </span>
              </div>
              {appStatus === "approved" && (
                <button onClick={() => nav("/partner")} className="w-full px-3 py-2 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 mt-1">
                  Go to Partner Dashboard →
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="grid md:grid-cols-3 gap-4">
          {[
            { n: "01", t: "Complete KYC", s: "Submit your company documents, director IDs, and property authorisation for verification." },
            { n: "02", t: "Sign Partner Agreement", s: "Review and digitally sign the Verified Partner Agreement with your authorised signatory name." },
            { n: "03", t: "Submit your portfolio", s: "Share your portfolio details. Our team will review and activate your account within 2 business days." },
          ].map((x) => (
            <div key={x.n} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50 mb-1">{x.n}</div>
              <div className="font-extrabold text-base">{x.t}</div>
              <p className="text-xs text-white/65 mt-1">{x.s}</p>
            </div>
          ))}
        </section>

        {/* Application form card */}
        <section className="rounded-3xl bg-[#0d1017] border border-white/10 p-6 md:p-8 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white/60">Partner application</h2>

          {!isKycApproved && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Your KYC is not yet approved. Please{" "}
              <Link to="/onboarding/kyc" className="underline font-semibold hover:text-amber-100">complete KYC first</Link>{" "}
              before submitting a partner application.
            </div>
          )}

          {appStatus === "under_review" && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              Your application is under review. We'll notify you once it's processed — usually within 2 business days.
            </div>
          )}
          {appStatus === "approved" && (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              Your application is approved. Access your{" "}
              <Link to="/partner" className="underline font-semibold hover:text-emerald-100">Partner Dashboard</Link>{" "}
              to get started.
            </div>
          )}
          {appStatus === "rejected" && (
            <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              Your previous application was not approved. You may update your details and re-apply below.
            </div>
          )}

          {kycWarning && (
            <Notice tone="amber">
              KYC approval is required before submitting a partner application. Please{" "}
              <Link to="/onboarding/kyc" className="underline font-semibold">complete KYC</Link> first.
            </Notice>
          )}
          {err && <Notice tone="red">{err}</Notice>}

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/55 block mb-1.5">Email address</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white/50 outline-none cursor-not-allowed"
                value={form.email} disabled readOnly
              />
            </div>

            <div>
              <label className="text-xs text-white/55 block mb-1.5">
                Portfolio URL <span className="text-white/30">(Google Drive, website, or portfolio link)</span>
              </label>
              <input
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-white/30 outline-none focus:border-amber-400/70 disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="https://drive.google.com/… or https://yourcompany.com"
                value={form.portfolioUrl}
                disabled={formDisabled}
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-white/55 block mb-1.5">
                Notes <span className="text-white/30">(regions covered, unit count, operational setup)</span>
              </label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-white/30 outline-none focus:border-amber-400/70 disabled:opacity-40 disabled:cursor-not-allowed resize-y"
                placeholder="Tell us about your portfolio: number of units, locations, how long you've been operating…"
                rows={4}
                value={form.note}
                disabled={formDisabled}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={formDisabled || submitting}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Submitting…"
                  : appStatus === "rejected"
                  ? "Re-apply as Partner"
                  : "Submit Application & Sign Agreement"}
              </button>

              {role === "partner" && appStatus === "approved" && (
                <button
                  type="button"
                  onClick={() => nav("/partner")}
                  className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white/80 hover:bg-white/10"
                >
                  Go to Partner Dashboard
                </button>
              )}

              <Link
                to="/"
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-transparent text-sm text-white/50 hover:text-white/70 inline-flex items-center"
              >
                ← Back to home
              </Link>
            </div>

            <p className="text-[11px] text-white/30 pt-1 border-t border-white/8">
              By submitting, you will be asked to review and digitally sign the NestaNg Verified Partner Agreement (Version {PARTNER_AGREEMENT_VERSION}).
              Your name, timestamp, and IP address are recorded securely.
            </p>
          </div>
        </section>

        {loading && (
          <p className="text-center text-xs text-white/35 animate-pulse pb-4">
            Loading your application status…
          </p>
        )}
      </div>
    </main>
  );
}