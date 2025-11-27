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

// ----------- constants & helpers -----------
const PAGE = 30;
const PROVIDERS = ["any", "paystack", "flutterwave", "manual"];
const CONFIRMABLE = new Set(["pending", "hold", "reserved_unpaid", "awaiting_payment"]);
const ATTENTION = new Set(["cancel_request", "refund_requested"]);
const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

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
function Badge({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-700/25 text-emerald-300 border-emerald-400/40",
    red: "bg-red-700/25 text-red-200 border-red-400/40",
    slate: "bg-slate-700/25 text-slate-200 border-white/20",
  };
  return <span className={`px-2 py-1 rounded-md border text-xs whitespace-nowrap ${tones[tone] || tones.slate}`}>{children}</span>;
}
function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return <Badge tone="green">confirmed</Badge>;
  if (s === "refunded" || s === "cancelled") return <Badge tone="red">{s}</Badge>;
  if (ATTENTION.has(s)) return <Badge tone="red">needs attention</Badge>;
  return <Badge>{s || "—"}</Badge>;
}
function DashCard({ label, value, highlight }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        highlight ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/5 text-white/90"
      }`}
    >
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { showToast: toast } = useToast();
  const nav = useNavigate();

  // role gate (hosts & partners)
  const role = (profile?.role || "").toLowerCase();
  const isHostOrPartner = role === "host" || role === "partner" || role === "verified_partner" || role === "pro";

  // filters
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState("any"); // "any" | "attention" | others
  const [providerFilter, setProviderFilter] = useState("any");

  // data & paging
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef(null);
  const baseCol = useMemo(() => collection(db, "bookings"), []);

  // live query for this host/partner
  const liveQ = useMemo(() => {
    if (!user?.uid) return null;
    return query(baseCol, where("hostId", "==", user.uid), orderBy("createdAt", "desc"), limit(PAGE));
  }, [baseCol, user?.uid]);

  // subscribe
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
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), __doc: d }));
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

  // metrics
  const metrics = useMemo(() => {
    const m = { attention: 0, confirmed: 0, cancelled: 0, refunded: 0 };
    for (const r of rows) {
      const s = String(r.status || "").toLowerCase();
      if (ATTENTION.has(s)) m.attention++;
      if (s === "confirmed") m.confirmed++;
      if (s === "cancelled") m.cancelled++;
      if (s === "refunded") m.refunded++;
    }
    return m;
  }, [rows]);

  // load more
  async function loadOlder() {
    if (!lastDocRef.current || !user?.uid) return;
    try {
      setLoadingMore(true);
      const snap = await getDocs(
        query(baseCol, where("hostId", "==", user.uid), orderBy("createdAt", "desc"), startAfter(lastDocRef.current), limit(PAGE))
      );
      const more = snap.docs.map((d) => ({ id: d.id, ...d.data(), __doc: d }));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setRows((cur) => [...cur, ...more]);
    } catch (e) {
      console.error(e);
      toast("Couldn't load older reservations.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  // computed: filtered rows (client-side quick filters)
  const filtered = useMemo(() => {
    let list = rows;
    const kw = qText.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) => {
        const t = `${r.title || ""} ${r.guestEmail || ""} ${r.reference || ""} ${r.listingCity || ""} ${r.listingArea || ""}`.toLowerCase();
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

  // actions
  const isConfirmable = (row) => CONFIRMABLE.has(String(row.status || "").toLowerCase());
  const isRefundable = (row) => String(row.status || "").toLowerCase() === "confirmed";
  const isCancelable = (row) => {
    const s = String(row.status || "").toLowerCase();
    return s === "pending" || s === "hold" || s === "reserved_unpaid" || s === "confirmed";
  };

  async function handleConfirm(row) {
    try {
      const ref = doc(db, "bookings", row.id);
      await updateDoc(ref, { status: "confirmed", gateway: "manual_confirm", updatedAt: serverTimestamp() });
      toast("Reservation confirmed.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not confirm reservation.", "error");
    }
  }
  async function handleCancel(row) {
    try {
      const ref = doc(db, "bookings", row.id);
      await updateDoc(ref, { status: "cancelled", gateway: "cancelled_by_host", updatedAt: serverTimestamp() });
      toast("Reservation cancelled.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not cancel reservation.", "error");
    }
  }
  async function handleRefund(row) {
    try {
      const ref = doc(db, "bookings", row.id);
      await updateDoc(ref, { status: "refunded", gateway: "refund_by_host", updatedAt: serverTimestamp() });
      toast("Reservation refunded.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not refund reservation.", "error");
    }
  }

  function openChat(row) {
    const guestUid = row.guestId;
    const listingId = row.listingId;
    const title = row.title || row.listingTitle || "Listing";
    if (!guestUid || !listingId) {
      alert("Guest info missing for this booking.");
      return;
    }
    nav("/chat", {
      state: {
        partnerUid: user?.uid, // fix: partner is the current host
        guestId: guestUid,
        listing: { id: listingId, title },
        from: "reservations",
        bookingId: row.id,
      },
    });
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">Please sign in.</div>
      </main>
    );
  }
  if (!isHostOrPartner) {
    return (
      <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="text-gray-300 mt-2">Only hosts and verified partners can view this page.</p>
      </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => nav(-1)} className="btn ghost mb-3">← Back</button>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Reservations</h1>

        {/* Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DashCard label="Needs attention" value={metrics.attention} highlight />
          <DashCard label="Confirmed" value={metrics.confirmed} />
          <DashCard label="Cancelled" value={metrics.cancelled} />
          <DashCard label="Refunded" value={metrics.refunded} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none placeholder-white/40"
            placeholder="Search by title, email, reference, city, area"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="any">Any status</option>
            <option value="attention">Needs attention</option>
            <option value="pending">pending</option>
            <option value="hold">hold</option>
            <option value="reserved_unpaid">reserved_unpaid</option>
            <option value="awaiting_payment">awaiting_payment</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
            <option value="refunded">refunded</option>
          </select>
          <select
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p === "any" ? "Any provider" : p}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2"
            onClick={() => {
              setQText("");
              setStatusFilter("any");
              setProviderFilter("any");
            }}
          >
            Reset
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
          <table className="w-full text-sm">
            <thead className="bg-black/30">
              <tr className="text-left">
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
                  <td className="px-3 py-4 text-gray-300" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : err ? (
                <tr>
                  <td className="px-3 py-4 text-red-300" colSpan={6}>
                    {err}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-300" colSpan={6}>
                    No reservations found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{row.title || row.listingTitle || "—"}</div>
                      <div className="text-white/70 text-xs">{row.guestEmail || "—"}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-pre leading-5">{datesLabel(row)}</td>
                    <td className="px-3 py-2">{ngn(row.amountN || row.total)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={row.status} />
                        {ATTENTION.has(String(row.status || "").toLowerCase()) && (
                          <span className="text-xs px-2 py-0.5 rounded-md border border-red-400/40 text-red-300">
                            Cancellation requested
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs uppercase opacity-90">{row.provider || "—"}</div>
                      <div className="text-xs opacity-75">{row.reference || "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-8">
                        {isConfirmable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-emerald-700/30 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-700/40"
                            onClick={() => handleConfirm(row)}
                            title="Confirm this reservation"
                          >
                            Confirm
                          </button>
                        )}
                        {isCancelable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-slate-700/40 text-slate-200 border border-white/15 hover:bg-slate-700/60"
                            onClick={() => handleCancel(row)}
                            title="Cancel this reservation"
                          >
                            Cancel
                          </button>
                        )}
                        {isRefundable(row) && (
                          <button
                            className="px-3 py-1 rounded-md bg-red-700/30 text-red-200 border border-red-500/40 hover:bg-red-700/45"
                            onClick={() => handleRefund(row)}
                            title="Refund this reservation"
                          >
                            Refund
                          </button>
                        )}
                        <button
                          className="px-3 py-1 rounded-md bg-gray-700/30 text-gray-200 border border-white/15 hover:bg-gray-700/45"
                          onClick={() => openChat(row)}
                          title="Message guest"
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

        {/* Load older */}
        <div className="mt-4 flex justify-center">
          <button
            disabled={loadingMore}
            onClick={loadOlder}
            className={`px-4 py-2 rounded-lg border ${loadingMore ? "opacity-60" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
          >
            {loadingMore ? "Loading…" : "Load older"}
          </button>
        </div>
      </div>
    </main>
  );
}