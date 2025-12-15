// src/pages/admin/AdminDataTools.js
import React, { useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import { getAuth } from "firebase/auth";
import AdminHeader from "../../components/AdminHeader";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 20000,
});

// Attach Firebase ID token automatically (required by requireAdmin.js)
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const Panel = ({ title, children }) => (
  <section className="rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,_#151820_0%,_#0d1014_45%,_#080b0f_100%)]/90 p-5 shadow-[0_14px_60px_rgba(0,0,0,0.25)]">
    <h2 className="text-base font-semibold text-white/90 tracking-wide mb-3">{title}</h2>
    {children}
  </section>
);

const ToolButton = ({ children, onClick, tone = "default", disabled = false }) => {
  const base =
    "inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-white/30 disabled:opacity-45 disabled:cursor-not-allowed";
  const tones = {
    default: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    primary: "bg-[#6675ff] hover:bg-[#5b6af3] text-white shadow-lg shadow-[#5b6af3]/35",
    danger: "bg-rose-500/90 hover:bg-rose-500 text-white",
    amber: "bg-amber-400 text-black hover:bg-amber-300",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${tones[tone] || tones.default}`}>
      {children}
    </button>
  );
};

async function downloadCsv(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

export default function AdminDataTools() {
  const [busy, setBusy] = useState(false);
  const [lastInfo, setLastInfo] = useState("");

  const exportCsvPack = async () => {
    setBusy(true);
    setLastInfo("");
    try {
      const now = Date.now();

      await downloadCsv("/admin/users/export.csv", `users-${now}.csv`);
      await downloadCsv("/admin/listings/export.csv", `listings-${now}.csv`);
      await downloadCsv("/admin/bookings/export.csv", `bookings-${now}.csv`);
      await downloadCsv("/admin/payouts/export.csv", `payouts-${now}.csv`);

      setLastInfo("Exported CSV pack: users, listings, bookings, payouts.");
    } catch (e) {
      console.error(e);
      setLastInfo("Export failed. Check admin auth/token + server route mounts.");
      alert("Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0e12] text-white pb-10">
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <AdminHeader
          back
          title="Data tools & exports"
          subtitle="Server-side exports (secure, production-ready)."
          rightActions={
            <ToolButton tone="default" onClick={() => window.location.reload()}>
              Refresh
            </ToolButton>
          }
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr,0.6fr]">
          <div className="space-y-5">
            <Panel title="Quick exports (CSV)">
              <p className="text-sm text-white/70 mb-4">
                Uses the Admin API to generate CSV exports. Safer than client Firestore reads.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <ToolButton tone="amber" onClick={exportCsvPack} disabled={busy}>
                  {busy ? "Exporting…" : "Export CSV pack (users, listings, bookings, payouts)"}
                </ToolButton>
                <span className="text-xs text-white/50">
                  {busy ? "Working…" : lastInfo || "No export yet."}
                </span>
              </div>
            </Panel>

            <Panel title="Maintenance (future)">
              <p className="text-sm text-white/60 mb-3">These can be wired to admin-only Cloud Functions later.</p>
              <p className="text-xs text-white/40">
                Examples: anonymise user data on request, recalc analytics, archive old bookings, etc.
              </p>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title="Notes & guidance">
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Exports contain sensitive data — store securely.</li>
                <li>• Keep admin endpoints locked behind Firebase admin role.</li>
                <li>• CSV is ideal for audit/reconciliation.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
