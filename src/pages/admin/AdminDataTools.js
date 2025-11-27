// src/pages/admin/AdminDataTools.js
import React, { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { saveAs } from "file-saver";
import AdminHeader from "../../components/AdminHeader";

const Panel = ({ title, children }) => (
  <section className="rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,_#151820_0%,_#0d1014_45%,_#080b0f_100%)]/90 p-5 shadow-[0_14px_60px_rgba(0,0,0,0.25)]">
    <h2 className="text-base font-semibold text-white/90 tracking-wide mb-3">
      {title}
    </h2>
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

async function snapshotColl(coll) {
  const snap = await getDocs(collection(db, coll));
  // 🔧 FIX: spread Firestore data correctly
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function toCsv(rows) {
  if (!rows?.length) return "id\n";

  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        const v = r[c];
        const s =
          v == null
            ? ""
            : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  // 🔧 FIX: correct array spread
  return [header, ...lines].join("\n") + "\n";
}

export default function AdminDataTools() {
  const [busy, setBusy] = useState(false);
  const [lastInfo, setLastInfo] = useState("");

  const exportAll = async (fmt) => {
    setBusy(true);
    try {
      const [users, listings, bookings] = await Promise.all([
        snapshotColl("users"),
        snapshotColl("listings"),
        snapshotColl("bookings"),
      ]);

      if (fmt === "json") {
        const blob = new Blob(
          [
            JSON.stringify(
              {
                users,
                listings,
                bookings,
                exportedAt: new Date().toISOString(),
              },
              null,
              2
            ),
          ],
          { type: "application/json;charset=utf-8" }
        );
        saveAs(blob, `nesta-export-${Date.now()}.json`);
      } else {
        // CSV → 3 files
        const now = Date.now(); // 🔧 FIX: no Date.Now
        [
          { name: `users-${now}.csv`, data: toCsv(users) },
          { name: `listings-${now}.csv`, data: toCsv(listings) },
          { name: `bookings-${now}.csv`, data: toCsv(bookings) },
        ].forEach(({ name, data }) =>
          saveAs(new Blob([data], { type: "text/csv;charset=utf-8" }), name)
        );
      }

      setLastInfo(
        `Exported ${fmt.toUpperCase()} • users:${users.length} • listings:${listings.length} • bookings:${bookings.length}`
      );
    } catch (e) {
      console.error(e);
      alert("Export failed.");
      setLastInfo("Export failed.");
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
          subtitle="Export snapshots of Firestore collections for audit / support."
          rightActions={
            <ToolButton tone="default" onClick={() => window.location.reload()}>
              Refresh
            </ToolButton>
          }
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr,0.6fr]">
          {/* left / main */}
          <div className="space-y-5">
            <Panel title="Quick exports">
              <p className="text-sm text-white/70 mb-4">
                This will read directly from Firestore and generate download files.
                Keep for admin/support use only.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <ToolButton tone="amber" onClick={() => exportAll("csv")} disabled={busy}>
                  {busy ? "Exporting…" : "Export CSV (users, listings, bookings)"}
                </ToolButton>
                <ToolButton tone="primary" onClick={() => exportAll("json")} disabled={busy}>
                  {busy ? "Exporting…" : "Export JSON (single file)"}
                </ToolButton>
                <span className="text-xs text-white/50">
                  {busy ? "Working…" : lastInfo || "No export yet."}
                </span>
              </div>
            </Panel>

            <Panel title="Maintenance (future)">
              <p className="text-sm text-white/60 mb-3">
                These actions will be wired to Cloud Functions later.
              </p>
              <p className="text-xs text-white/40">
                Examples: anonymise user data on request, recalc analytics, archive old bookings, etc.
              </p>
            </Panel>
          </div>

          {/* right / notes */}
          <div className="space-y-5">
            <Panel title="Notes & guidance">
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Keep exports restricted to platform owners and senior support staff.</li>
                <li>• Treat JSON exports as raw, sensitive datasets — store securely.</li>
                <li>• CSV exports are ideal for Excel/Sheets, pivot tables, and audits.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
