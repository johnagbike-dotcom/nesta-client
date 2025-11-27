// src/pages/onboarding/PartnerOnboarding.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(
  /\/$/,
  ""
);

const api = {
  get: async (p) => {
    const r = await fetch(`${API_BASE}${p}`, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  post: async (p, body) => {
    const r = await fetch(`${API_BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

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
  const { user, profile } = useAuth();
  const uid = user?.uid || profile?.uid;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: user?.email || profile?.email || "",
    portfolioUrl: "",
    note: "",
  });

  // derive KYC status from profile (same idea as host onboarding)
  const kycStatus = String(
    profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || ""
  ).toLowerCase();

  const isKycApproved =
    kycStatus === "approved" ||
    kycStatus === "verified" ||
    kycStatus === "complete";

  // remember intent so KycGate knows where to send them after approval
  useEffect(() => {
    if (!uid) return;
    try {
      localStorage.setItem("nesta_kyc_intent", "partner");
    } catch {
      // ignore if localStorage unavailable
    }
  }, [uid]);

  const statusTone = useMemo(() => {
    const s = String(status?.status || "none").toLowerCase();
    if (s === "approved") return "green";
    if (s === "under_review" || s === "pending") return "amber";
    if (s === "rejected") return "red";
    return "slate";
  }, [status]);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      setErr("");
      const res = await api.get(`/onboarding/partner/status?userId=${encodeURIComponent(uid)}`);
      const data = res?.data || null;
      setStatus(data);
      if (data?.portfolioUrl) {
        setForm((f) => ({
          ...f,
          portfolioUrl: data.portfolioUrl,
          note: data.note || "",
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
      await api.post("/onboarding/partner/apply", {
        userId: uid,
        ...form,
      });
      await load();
    } catch (e) {
      console.error(e);
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

  const s = String(status?.status || "none").toLowerCase();
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="font-bold">Status:</div>
          <Pill tone={statusTone}>{status?.status || "none"}</Pill>
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
