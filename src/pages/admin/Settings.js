// src/pages/admin/Settings.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../context/ToastContext";
import { getAuth } from "firebase/auth";

/* ─────────────────────────────── axios ─────────────────────────────── */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({ baseURL: API_BASE, withCredentials: false, timeout: 15000 });

api.interceptors.request.use(async (cfg) => {
  try {
    const user = getAuth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      cfg.headers = cfg.headers || {};
      cfg.headers.Authorization = `Bearer ${token}`;
    }
  } catch { /* ignore */ }
  return cfg;
});

/* ─────────────────────────────── ui primitives ─────────────────────────────── */
function SettingRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-white/6 py-5 last:border-0 sm:grid-cols-[240px_1fr] sm:items-start">
      <div>
        <div className="text-[14px] font-bold text-white">{label}</div>
        {hint && (
          <div className="mt-1 text-[12px] leading-relaxed text-white/45">{hint}</div>
        )}
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-[#f5c000]" : "bg-white/12"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </div>
      <span className={`text-[14px] font-semibold ${checked ? "text-white" : "text-white/50"}`}>
        {label}
      </span>
    </label>
  );
}

/* ─────────────────────────────── page ─────────────────────────────── */
export default function Settings() {
  const { showToast } = useToast();

  const notify = useCallback(
    (msg, type = "success") => { try { showToast?.(msg, type); } catch { /* no-op */ } },
    [showToast]
  );

  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  const [maintenanceMode, setMaintenanceMode]             = useState(false);
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
      setRequireKycForNewHosts(cfg.requireKycForNewHosts === undefined ? true : !!cfg.requireKycForNewHosts);
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
    if (!canSave) { notify("Featured carousel limit must be between 1 and 50.", "error"); return; }
    setSaving(true);
    try {
      const res = await api.put("/admin/settings", {
        maintenanceMode: !!maintenanceMode,
        requireKycForNewHosts: !!requireKycForNewHosts,
        featuredCarouselLimit: Number(featuredCarouselLimit || 10),
      });
      setUpdatedAt(res?.data?.updatedAt || new Date().toISOString());
      notify("Settings saved.", "success");
    } catch (e) {
      console.error("Settings save failed:", e?.response?.data || e.message);
      notify("Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-[#090d12] pb-12 text-white">
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <AdminHeader back title="Settings" subtitle="Global platform controls for Nesta." />

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-[#0e1218]">
          <div className="border-b border-white/8 px-6 py-4">
            <h2 className="text-[1rem] font-semibold text-white">Platform settings</h2>
            {updatedAt && (
              <p className="mt-0.5 text-[11px] text-white/35">
                Last saved: {new Date(updatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>

          <div className="px-6">
            {loading ? (
              <div className="py-10 text-center text-[13px] text-white/40">Loading settings…</div>
            ) : (
              <>
                <SettingRow
                  label="Maintenance mode"
                  hint="Show a maintenance screen to guests. Admins remain signed in and can still access the platform."
                >
                  <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} label={maintenanceMode ? "Enabled" : "Disabled"} />
                </SettingRow>

                <SettingRow
                  label="Require KYC for new hosts"
                  hint="Enforce identity verification before hosts or partners can publish listings."
                >
                  <Toggle checked={requireKycForNewHosts} onChange={setRequireKycForNewHosts} label={requireKycForNewHosts ? "Required" : "Not required"} />
                </SettingRow>

                <SettingRow
                  label="Featured carousel limit"
                  hint="Maximum number of featured listings shown in the homepage carousel (1–50)."
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={1} max={50}
                      value={featuredCarouselLimit}
                      onChange={(e) => setFeaturedCarouselLimit(e.target.value)}
                      className="h-10 w-24 rounded-xl border border-white/10 bg-white/5 px-3 text-center text-[14px] text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    {!canSave && (
                      <span className="text-[12px] font-semibold text-rose-400">Enter a value from 1–50</span>
                    )}
                  </div>
                </SettingRow>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/8 px-6 py-4">
            <LuxeBtn kind="gold" onClick={save} disabled={loading || saving || !canSave} loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </LuxeBtn>
            <LuxeBtn kind="slate" onClick={load} disabled={loading || saving} loading={loading}>
              {loading ? "Loading…" : "Reload"}
            </LuxeBtn>
          </div>
        </div>
      </div>
    </main>
  );
}