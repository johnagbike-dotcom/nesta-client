// src/pages/admin/AdminDataTools.js
import React, { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../context/ToastContext";

/* ─────────────────────────────── axios ─────────────────────────────── */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({ baseURL: API_BASE, timeout: 20000, withCredentials: false });

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

/* ─────────────────────────────── helpers ─────────────────────────────── */
const JUNK_STATUSES = [
  "pending","initialized","awaiting_payment","reserved_unpaid",
  "pending_payment","created","initiated","hold","hold-pending",
];

const safeLower = (v) => String(v || "").toLowerCase().trim();

function safeDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") { try { return v.toDate(); } catch { return null; } }
  if (typeof v?.seconds === "number") {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    const d = new Date(ms); return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

function isJunkBooking(data, thresholdDays) {
  const status = safeLower(data.status || "");
  if (!JUNK_STATUSES.includes(status)) return false;
  if (data.archived) return false; // already cleaned

  // Must have no payment evidence
  const hasPaidMarkers =
    data.paid === true ||
    data.isPaid === true ||
    data.paymentSuccess === true ||
    data.verified === true ||
    !!data.paidAt ||
    !!data.transactionId ||
    !!data.gatewayRef ||
    !!data.providerRef ||
    !!data.reference;

  if (hasPaidMarkers) return false; // it might be a real booking that got stuck

  // Must be older than threshold
  const createdAt = safeDate(data.createdAt || data.created_at || data.date || data.timestamp);
  if (!createdAt) return true; // no date — definitely junk
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= thresholdDays;
}

function buildCsv(rows) {
  const headers = ["id","status","guestEmail","listingTitle","amount","createdAt","reference"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.id, r.status, r.guestEmail, r.listingTitle, r.amount, r.createdAt ? r.createdAt.toISOString() : "", r.reference]
        .map(escape).join(",")
    ),
  ];
  return lines.join("\n");
}

/* ─────────────────────────────── ui primitives ─────────────────────────────── */
const Panel = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-white/8 bg-[#0e1218] p-5">
    <div className="mb-4">
      <h2 className="text-[0.95rem] font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12px] text-white/40">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const Badge = ({ children, tone = "slate" }) => {
  const cls = {
    slate:  "bg-slate-500/15 text-slate-300 border-slate-500/20",
    amber:  "bg-amber-500/15 text-amber-300 border-amber-500/20",
    rose:   "bg-rose-500/15  text-rose-300  border-rose-500/20",
    green:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  }[tone] || "bg-slate-500/15 text-slate-300 border-slate-500/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
};

async function downloadCsv(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  const blob = new Blob([res.data], { type: res.headers?.["content-type"] || "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

/* ─────────────────────────────── Junk Booking Cleaner ─────────────────────────────── */
function JunkBookingCleaner({ notify }) {
  const [thresholdDays, setThresholdDays] = useState(14);
  const [scanning, setScanning]       = useState(false);
  const [junkRows, setJunkRows]       = useState(null); // null = not scanned yet
  const [selected, setSelected]       = useState(new Set());
  const [processing, setProcessing]   = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState(false);
  const [log, setLog]                 = useState([]);

  const addLog = (msg) => setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 29)]);

  /* ── scan ── */
  const scan = useCallback(async () => {
    setScanning(true);
    setJunkRows(null);
    setSelected(new Set());
    setLog([]);
    try {
      const snap = await getDocs(collection(db, "bookings"));
      const found = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        if (isJunkBooking(data, thresholdDays)) {
          const createdAt = safeDate(data.createdAt || data.created_at || data.date || data.timestamp);
          found.push({
            id: d.id,
            status: data.status || "unknown",
            guestEmail: data.email || data.guestEmail || "—",
            listingTitle: data.listingTitle || data.listing?.title || "—",
            amount: Number(data.amountLockedN ?? data.amountN ?? data.totalAmount ?? data.amount ?? 0) || 0,
            createdAt,
            reference: data.reference || data.ref || "",
          });
        }
      });
      found.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
      setJunkRows(found);
      addLog(`Scan complete. Found ${found.length} junk booking(s) older than ${thresholdDays} days.`);
    } catch (e) {
      notify(`Scan failed: ${e?.message || e}`, "error");
      addLog(`ERROR: ${e?.message || e}`);
    } finally {
      setScanning(false);
    }
  }, [thresholdDays, notify]);

  /* ── select all / none ── */
  const toggleAll = () => {
    if (selected.size === (junkRows?.length || 0)) {
      setSelected(new Set());
    } else {
      setSelected(new Set((junkRows || []).map((r) => r.id)));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── export selected as CSV ── */
  const exportSelected = () => {
    const rows = (junkRows || []).filter((r) => selected.has(r.id));
    if (!rows.length) { notify("Select at least one booking to export.", "error"); return; }
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `junk-bookings-${Date.now()}.csv`);
    addLog(`Exported ${rows.length} row(s) as CSV.`);
  };

  /* ── soft delete (archive) ── */
  const softDelete = useCallback(async () => {
    if (!selected.size) { notify("Select at least one booking.", "error"); return; }
    setProcessing(true);
    let done = 0; let failed = 0;
    for (const id of selected) {
      try {
        await updateDoc(doc(db, "bookings", id), {
          archived: true,
          archivedAt: serverTimestamp(),
          archivedReason: "admin_cleanup",
          archivedBy: getAuth().currentUser?.uid || "admin",
        });
        done++;
      } catch (e) {
        console.error(`Archive failed for ${id}:`, e);
        failed++;
      }
    }
    const msg = `Archived ${done} booking(s).${failed ? ` ${failed} failed — check console.` : ""}`;
    addLog(msg);
    notify(msg, failed ? "error" : "success");
    // Remove archived rows from view
    setJunkRows((prev) => (prev || []).filter((r) => !selected.has(r.id)));
    setSelected(new Set());
    setProcessing(false);
  }, [selected, notify]);

  /* ── hard delete (permanent) ── */
  const hardDelete = useCallback(async () => {
    if (!selected.size) { notify("Select at least one booking.", "error"); return; }
    setProcessing(true);
    let done = 0; let failed = 0;
    for (const id of selected) {
      try {
        await deleteDoc(doc(db, "bookings", id));
        done++;
      } catch (e) {
        console.error(`Delete failed for ${id}:`, e);
        failed++;
      }
    }
    const msg = `Permanently deleted ${done} booking(s).${failed ? ` ${failed} failed — check console.` : ""}`;
    addLog(msg);
    notify(msg, failed ? "error" : "success");
    setJunkRows((prev) => (prev || []).filter((r) => !selected.has(r.id)));
    setSelected(new Set());
    setHardDeleteConfirm(false);
    setProcessing(false);
  }, [selected, notify]);

  const allSelected = junkRows?.length > 0 && selected.size === junkRows.length;
  const someSelected = selected.size > 0;

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Age threshold (days)
          </label>
          <div className="flex items-center gap-1.5">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setThresholdDays(d)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition
                  ${thresholdDays === d
                    ? "bg-[#f5c000] text-black"
                    : "border border-white/8 bg-white/4 text-white/55 hover:bg-white/8 hover:text-white"
                  }`}
              >
                {d}d
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={365}
              value={thresholdDays}
              onChange={(e) => setThresholdDays(Math.max(1, Number(e.target.value) || 14))}
              className="w-16 rounded-lg border border-white/8 bg-white/4 px-2 py-1.5 text-center text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        <LuxeBtn kind="gold" onClick={scan} disabled={scanning} loading={scanning}>
          {scanning ? "Scanning…" : "Scan for junk bookings"}
        </LuxeBtn>
      </div>

      {/* What counts as junk — info box */}
      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 text-[12px] text-white/45 leading-relaxed">
        <strong className="text-white/65">Junk criteria:</strong> status is{" "}
        <span className="font-mono text-white/55">{JUNK_STATUSES.join(", ")}</span>
        {" "}· no payment evidence (no reference, transactionId, gatewayRef, or paidAt)
        · created more than <strong className="text-white/65">{thresholdDays} days</strong> ago.
        <br/>
        Bookings with any payment marker are never flagged, even if status is still pending.
      </div>

      {/* Results */}
      {junkRows !== null && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-white/70">
              {junkRows.length === 0
                ? "No junk bookings found."
                : `${junkRows.length} junk booking${junkRows.length !== 1 ? "s" : ""} found`}
            </span>
            {junkRows.length > 0 && (
              <>
                <Badge tone={junkRows.length > 10 ? "rose" : "amber"}>{junkRows.length} rows</Badge>
                {someSelected && <Badge tone="amber">{selected.size} selected</Badge>}
              </>
            )}
          </div>

          {junkRows.length > 0 && (
            <>
              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleAll}
                  className="rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/8 hover:text-white"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                {someSelected && (
                  <>
                    <LuxeBtn small kind="slate" onClick={exportSelected} disabled={processing}>
                      Export CSV ({selected.size})
                    </LuxeBtn>

                    <LuxeBtn small kind="slate" onClick={softDelete} disabled={processing} loading={processing}>
                      Archive ({selected.size})
                    </LuxeBtn>

                    {!hardDeleteConfirm ? (
                      <button
                        onClick={() => setHardDeleteConfirm(true)}
                        disabled={processing}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        Delete permanently ({selected.size})
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5">
                        <span className="text-[12px] font-bold text-rose-300">
                          ⚠ This cannot be undone.
                        </span>
                        <button
                          onClick={hardDelete}
                          disabled={processing}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-[12px] font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setHardDeleteConfirm(false)}
                          className="text-[12px] text-white/45 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-white/8">
                <div className="grid grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_90px_100px_90px] border-b border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                  <div />
                  <div>Listing</div>
                  <div>Guest</div>
                  <div className="text-right">Amount</div>
                  <div>Status</div>
                  <div>Created</div>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {junkRows.map((row) => {
                    const checked = selected.has(row.id);
                    return (
                      <div
                        key={row.id}
                        onClick={() => toggleOne(row.id)}
                        className={`grid cursor-pointer grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_90px_100px_90px] items-center border-b border-white/5 px-3 py-2.5 transition
                          ${checked ? "bg-amber-500/5" : "hover:bg-white/[0.02]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        <span className="truncate text-[13px] font-medium text-white">{row.listingTitle}</span>
                        <span className="truncate text-[12px] text-white/50">{row.guestEmail}</span>
                        <span className="text-right text-[12px] font-bold text-white/70">
                          ₦{Number(row.amount||0).toLocaleString()}
                        </span>
                        <Badge tone="slate">{row.status}</Badge>
                        <span className="text-[11px] text-white/38">
                          {row.createdAt ? row.createdAt.toLocaleDateString("en-NG", { day:"2-digit", month:"short", year:"2-digit" }) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Activity log */}
      {log.length > 0 && (
        <div className="rounded-xl border border-white/6 bg-[#0b0f15] px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Activity log</p>
          <div className="max-h-[120px] overflow-y-auto space-y-1">
            {log.map((entry, i) => (
              <p key={i} className="text-[12px] text-white/50 font-mono">{entry}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Wallet Reconciler ─────────────────────────────── */
const REAL_BOOKING_STATUSES = [
  "confirmed","paid","paid_pending_release","released","completed","checked_in",
];

function isRealBooking(data) {
  if (data?.archived) return false;
  return REAL_BOOKING_STATUSES.includes(safeLower(data?.status || ""));
}

function WalletReconciler({ notify }) {
  const [scanning, setScanning]     = useState(false);
  const [results, setResults]       = useState(null); // null = not scanned
  const [selected, setSelected]     = useState(new Set());
  const [processing, setProcessing] = useState(false);
  const [log, setLog]               = useState([]);

  const addLog = (msg) => setLog((p) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...p.slice(0, 29)]);

  const scan = useCallback(async () => {
    setScanning(true);
    setResults(null);
    setSelected(new Set());
    setLog([]);

    try {
      // 1. Load all wallets
      const walletsSnap = await getDocs(collection(db, "wallets"));
      const wallets = [];
      walletsSnap.forEach((d) => {
        const data = d.data();
        const available = Number(data.available ?? data.availableBalance ?? 0) || 0;
        const pending   = Number(data.pending   ?? data.pendingBalance   ?? 0) || 0;
        if (available > 0 || pending > 0) {
          wallets.push({ uid: d.id, available, pending, _raw: data });
        }
      });

      addLog(`Found ${wallets.length} wallet(s) with non-zero balance.`);

      // 2. Load all bookings once — build a uid → real booking amount map
      const bookingsSnap = await getDocs(collection(db, "bookings"));
      const realByUid = new Map(); // uid → { confirmed: total, pending: total }

      bookingsSnap.forEach((d) => {
        const data = d.data();
        const uid = data.payoutUid || data.hostId || data.ownerId || data.hostUid || data.partnerUid || null;
        if (!uid) return;

        const amount = Number(data.amountLockedN ?? data.amountN ?? data.totalAmount ?? data.amount ?? 0) || 0;
        if (!realByUid.has(uid)) realByUid.set(uid, { confirmed: 0, pending: 0 });
        const entry = realByUid.get(uid);

        if (isRealBooking(data)) {
          entry.confirmed += amount;
        } else if (!data.archived) {
          entry.pending += amount;
        }
      });

      // 3. Cross-reference: flag wallets whose balance exceeds real bookings
      const flagged = [];

      for (const w of wallets) {
        const real = realByUid.get(w.uid) || { confirmed: 0, pending: 0 };
        const totalReal = real.confirmed + real.pending;
        const totalWallet = w.available + w.pending;

        // Flag if wallet balance > 110% of real bookings (10% tolerance for fees/rounding)
        // OR if wallet has balance but there are zero real bookings at all
        const hasNoRealBookings = totalReal === 0;
        const exceedsReal = totalWallet > totalReal * 1.1 && totalWallet > 5000; // ignore tiny rounding

        if (hasNoRealBookings || exceedsReal) {
          flagged.push({
            uid: w.uid,
            available: w.available,
            pending: w.pending,
            totalWallet,
            realConfirmed: real.confirmed,
            realPending: real.pending,
            totalReal,
            reason: hasNoRealBookings ? "No real bookings found" : `Wallet ₦${w.totalWallet?.toLocaleString()} exceeds booking total ₦${totalReal?.toLocaleString()}`,
          });
        }
      }

      flagged.sort((a, b) => b.totalWallet - a.totalWallet);
      setResults({ flagged, walletsChecked: wallets.length });
      addLog(`Scan complete. ${flagged.length} wallet(s) flagged out of ${wallets.length} checked.`);
    } catch (e) {
      notify(`Wallet scan failed: ${e?.message || e}`, "error");
      addLog(`ERROR: ${e?.message || e}`);
    } finally {
      setScanning(false);
    }
  }, [notify]);

  const toggleAll = () => {
    const flagged = results?.flagged || [];
    if (selected.size === flagged.length) setSelected(new Set());
    else setSelected(new Set(flagged.map((r) => r.uid)));
  };

  const toggleOne = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = (results?.flagged || []).filter((r) => selected.has(r.uid));
    if (!rows.length) { notify("Select at least one wallet to export.", "error"); return; }
    const header = "uid,available,pending,totalWallet,realConfirmed,realPending,totalReal,reason";
    const lines = rows.map((r) =>
      [r.uid, r.available, r.pending, r.totalWallet, r.realConfirmed, r.realPending, r.totalReal, `"${r.reason}"`].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `wallet-reconciliation-${Date.now()}.csv`);
    addLog(`Exported ${rows.length} row(s) as CSV.`);
  };

  const zeroWallets = useCallback(async () => {
    if (!selected.size) { notify("Select at least one wallet.", "error"); return; }
    setProcessing(true);
    let done = 0; let failed = 0;

    // Firestore batch writes — max 500 per batch
    const uids = Array.from(selected);
    const CHUNK = 499;
    for (let i = 0; i < uids.length; i += CHUNK) {
      const batch = writeBatch(db);
      uids.slice(i, i + CHUNK).forEach((uid) => {
        batch.update(doc(db, "wallets", uid), {
          available: 0,
          pending: 0,
          reconciledAt: serverTimestamp(),
          reconciledBy: getAuth().currentUser?.uid || "admin",
          reconciledReason: "admin_reconciliation_zero",
        });
      });
      try {
        await batch.commit();
        done += Math.min(CHUNK, uids.length - i);
      } catch (e) {
        console.error("Batch zero failed:", e);
        failed += Math.min(CHUNK, uids.length - i);
      }
    }

    const msg = `Zeroed ${done} wallet(s).${failed ? ` ${failed} failed — check console.` : ""}`;
    addLog(msg);
    notify(msg, failed ? "error" : "success");
    // Remove zeroed wallets from results
    setResults((prev) => prev ? { ...prev, flagged: prev.flagged.filter((r) => !selected.has(r.uid)) } : prev);
    setSelected(new Set());
    setProcessing(false);
  }, [selected, notify]);

  const allSelected = (results?.flagged?.length > 0) && selected.size === results.flagged.length;
  const someSelected = selected.size > 0;

  return (
    <div className="space-y-4">

      {/* Explainer */}
      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 text-[12px] text-white/45 leading-relaxed">
        <strong className="text-white/65">How it works:</strong> Loads every wallet with a non-zero balance, then cross-references against real confirmed bookings for that host/partner UID.
        Wallets with no real bookings, or balances more than 10% above total real booking value, are flagged.
        <br/>
        <strong className="text-white/65">Zero wallet</strong> sets <span className="font-mono text-white/60">available: 0, pending: 0</span> and records <span className="font-mono text-white/60">reconciledAt</span> for audit. Export as CSV first.
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        className="rounded-xl bg-[#f5c000] px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_8px_20px_rgba(245,192,0,0.18)] transition hover:brightness-105 disabled:opacity-40"
      >
        {scanning ? "Scanning wallets…" : "Scan wallets vs bookings"}
      </button>

      {results !== null && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-white/70">
              {results.flagged.length === 0
                ? `No mismatches found across ${results.walletsChecked} wallet(s).`
                : `${results.flagged.length} wallet(s) flagged out of ${results.walletsChecked} checked`}
            </span>
            {results.flagged.length > 0 && (
              <Badge tone={results.flagged.length > 5 ? "rose" : "amber"}>{results.flagged.length} flagged</Badge>
            )}
            {someSelected && <Badge tone="amber">{selected.size} selected</Badge>}
          </div>

          {results.flagged.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleAll}
                  className="rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/8 hover:text-white"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                {someSelected && (
                  <>
                    <LuxeBtn small kind="slate" onClick={exportCsv} disabled={processing}>
                      Export CSV ({selected.size})
                    </LuxeBtn>
                    <LuxeBtn small kind="slate" onClick={zeroWallets} disabled={processing} loading={processing}>
                      Zero wallets ({selected.size})
                    </LuxeBtn>
                  </>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-white/8">
                <div className="grid grid-cols-[28px_minmax(0,1fr)_110px_110px_110px_minmax(0,1.4fr)] border-b border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                  <div />
                  <div>UID</div>
                  <div className="text-right">Wallet bal.</div>
                  <div className="text-right">Real bookings</div>
                  <div className="text-right">Gap</div>
                  <div>Reason</div>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {results.flagged.map((row) => {
                    const checked = selected.has(row.uid);
                    const gap = row.totalWallet - row.totalReal;
                    return (
                      <div
                        key={row.uid}
                        onClick={() => toggleOne(row.uid)}
                        className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_110px_110px_110px_minmax(0,1.4fr)] items-center border-b border-white/5 px-3 py-2.5 transition
                          ${checked ? "bg-rose-500/5" : "hover:bg-white/[0.02]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(row.uid)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 accent-rose-400"
                        />
                        <span className="truncate font-mono text-[11px] text-white/60">{row.uid}</span>
                        <span className="text-right text-[12px] font-bold text-white">
                          ₦{row.totalWallet.toLocaleString()}
                        </span>
                        <span className="text-right text-[12px] text-white/60">
                          ₦{row.totalReal.toLocaleString()}
                        </span>
                        <span className={`text-right text-[12px] font-bold ${gap > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {gap > 0 ? "+" : ""}₦{gap.toLocaleString()}
                        </span>
                        <span className="truncate text-[11px] text-white/45">{row.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-xl border border-white/6 bg-[#0b0f15] px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Activity log</p>
          <div className="max-h-[100px] overflow-y-auto space-y-1">
            {log.map((entry, i) => (
              <p key={i} className="font-mono text-[12px] text-white/50">{entry}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── main component ─────────────────────────────── */
export default function AdminDataTools() {
  const { showToast } = useToast();

  const notify = useCallback(
    (msg, type = "info") => { try { showToast?.(msg, type); } catch { /* no-op */ } },
    [showToast]
  );

  const [busy, setBusy]         = useState(false);
  const [lastInfo, setLastInfo] = useState("");

  const exportTargets = useMemo(() => [
    { path: "/admin/users/export.csv",    filename: "users" },
    { path: "/admin/listings/export.csv", filename: "listings" },
    { path: "/admin/bookings/export.csv", filename: "bookings" },
    { path: "/admin/payouts/export.csv",  filename: "payouts" },
  ], []);

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
      const serverMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Export failed.";
      setLastInfo(serverMsg);
      notify(serverMsg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090d12] pb-10 text-white">
      <div className="mx-auto max-w-5xl px-5 pt-6">
        <AdminHeader
          back
          title="Data tools"
          subtitle="Exports, maintenance, and cleanup operations."
          rightActions={
            <LuxeBtn small kind="slate" onClick={() => window.location.reload()} disabled={busy}>
              Refresh
            </LuxeBtn>
          }
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_0.5fr]">
          <div className="space-y-5">

            {/* ── Junk booking cleaner ── */}
            <Panel
              title="Junk booking cleaner"
              subtitle="Find and remove abandoned pre-payment booking records that inflate stats and wallet balances."
            >
              <JunkBookingCleaner notify={notify} />
            </Panel>

            {/* ── Wallet reconciliation ── */}
            <Panel
              title="Wallet reconciliation"
              subtitle="Scan host/partner wallet balances against real confirmed bookings. Zero out inflated test balances."
            >
              <WalletReconciler notify={notify} />
            </Panel>

            {/* ── CSV exports ── */}
            <Panel title="Quick exports (CSV)" subtitle="Server-side exports for admin records and audit trails.">
              <p className="mb-4 text-[13px] text-white/55">
                Generates CSV exports via admin API. Downloads users, listings, bookings, and payouts as a pack.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LuxeBtn kind="gold" onClick={exportCsvPack} disabled={busy} loading={busy}>
                  {busy ? "Exporting…" : "Export CSV pack"}
                </LuxeBtn>
                <span className="text-[12px] text-white/40">
                  {busy ? "Working…" : lastInfo || "No export yet."}
                </span>
              </div>
              <div className="mt-3 text-[12px] text-white/30">
                Includes: users, listings, bookings, payouts.
              </div>
            </Panel>

            {/* ── Maintenance placeholder ── */}
            <Panel title="Maintenance jobs" subtitle="Future admin-only Cloud Function hooks.">
              <p className="text-[13px] text-white/45 leading-relaxed">
                Planned: anonymise user data on request · recalculate analytics · re-run payout reconciliation · rebuild reporting snapshots.
                Wire these to protected admin API jobs or Cloud Functions when needed.
              </p>
            </Panel>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Panel title="Notes">
              <ul className="space-y-2 text-[13px] text-white/55 leading-relaxed">
                <li>· Archive is reversible — sets <span className="font-mono text-white/70">archived: true</span>. Hard delete is permanent.</li>
                <li>· Wallet zero sets <span className="font-mono text-white/70">available: 0, pending: 0</span> and writes <span className="font-mono text-white/70">reconciledAt</span> for audit.</li>
                <li>· Export CSV before any destructive action — keep a record.</li>
                <li>· Bookings with any payment reference are never flagged as junk.</li>
                <li>· Wallets within 10% of real booking total are not flagged (rounding tolerance).</li>
                <li>· Keep admin routes protected with Firebase admin role checks.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}