// src/pages/admin/AdminDataTools.js
import React, { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import { getAuth } from "firebase/auth";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../context/ToastContext";

/* ------------------------------ axios base ------------------------------ */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: false,
});

// Attach Firebase ID token automatically (required by requireAdmin middleware)
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
    // ignore token attach failure here; request may still fail server-side
  }
  return config;
});

/* ------------------------------ UI helpers ------------------------------ */
const Panel = ({ title, children }) => (
  <section className="rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,_#151820_0%,_#0d1014_45%,_#080b0f_100%)]/90 p-5 shadow-[0_14px_60px_rgba(0,0,0,0.25)]">
    <h2 className="mb-3 text-base font-semibold tracking-wide text-white/90">{title}</h2>
    {children}
  </section>
);

async function downloadCsv(path, filename) {
  const res = await api.get(path, { responseType: "blob" });

  const contentType =
    res.headers?.["content-type"] || "text/csv;charset=utf-8";
  const blob = new Blob([res.data], { type: contentType });

  saveAs(blob, filename);
}

export default function AdminDataTools() {
  const { showToast } = useToast();

  const notify = useCallback(
    (msg, type = "info") => {
      try {
        showToast?.(msg, type);
      } catch {
        // no-op
      }
    },
    [showToast]
  );

  const [busy, setBusy] = useState(false);
  const [lastInfo, setLastInfo] = useState("");

  const exportTargets = useMemo(
    () => [
      { path: "/admin/users/export.csv", filename: "users" },
      { path: "/admin/listings/export.csv", filename: "listings" },
      { path: "/admin/bookings/export.csv", filename: "bookings" },
      { path: "/admin/payouts/export.csv", filename: "payouts" },
    ],
    []
  );

  const exportCsvPack = async () => {
    setBusy(true);
    setLastInfo("");

    try {
      const now = Date.now();

      for (const item of exportTargets) {
        await downloadCsv(item.path, `${item.filename}-${now}.csv`);
      }

      const msg = "Exported CSV pack: users, listings, bookings, payouts.";
      setLastInfo(msg);
      notify(msg, "success");
    } catch (e) {
      console.error("AdminDataTools export failed:", e?.response?.data || e?.message || e);

      const serverMsg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Export failed. Check admin auth/token and server route mounts.";

      setLastInfo(serverMsg);
      notify(serverMsg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0e12] pb-10 text-white">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <AdminHeader
          back
          title="Data tools & exports"
          subtitle="Server-side exports for secure admin operations."
          rightActions={
            <LuxeBtn small kind="slate" onClick={() => window.location.reload()} disabled={busy}>
              Refresh
            </LuxeBtn>
          }
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr,0.6fr]">
          <div className="space-y-5">
            <Panel title="Quick exports (CSV)">
              <p className="mb-4 text-sm text-white/70">
                Uses admin API endpoints to generate CSV exports. This is safer and more production-ready than direct client reads.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <LuxeBtn kind="gold" onClick={exportCsvPack} disabled={busy} loading={busy}>
                  {busy ? "Exporting…" : "Export CSV pack"}
                </LuxeBtn>

                <span className="text-xs text-white/50">
                  {busy ? "Working…" : lastInfo || "No export yet."}
                </span>
              </div>

              <div className="mt-4 text-xs text-white/45">
                Includes: users, listings, bookings, and payouts.
              </div>
            </Panel>

            <Panel title="Maintenance (future)">
              <p className="mb-3 text-sm text-white/60">
                These can be wired to admin-only Cloud Functions or protected API jobs later.
              </p>

              <p className="text-xs text-white/40">
                Examples: anonymise user data on request, recalculate analytics, archive old bookings, re-run payout reconciliation, and rebuild reporting snapshots.
              </p>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title="Notes & guidance">
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Exports may contain sensitive data, so store them securely.</li>
                <li>• Keep admin routes protected with Firebase admin role checks.</li>
                <li>• CSV exports are useful for audit trails and reconciliation.</li>
                <li>• If an export fails, verify token injection and backend route mounts first.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}