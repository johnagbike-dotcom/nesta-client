// src/pages/ReservationsPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  startAfter,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import { useToast } from "../context/ToastContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE = 30;
const PROVIDERS = ["any", "paystack", "flutterwave", "manual"];

// ✅ Only statuses that require host attention (not ghost pre-payment records)
const ATTENTION = new Set(["cancel_request", "refund_requested"]);

// ✅ Confirmable ONLY if payment has been received. We check paymentStatus === "paid"
// in handleConfirm too — this is the UI guard for showing the button.
const CONFIRMABLE_STATUSES = new Set(["paid", "paid_pending_release", "paid-needs-review"]);

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

// ─── Real-booking guard (mirrors HostReservationsPage) ────────────────────────
const GHOST_STATUSES = new Set([
  "initialized",
  "pending",
  "hold",
  "hold-pending",
  "awaiting_payment",
  "reserved_unpaid",
  "pending_payment",
]);

function isRealBooking(row) {
  if (row.archived === true) return false;
  const s = String(row.status || "").toLowerCase();
  const hasRef = !!(row.reference || row.paymentRef || row.paymentReference || row.transactionId);
  const isPaid = String(row.paymentStatus || "").toLowerCase() === "paid" || row.paid === true;
  if (hasRef || isPaid) return true;
  if (GHOST_STATUSES.has(s)) return false;
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

function toDateObj(v) {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  if (v instanceof Date) return v;
  return null;
}
function toDateStr(v) {
  const d = toDateObj(v);
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function datesLabel(b) {
  const a = toDateStr(b.checkIn);
  const c = toDateStr(b.checkOut);
  const inD = toDateObj(b.checkIn);
  const outD = toDateObj(b.checkOut);
  const nights = inD && outD ? Math.max(0, Math.ceil((outD - inD) / (1000 * 60 * 60 * 24))) : 0;
  return `${a} → ${c}\n${nights || 0} night(s)`;
}

// ─── Friendly status labels (no raw internal strings) ────────────────────────
function prettyStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "—";
  if (s === "confirmed") return "Confirmed";
  if (s === "paid") return "Paid";
  if (s === "paid_pending_release") return "Paid · Pending release";
  if (s === "checked_in") return "Checked in";
  if (s === "released") return "Released";
  if (s === "completed") return "Completed";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "refunded") return "Refunded";
  if (s === "cancel_request") return "Cancel requested";
  if (s === "refund_requested") return "Refund requested";
  if (s === "paid-needs-review") return "Payment review";
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function Badge({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-700/25 text-emerald-300 border-emerald-400/40",
    amber: "bg-amber-700/25 text-amber-200 border-amber-400/40",
    red: "bg-red-700/25 text-red-200 border-red-400/40",
    slate: "bg-slate-700/25 text-slate-200 border-white/20",
  };
  return (
    <span className={`px-2 py-1 rounded-md border text-xs whitespace-nowrap ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  if (["confirmed", "paid", "paid_pending_release", "released", "completed", "checked_in"].includes(s))
    return <Badge tone="green">{prettyStatus(s)}</Badge>;
  if (s === "refunded" || s === "cancelled" || s === "canceled")
    return <Badge tone="red">{prettyStatus(s)}</Badge>;
  if (ATTENTION.has(s))
    return <Badge tone="amber">{prettyStatus(s)}</Badge>;
  if (s === "paid-needs-review")
    return <Badge tone="amber">{prettyStatus(s)}</Badge>;
  return <Badge>{prettyStatus(s)}</Badge>;
}

function DashCard({ label, value, highlight }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        highlight
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
          : "border-white/10 bg-white/5 text-white/90"
      }`}
    >
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ─── Inline confirm modal ────────────────────────────────────────────────────
function ConfirmModal({ open, title, body, confirmLabel = "Confirm", confirmTone = "amber", onConfirm, onCancel }) {
  if (!open) return null;
  const btnClass =
    confirmTone === "red"
      ? "bg-red-600 hover:bg-red-500 text-white border-red-500"
      : confirmTone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-500 text-black border-emerald-500"
      : "bg-amber-500 hover:bg-amber-400 text-black border-amber-400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0f17] shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-6">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        {body && <p className="text-sm text-white/65 mb-5 leading-relaxed">{body}</p>}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm bg-white/5 border border-white/15 hover:bg-white/10 text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { showToast: toast } = useToast();
  const nav = useNavigate();

  // Role gate — hosts and partners only
  const role = (profile?.role || "").toLowerCase();
  const isHostOrPartner =
    role === "host" ||
    role === "partner" ||
    role === "verified_partner" ||
    role === "pro";

  // Filters
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [providerFilter, setProviderFilter] = useState("any");

  // Data & paging
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef(null);
  const baseCol = useMemo(() => collection(db, "bookings"), []);

  // ✅ Query by hostId OR partnerUid depending on role
  const ownerField = role === "partner" || role === "verified_partner" ? "partnerUid" : "hostId";

  const liveQ = useMemo(() => {
    if (!user?.uid) return null;
    return query(
      baseCol,
      where(ownerField, "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(PAGE)
    );
  }, [baseCol, user?.uid, ownerField]);

  // Subscribe to live query
  useEffect(() => {
    if (!user?.uid || !isHostOrPartner || !liveQ) {
      setRows([]);
      setErr("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    const unsub = onSnapshot(
      liveQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data(), __doc: d }))
          .filter(isRealBooking); // ✅ filter archived + ghost records
        setRows(list);
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setErr("Could not load reservations.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [liveQ, isHostOrPartner, user?.uid]);

  // Metrics (from filtered real bookings only)
  const metrics = useMemo(() => {
    const m = { attention: 0, confirmed: 0, cancelled: 0, refunded: 0 };
    for (const r of rows) {
      const s = String(r.status || "").toLowerCase();
      if (ATTENTION.has(s)) m.attention++;
      if (["confirmed", "paid", "paid_pending_release", "released", "completed", "checked_in"].includes(s)) m.confirmed++;
      if (s === "cancelled" || s === "canceled") m.cancelled++;
      if (s === "refunded") m.refunded++;
    }
    return m;
  }, [rows]);

  // Load more (paginated)
  async function loadOlder() {
    if (!lastDocRef.current || !user?.uid) return;
    try {
      setLoadingMore(true);
      const snap = await getDocs(
        query(
          baseCol,
          where(ownerField, "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastDocRef.current),
          limit(PAGE)
        )
      );
      const more = snap.docs
        .map((d) => ({ id: d.id, ...d.data(), __doc: d }))
        .filter(isRealBooking);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setRows((cur) => [...cur, ...more]);
    } catch (e) {
      console.error(e);
      toast("Couldn't load older reservations.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  // Client-side filters
  const filtered = useMemo(() => {
    let list = rows;
    const kw = qText.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) => {
        const t = `${r.listingTitle || r.title || ""} ${r.guestEmail || ""} ${r.reference || ""} ${r.listingCity || ""} ${r.listingArea || ""}`.toLowerCase();
        return t.includes(kw);
      });
    }
    if (statusFilter !== "any") {
      if (statusFilter === "attention") {
        list = list.filter((r) => ATTENTION.has(String(r.status || "").toLowerCase()));
      } else {
        list = list.filter((r) => String(r.status || "").toLowerCase() === statusFilter);
      }
    }
    if (providerFilter !== "any") {
      list = list.filter((r) => String(r.provider || "").toLowerCase() === providerFilter);
    }
    return list;
  }, [rows, qText, statusFilter, providerFilter]);

  // ─── Row eligibility checks ────────────────────────────────────────────────
  // ✅ Only allow confirm if payment is verified as paid
  const isConfirmable = (row) => {
    const payStatus = String(row.paymentStatus || "").toLowerCase();
    const isPaid = payStatus === "paid" || row.paid === true;
    return isPaid && CONFIRMABLE_STATUSES.has(String(row.status || "").toLowerCase());
  };
  const isRefundable = (row) => {
    const s = String(row.status || "").toLowerCase();
    return ["confirmed", "paid", "paid_pending_release", "released", "checked_in"].includes(s);
  };
  const isCancelable = (row) => {
    const s = String(row.status || "").toLowerCase();
    return ["confirmed", "paid", "paid_pending_release"].includes(s);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null); // { type, row }
  const closeModal = () => setModal(null);

  const openChat = (row) => {
    const guestUid = row.guestUid || row.guestId;
    const listingId = row.listingId;
    const title = row.listingTitle || row.title || "Listing";
    if (!guestUid || !listingId) {
      toast("Guest info missing for this booking.", "error");
      return;
    }
    nav("/chat", {
      state: {
        partnerUid: guestUid,
        listing: { id: listingId, title },
        from: "reservations",
        bookingId: row.id,
      },
    });
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Exec actions ─────────────────────────────────────────────────────────
  async function execConfirm(row) {
    closeModal();
    // Double-check payment status server-side guard
    const payStatus = String(row.paymentStatus || "").toLowerCase();
    const isPaid = payStatus === "paid" || row.paid === true;
    if (!isPaid) {
      toast("Cannot confirm — payment has not been verified as paid.", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "confirmed",
        gateway: "manual_confirm",
        updatedAt: serverTimestamp(),
      });
      toast("Reservation confirmed.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not confirm reservation.", "error");
    }
  }

  async function execCancel(row) {
    closeModal();
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "cancelled",
        gateway: "cancelled_by_host",
        updatedAt: serverTimestamp(),
      });
      toast("Reservation cancelled.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not cancel reservation.", "error");
    }
  }

  async function execRefund(row) {
    closeModal();
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "refunded",
        gateway: "refund_by_host",
        updatedAt: serverTimestamp(),
      });
      toast("Reservation marked as refunded.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not refund reservation.", "error");
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">Please sign in.</div>
      </main>
    );
  }
  if (!isHostOrPartner) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="text-gray-300 mt-2">Only hosts and verified partners can view this page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white px-4 py-10">

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={modal?.type === "confirm"}
        title="Confirm this reservation?"
        body="Only use this for bookings whose payment has been verified paid. This manually stamps the record as confirmed."
        confirmLabel="Confirm reservation"
        confirmTone="emerald"
        onConfirm={() => execConfirm(modal.row)}
        onCancel={closeModal}
      />
      <ConfirmModal
        open={modal?.type === "cancel"}
        title="Cancel this reservation?"
        body="This will set the booking status to cancelled. Process any refund separately in your payment gateway."
        confirmLabel="Cancel reservation"
        confirmTone="red"
        onConfirm={() => execCancel(modal.row)}
        onCancel={closeModal}
      />
      <ConfirmModal
        open={modal?.type === "refund"}
        title="Mark as refunded?"
        body="Only mark this after you have processed the refund in Paystack or Flutterwave. This updates the booking record only."
        confirmLabel="Mark refunded"
        confirmTone="amber"
        onConfirm={() => execRefund(modal.row)}
        onCancel={closeModal}
      />
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div className="max-w-7xl mx-auto">
        <button onClick={() => nav(-1)} className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10">
          ← Back
        </button>
        <h1
          className="text-3xl font-extrabold tracking-tight mb-3"
          style={{
            fontFamily: 'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
          }}
        >
          Reservations
        </h1>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DashCard label="Needs attention" value={metrics.attention} highlight />
          <DashCard label="Confirmed" value={metrics.confirmed} />
          <DashCard label="Cancelled" value={metrics.cancelled} />
          <DashCard label="Refunded" value={metrics.refunded} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none placeholder-white/40 focus:border-amber-400/50"
            placeholder="Search by listing, email, reference…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select
            className="rounded-lg bg-[#0b0f17] border border-white/10 px-3 py-2 text-sm text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="any">Any status</option>
            <option value="attention">Needs attention</option>
            <option value="confirmed">Confirmed</option>
            <option value="paid">Paid</option>
            <option value="paid_pending_release">Paid · Pending release</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            className="rounded-lg bg-[#0b0f17] border border-white/10 px-3 py-2 text-sm text-white"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p === "any" ? "Any provider" : p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            onClick={() => { setQText(""); setStatusFilter("any"); setProviderFilter("any"); }}
          >
            Reset
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
          <table className="w-full text-sm">
            <thead className="bg-black/30">
              <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
                <th className="px-3 py-3">Listing / Guest</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Provider / Ref</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-white/50" colSpan={6}>Loading…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td className="px-3 py-4 text-red-300" colSpan={6}>{err}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-white/50" colSpan={6}>
                    No reservations found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{row.listingTitle || row.title || "—"}</div>
                      <div className="text-white/55 text-xs">{row.guestEmail || "—"}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-pre leading-5 text-white/70 text-xs">{datesLabel(row)}</td>
                    <td className="px-3 py-2 font-semibold text-amber-200">{ngn(row.amountN || row.total || row.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill status={row.status} />
                        {ATTENTION.has(String(row.status || "").toLowerCase()) && (
                          <span className="text-xs px-2 py-0.5 rounded-md border border-amber-400/40 text-amber-200 bg-amber-500/10">
                            Action needed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-white/70 uppercase">{row.provider || "—"}</div>
                      <div className="text-xs text-white/45 font-mono truncate max-w-[100px]">
                        {row.reference || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isConfirmable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-emerald-700/30 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-700/40 text-xs"
                            onClick={() => setModal({ type: "confirm", row })}
                          >
                            Confirm
                          </button>
                        )}
                        {isCancelable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-slate-700/40 text-slate-200 border border-white/15 hover:bg-slate-700/60 text-xs"
                            onClick={() => setModal({ type: "cancel", row })}
                          >
                            Cancel
                          </button>
                        )}
                        {isRefundable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-red-700/30 text-red-200 border border-red-500/40 hover:bg-red-700/45 text-xs"
                            onClick={() => setModal({ type: "refund", row })}
                          >
                            Refund
                          </button>
                        )}
                        <button
                          className="px-3 py-1 rounded-md bg-gray-700/30 text-gray-200 border border-white/15 hover:bg-gray-700/45 text-xs"
                          onClick={() => openChat(row)}
                        >
                          Message
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        <div className="mt-4 flex justify-center">
          <button
            disabled={loadingMore}
            onClick={loadOlder}
            className={`px-4 py-2 rounded-lg border text-sm ${
              loadingMore ? "opacity-50 cursor-not-allowed border-white/10" : "border-white/15 bg-white/5 hover:bg-white/10"
            }`}
          >
            {loadingMore ? "Loading…" : "Load older"}
          </button>
        </div>
      </div>
    </main>
  );
}