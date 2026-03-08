// src/pages/onboarding/PartnerOnboarding.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";

/* ---------------- API base ---------------- */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

async function getBearerToken() {
  try {
    const auth = getAuth();
    return auth.currentUser ? await auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

const api = {
  get: async (p) => {
    const token = await getBearerToken();
    const r = await fetch(`${API_BASE}${p}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!r.ok) {
      throw new Error((await r.text()) || "Request failed");
    }

    return r.json();
  },

  post: async (p, body) => {
    const token = await getBearerToken();
    const r = await fetch(`${API_BASE}${p}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });

    if (!r.ok) {
      throw new Error((await r.text()) || "Request failed");
    }

    return r.json();
  },
};

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
  )
    .toLowerCase()
    .trim();
}

function prettyStatus(v) {
  const s = String(v || "none").toLowerCase().trim();
  if (!s) return "None";
  if (s === "under_review") return "Under review";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "pending") return "Pending";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function Pill({ tone = "slate", children }) {
  const map = {
    green: { bg: "rgba(16,185,129,.15)", bd: "rgba(16,185,129,.35)", fg: "#b7f7df" },
    amber: { bg: "rgba(245,158,11,.15)", bd: "rgba(245,158,11,.35)", fg: "#ffe8b5" },
    red: { bg: "rgba(239,68,68,.15)", bd: "rgba(239,68,68,.35)", fg: "#ffd3d3" },
    slate: { bg: "rgba(255,255,255,.08)", bd: "rgba(255,255,255,.18)", fg: "#e6ebf4" },
  };

  const c = map[tone] || map.slate;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontWeight: 800,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

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
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: user?.email || profile?.email || "",
    portfolioUrl: "",
    note: "",
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      email: user?.email || profile?.email || f.email || "",
    }));
  }, [user?.email, profile?.email]);

  // remember intent so KycGate knows where to send them after approval
  useEffect(() => {
    if (!uid) return;
    try {
      localStorage.setItem("nesta_kyc_intent", "partner");
    } catch {
      // ignore
    }
  }, [uid]);

  // if already approved partner + kyc approved, send to dashboard
  useEffect(() => {
    const s = String(status?.status || "").toLowerCase().trim();
    if (!user) return;
    if (role === "partner" && isKycApproved && s === "approved") {
      nav("/partner", { replace: true });
    }
  }, [user, role, isKycApproved, status?.status, nav]);

  const statusTone = useMemo(() => {
    const s = String(status?.status || "none").toLowerCase().trim();
    if (s === "approved") return "green";
    if (s === "under_review" || s === "pending") return "amber";
    if (s === "rejected") return "red";
    return "slate";
  }, [status]);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const res = await api.get(`/onboarding/partner/status?userId=${encodeURIComponent(uid)}`);
      const data = res?.data || res || null;

      setStatus(data);

      if (data?.portfolioUrl || data?.note) {
        setForm((f) => ({
          ...f,
          portfolioUrl: data?.portfolioUrl || "",
          note: data?.note || "",
        }));
      }
    } catch (e) {
      console.error(e);
      setErr("Could not load partner onboarding status.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e?.preventDefault?.();

    if (!uid) return;

    if (!isKycApproved) {
      alert("You need KYC approval before applying as a partner.");
      return;
    }

    try {
      setSubmitting(true);
      setErr("");

      await api.post("/onboarding/partner/apply", {
        userId: uid,
        email: form.email,
        portfolioUrl: form.portfolioUrl,
        note: form.note,
      });

      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not submit application. Please try again.");
      alert("Could not submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="container" style={{ padding: 24 }}>
        <h1 className="text-white font-extrabold">Verified Partner Onboarding</h1>
        <p className="text-white/70">
          Please <Link to="/login?next=/onboarding/partner">sign in</Link> to continue.
        </p>
      </div>
    );
  }

  const s = String(status?.status || "none").toLowerCase().trim();
  const formDisabled = !isKycApproved || s === "under_review" || s === "approved";

  return (
    <div className="container" style={{ padding: 24, color: "#e6ebf4" }}>
      <h1 style={{ fontWeight: 900, marginBottom: 6 }}>Verified Partner Onboarding</h1>

      <p style={{ color: "#b9c2d3" }}>
        Apply to become a Nesta Verified Partner. KYC must be approved before we can review your
        portfolio.
      </p>

      {!isKycApproved && (
        <p style={{ marginTop: 8, fontSize: 13, color: "#facc6b" }}>
          Your KYC is not approved yet. Please{" "}
          <Link to="/onboarding/kyc" className="underline">
            complete KYC
          </Link>{" "}
          before submitting a partner application.
        </p>
      )}

      {err && (
        <div
          style={{ marginTop: 12 }}
          className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3"
        >
          {err}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="font-bold">Status:</div>
          <Pill tone={statusTone}>{prettyStatus(status?.status || "none")}</Pill>
          <Pill tone={isKycApproved ? "green" : "amber"}>
            KYC: {kycStatus || "not started"}
          </Pill>
          <Pill tone={role === "partner" ? "green" : "slate"}>
            Account: {role === "partner" ? "Partner" : role === "host" ? "Host" : "Guest"}
          </Pill>
        </div>

        {s === "approved" && (
          <div style={{ marginTop: 12, color: "#c9d2e3" }}>
            Approved. You can access your{" "}
            <Link to="/partner" className="text-yellow-300">
              Partner Dashboard
            </Link>
            .
          </div>
        )}

        {s === "under_review" && (
          <div style={{ marginTop: 12, color: "#c9d2e3" }}>
            Your partner application is under review. We’ll notify you as soon as it’s approved.
          </div>
        )}

        {s === "rejected" && (
          <div style={{ marginTop: 12, color: "#c9d2e3" }}>
            Your previous application was not approved. You may update your portfolio details and re-apply.
          </div>
        )}

        <form
          onSubmit={submit}
          style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 680 }}
        >
          <input
            className="pill"
            placeholder="Email"
            value={form.email}
            disabled
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            className="pill"
            placeholder="Portfolio URL (bulk portfolio / drive folder / website)"
            value={form.portfolioUrl}
            disabled={formDisabled}
            onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
          />

          <textarea
            className="pill"
            placeholder="Notes (regions, inventory size, ops readiness, etc.)"
            rows={4}
            style={{ paddingTop: 10, paddingBottom: 10, resize: "vertical" }}
            value={form.note}
            disabled={formDisabled}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn-gold"
              disabled={formDisabled || submitting}
              type="submit"
            >
              {submitting
                ? "Submitting…"
                : s === "rejected"
                ? "Re-apply as Partner"
                : "Submit Partner Application"}
            </button>

            {role === "partner" && s === "approved" ? (
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => nav("/partner")}
              >
                Go to partner dashboard
              </button>
            ) : null}

            <Link
              className="btn btn-gold"
              to="/"
              style={{
                background: "rgba(255,255,255,.08)",
                color: "#e7ecf7",
                borderColor: "rgba(255,255,255,.18)",
              }}
            >
              Back to home
            </Link>
          </div>
        </form>
      </div>

      {loading && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
          Loading your partner status…
        </p>
      )}
    </div>
  );
}