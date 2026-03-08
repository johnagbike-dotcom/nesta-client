// src/pages/admin/Settings.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../context/ToastContext";
import { getAuth } from "firebase/auth";

/* ------------------------------ axios base ------------------------------ */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 15000,
});

// Attach Firebase ID token automatically (admin-protected routes)
api.interceptors.request.use(async (config) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return config;
});

/* ------------------------------ UI helpers ------------------------------ */
function Row({ label, children, hint }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <div>
        <div style={{ fontWeight: 900, color: "#f8fafc" }}>{label}</div>
        {hint ? (
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "#e5e7eb",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontWeight: 700 }}>{label}</span>
    </label>
  );
}

/* --------------------------------- page --------------------------------- */
export default function Settings() {
  const { showToast } = useToast();

  const notify = useCallback(
    (msg, type = "success") => {
      try {
        showToast?.(msg, type);
      } catch {
        // no-op
      }
    },
    [showToast]
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [requireKycForNewHosts, setRequireKycForNewHosts] = useState(true);
  const [featuredCarouselLimit, setFeaturedCarouselLimit] = useState(10);
  const [updatedAt, setUpdatedAt] = useState(null);

  const canSave = useMemo(() => {
    const n = Number(featuredCarouselLimit);
    return Number.isFinite(n) && n >= 1 && n <= 50;
  }, [featuredCarouselLimit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/settings");
      const cfg = res?.data || {};

      setMaintenanceMode(!!cfg.maintenanceMode);
      setRequireKycForNewHosts(
        cfg.requireKycForNewHosts === undefined ? true : !!cfg.requireKycForNewHosts
      );

      const lim = Number(cfg.featuredCarouselLimit ?? 10);
      setFeaturedCarouselLimit(Number.isFinite(lim) ? lim : 10);

      setUpdatedAt(cfg.updatedAt || null);
    } catch (e) {
      console.error("Settings load failed:", e?.response?.data || e.message);
      notify("Failed to load settings.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const save = async () => {
    if (!canSave) {
      notify("Featured carousel limit must be between 1 and 50.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        maintenanceMode: !!maintenanceMode,
        requireKycForNewHosts: !!requireKycForNewHosts,
        featuredCarouselLimit: Number(featuredCarouselLimit || 10),
      };

      const res = await api.put("/admin/settings", payload);
      setUpdatedAt(res?.data?.updatedAt || new Date().toISOString());
      notify("Settings saved.", "success");
    } catch (e) {
      console.error("Settings save failed:", e?.response?.data || e.message);
      notify("Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 28, margin: "6px 0 18px" }}>Admin</h1>

      <AdminHeader
        back
        title="Settings"
        subtitle="Global controls for the luxury platform"
      />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 900,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Platform Settings
        </div>

        <div style={{ padding: 16 }}>
          <Row
            label="Maintenance mode"
            hint="Temporarily show a maintenance screen to guests. Admins remain signed in."
          >
            <Toggle
              checked={maintenanceMode}
              onChange={setMaintenanceMode}
              label={maintenanceMode ? "Enabled" : "Disabled"}
            />
          </Row>

          <Row
            label="Require KYC for new hosts"
            hint="Enforce identity verification before allowing hosts/partners to publish listings."
          >
            <Toggle
              checked={requireKycForNewHosts}
              onChange={setRequireKycForNewHosts}
              label={requireKycForNewHosts ? "Required" : "Not required"}
            />
          </Row>

          <Row
            label="Featured carousel limit"
            hint="Maximum number of featured listings shown in the homepage carousel (1–50)."
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                min={1}
                max={50}
                value={featuredCarouselLimit}
                onChange={(e) => setFeaturedCarouselLimit(e.target.value)}
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.06)",
                  color: "#dfe3ea",
                  padding: "0 12px",
                  width: 160,
                }}
              />

              {!canSave ? (
                <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>
                  Enter a value from 1 to 50
                </span>
              ) : null}
            </div>
          </Row>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <LuxeBtn
              kind="gold"
              onClick={save}
              disabled={loading || saving || !canSave}
              loading={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </LuxeBtn>

            <LuxeBtn
              kind="slate"
              onClick={load}
              disabled={loading || saving}
              loading={loading}
            >
              {loading ? "Loading…" : "Reload"}
            </LuxeBtn>

            <div style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 12 }}>
              {updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleString()}` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}