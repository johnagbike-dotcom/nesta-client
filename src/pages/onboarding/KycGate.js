// src/pages/onboarding/KycGate.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function Pill({ children, tone = "slate" }) {
  const colors = {
    slate: { bg: "rgba(255,255,255,.08)", text: "#e6ebf4", ring: "rgba(255,255,255,.18)" },
    green: { bg: "#0ea75a", text: "#eafff4", ring: "#0a7e43" },
    red: { bg: "#e11d2e", text: "#ffeef0", ring: "#b31220" },
    amber: { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
    blue: { bg: "#3b82f6", text: "#eef4ff", ring: "#2e62c0" },
  };
  const c = colors[tone] || colors.slate;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 800,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

export default function KycGate() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";

  const { user, profile, loading } = useAuth();
  const uid = user?.uid || profile?.uid;

  const [state, setState] = useState({ latest: null, loading: true, error: "" });

  const statusTone = useMemo(() => {
    const s = String(state.latest?.status || "none").toLowerCase();
    if (s === "approved" || s === "verified") return "green";
    if (s === "pending" || s === "under_review") return "amber";
    if (s === "rejected") return "red";
    return "slate";
  }, [state.latest]);

  // Load current KYC (if any)
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!uid) return;
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));
        const resp = await apiGet(`/kyc/mine?userId=${encodeURIComponent(uid)}`);
        if (mounted) setState({ latest: resp.latest || null, loading: false, error: "" });
      } catch (e) {
        console.error(e);
        if (mounted) setState({ latest: null, loading: false, error: "Could not load KYC status." });
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [uid]);

  // When KYC is approved, auto-continue to the correct onboarding track if we know the intent
  useEffect(() => {
    const s = String(state.latest?.status || "").toLowerCase();
    if (s !== "approved" && s !== "verified") return;

    try {
      const intent = localStorage.getItem("nesta_kyc_intent");
      if (intent === "host") {
        nav("/onboarding/host", { replace: true });
      } else if (intent === "partner") {
        nav("/onboarding/partner", { replace: true });
      }
    } catch {
      // if localStorage is not available, just fall back to showing the CTAs
    }
  }, [state.latest, nav]);

  // Simple form (adds mandatory BVN)
  const [form, setForm] = useState({
    name: user?.displayName || profile?.name || "",
    email: user?.email || profile?.email || "",
    phoneNumber: profile?.phone || "",
    bvn: "",
    govIdType: "",
    govIdNumber: "",
    address: "",
    docUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const s = String(state.latest?.status || "none").toLowerCase();

  async function onSubmit(e) {
    e?.preventDefault?.();
    if (!uid) return;

    // minimal client validation to prevent obvious bad submits
    const errs = {};
    if (!/^\d{11}$/.test(form.bvn)) errs.bvn = "BVN must be 11 digits.";
    if (!form.govIdType) errs.govIdType = "Select ID type.";
    if (!form.govIdNumber) errs.govIdNumber = "Enter ID number.";
    if (!form.address || form.address.length < 5) errs.address = "Provide a valid address.";

    if (Object.keys(errs).length) {
      alert(Object.values(errs).join("\n"));
      return;
    }

    try {
      setSubmitting(true);
      await apiPost("/kyc/submit", { userId: uid, ...form });
      const resp = await apiGet(`/kyc/mine?userId=${encodeURIComponent(uid)}`);
      setState({ latest: resp.latest || null, loading: false, error: "" });
    } catch (e) {
      console.error(e);
      alert("Could not submit KYC. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user)
    return (
      <div className="container" style={{ padding: 24 }}>
        <h1>Account required</h1>
        <p>
          Please{" "}
          <Link to={`/login?next=${encodeURIComponent("/onboarding/kyc")}`}>log in</Link> to start
          KYC.
        </p>
      </div>
    );

  return (
    <div className="container" style={{ padding: 24, color: "#e6ebf4" }}>
      <h1 style={{ margin: "4px 0 10px", fontWeight: 900 }}>KYC Verification</h1>
      <p className="muted" style={{ color: "#b9c2d3" }}>
        Verify your identity to access Host and Verified Partner tools.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Status:</div>
          <Pill tone={statusTone}>{state.latest ? state.latest.status : "none"}</Pill>
        </div>

        {s === "approved" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "#c9d2e3" }}>
              Your KYC is approved. You can proceed to Host or Verified Partner onboarding.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btn-gold" to="/onboarding/host">
                Continue as Host
              </Link>
              <Link className="btn btn-gold" to="/onboarding/partner">
                Continue as Partner
              </Link>
              <Link className="btn btn-gold" to={next}>
                Back
              </Link>
            </div>
          </div>
        )}

        {(s === "pending" || s === "under_review") && (
          <div style={{ marginTop: 12, color: "#c9d2e3" }}>
            Your KYC is under review. We’ll notify you once it’s approved.
          </div>
        )}

        {(s === "rejected" || s === "none") && (
          <form
            onSubmit={onSubmit}
            style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 680 }}
          >
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <input
                className="pill"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="pill"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <input
                className="pill"
                placeholder="Phone number"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              />
              <input
                className="pill"
                placeholder="Residential address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <input
                className="pill"
                placeholder="BVN (11 digits)"
                value={form.bvn}
                onChange={(e) => setForm({ ...form, bvn: e.target.value })}
              />
              <input
                className="pill"
                placeholder="Gov ID type (NIN, Passport, DL)"
                value={form.govIdType}
                onChange={(e) => setForm({ ...form, govIdType: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <input
                className="pill"
                placeholder="Gov ID number"
                value={form.govIdNumber}
                onChange={(e) => setForm({ ...form, govIdNumber: e.target.value })}
              />
              <input
                className="pill"
                placeholder="Document URL (ID scan or drive link)"
                value={form.docUrl}
                onChange={(e) => setForm({ ...form, docUrl: e.target.value })}
              />
            </div>

            <button className="btn-gold" disabled={submitting} type="submit">
              {submitting ? "Submitting…" : s === "rejected" ? "Resubmit KYC" : "Submit KYC"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
