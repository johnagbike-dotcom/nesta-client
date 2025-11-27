// src/pages/HostReservationsPage.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { markBookingExpiredFS, markBookingRefundedFS } from "../api/bookings";

// ---------- small helpers ----------
const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;
const toDateStr = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleDateString();
  if (v?.seconds) return new Date(v.seconds * 1000).toLocaleDateString();
  if (typeof v === "string" || typeof v === "number")
    return new Date(v).toLocaleDateString();
  return "—";
};
const byCreatedDesc = (a, b) => (b._createdMs || 0) - (a._createdMs || 0);

// for the countdown on pending holds
function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Remaining({ expiresAt }) {
  useTick(1000);
  if (!expiresAt) return <span className="text-gray-400">—</span>;
  const end = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const left = Math.max(0, end.getTime() - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const label = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return left > 0 ? (
    <span className="text-amber-300 font-mono text-sm">{label}</span>
  ) : (
    <span className="text-red-300 text-sm">Expired</span>
  );
}

// shared modal
function ReasonModal({ open, title, confirmLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1419] p-5">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-white/70 mt-1">
          Add an optional note — guest will see this in their booking details.
        </p>
        <textarea
          className="w-full mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none min-h-[90px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)…"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * MAIN PAGE
 * ownerField = "hostId"  → Host reservations
 * ownerField = "partnerUid" → Partner reservations
 */
export default function HostReservationsPage({
  ownerField = "hostId",
  pageTitle = "Reservations",
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { showToast: toast } = useToast();

  const initialFilter =
    loc.state?.status && loc.state.status !== "any"
      ? loc.state.status
      : "all";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);

  // modal for cancel / refund / decline
  const [modal, setModal] = useState({
    open: false,
    mode: null,
    booking: null,
  });

  // -------- live subscription ----------
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const qRef = query(
      collection(db, "bookings"),
      where(ownerField, "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => {
          const x = d.data() || {};
          return {
            id: d.id,
            ...x,
            _createdMs: x.createdAt?.toMillis?.() ?? x.createdAt?.seconds
              ? x.createdAt.seconds * 1000
              : 0,
          };
        });
        setRows(list.sort(byCreatedDesc));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, ownerField]);

  // -------- derived buckets ----------
  const needsAttention = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.cancellationRequested === true ||
          r.dateChangeRequested === true ||
          (r.status || "").toLowerCase() === "pending"
      ),
    [rows]
  );

  const confirmed = useMemo(
    () =>
      rows.filter((r) =>
        ["confirmed", "paid"].includes((r.status || "").toLowerCase())
      ),
    [rows]
  );

  const ended = useMemo(
    () =>
      rows.filter((r) =>
        ["cancelled", "refunded", "expired", "failed"].includes(
          (r.status || "").toLowerCase()
        )
      ),
    [rows]
  );

  // ---- actions ----
  const openModal = (mode, booking) =>
    setModal({ open: true, mode, booking: booking || null });

  const closeModal = () => setModal({ open: false, mode: null, booking: null });

  async function approveCancel(booking, reason = "") {
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "cancelled",
        cancellationRequested: false,
        cancelApproval: {
          by: user?.uid || null,
          at: serverTimestamp(),
          reason: reason || null,
        },
        updatedAt: serverTimestamp(),
      });
      toast("Cancellation approved.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not approve cancellation.", "error");
    }
  }

  async function approveRefund(booking, reason = "") {
    try {
      await markBookingRefundedFS(booking.id, "host_approved_refund", {
        cancelApproval: {
          by: user?.uid || null,
          at: serverTimestamp(),
          reason: reason || null,
        },
      });
      toast("Refund marked.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not mark refund.", "error");
    }
  }

  async function declineCancel(booking, reason = "") {
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        cancellationRequested: false,
        cancelDeclined: {
          by: user?.uid || null,
          at: serverTimestamp(),
          reason: reason || null,
        },
        updatedAt: serverTimestamp(),
      });
      toast("Request declined.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not decline.", "error");
    }
  }

  async function approveDateChange(booking, reason = "") {
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        dateChangeRequested: false,
        checkIn: booking.newCheckIn || booking.checkIn,
        checkOut: booking.newCheckOut || booking.checkOut,
        dateChangeApproval: {
          by: user?.uid || null,
          at: serverTimestamp(),
          reason: reason || null,
        },
        updatedAt: serverTimestamp(),
      });
      toast("Dates updated for guest.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not approve date change.", "error");
    }
  }

  async function releaseHold(booking) {
    try {
      await markBookingExpiredFS(booking.id);
      toast("Hold released.", "success");
    } catch (e) {
      console.error(e);
      toast("Could not release hold.", "error");
    }
  }

  // resolve guest → open chat
  async function resolveGuestId(bk) {
    if (bk.userId) return bk.userId;
    const email = (bk.email || bk.userEmail || bk.guestEmail || "").toLowerCase();
    if (!email) return null;
    let snap = await getDocs(
      query(collection(db, "users"), where("emailLower", "==", email))
    );
    if (!snap.empty) return snap.docs[0].id;
    snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    return snap.empty ? null : snap.docs[0].id;
  }

  async function openChat(bk) {
    const guestId = await resolveGuestId(bk);
    if (!guestId) {
      alert("Guest record not found for this booking.");
      return;
    }
    const listingId = bk.listingId || bk.listing?.id || null;
    const title = bk.title || bk.listingTitle || "Listing";
    const partnerUid = user?.uid;
    nav("/chat", {
      state: {
        partnerUid,
        guestId,
        listing: { id: listingId, title },
        from: "reservations",
        bookingId: bk.id,
      },
    });
  }

  // pick list to show based on filter tab
  const listToShow = useMemo(() => {
    if (filter === "needs_attention") return needsAttention;
    if (filter === "confirmed") return confirmed;
    if (filter === "ended") return ended;
    return rows;
  }, [filter, rows, needsAttention, confirmed, ended]);

  // ---------- render ----------
  return (
    <main className="min-h-screen bg-[#0b0f14] text-white px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-amber-400">
              {pageTitle}
            </h1>
            <p className="text-white/60 text-sm">
              Manage guest bookings, approve cancellations, and chat guests.
            </p>
          </div>
          <button
            onClick={() => nav(-1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
          >
            ← Back
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3">
            <div className="text-sm text-amber-200/80">Needs attention</div>
            <div className="text-2xl font-extrabold">{needsAttention.length}</div>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3">
            <div className="text-sm text-emerald-200/80">Confirmed / paid</div>
            <div className="text-2xl font-extrabold">{confirmed.length}</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/15 p-3">
            <div className="text-sm text-white/70">Ended</div>
            <div className="text-2xl font-extrabold">{ended.length}</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/15 p-3">
            <div className="text-sm text-white/70">Total</div>
            <div className="text-2xl font-extrabold">{rows.length}</div>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-3 mb-5">
          {[
            { key: "all", label: "All" },
            { key: "needs_attention", label: "Needs attention" },
            { key: "confirmed", label: "Confirmed" },
            { key: "ended", label: "Ended" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 rounded-full border text-sm ${
                filter === t.key
                  ? "bg-amber-500 text-black border-amber-400"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* list */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            Loading reservations…
          </div>
        ) : listToShow.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            Nothing here yet.
          </div>
        ) : (
          <ul className="grid gap-4">
            {listToShow.map((b) => {
              const status = (b.status || "").toLowerCase();
              const hasCancelReq = b.cancellationRequested === true;
              const hasDateReq = b.dateChangeRequested === true;

              return (
                <li
                  key={b.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap gap-3 items-start">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {b.listingTitle || b.title || "Listing"}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 border border-white/20 capitalize">
                          {status || "pending"}
                        </span>
                        {hasCancelReq && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/40 text-red-100">
                            cancel requested
                          </span>
                        )}
                        {hasDateReq && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-100">
                            date change
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white/70 mt-1">
                        Guest: {b.guestName || b.guestEmail || b.email || "—"}
                      </div>
                      <div className="text-sm text-white/70 mt-1 flex gap-4">
                        <span>
                          In: <strong>{toDateStr(b.checkIn)}</strong>
                        </span>
                        <span>
                          Out: <strong>{toDateStr(b.checkOut)}</strong>
                        </span>
                        {b.expiresAt ? (
                          <span className="flex gap-1 items-center">
                            Hold: <Remaining expiresAt={b.expiresAt} />
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right min-w-[120px]">
                      <div className="text-sm text-white/60">Amount</div>
                      <div className="text-lg font-bold">
                        {ngn(b.amountN ?? b.total ?? 0)}
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        Ref: {b.reference || "—"}
                      </div>
                    </div>
                  </div>

                  {/* action row */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        window.open(`/listing/${b.listingId || b.listing?.id}`, "_blank")
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/0 border border-white/10 hover:bg-white/10 text-sm"
                    >
                      View listing
                    </button>
                    <button
                      onClick={() => openChat(b)}
                      className="px-3 py-1.5 rounded-lg bg-white/0 border border-white/10 hover:bg-white/10 text-sm"
                    >
                      Message guest
                    </button>

                    {/* conditional actions */}
                    {status === "pending" && (
                      <button
                        onClick={() => releaseHold(b)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-400/30 text-red-50 hover:bg-red-500/25 text-sm"
                      >
                        Release hold
                      </button>
                    )}

                    {hasCancelReq && (
                      <>
                        <button
                          onClick={() => openModal("approve_cancel", b)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-50 hover:bg-emerald-500/25 text-sm"
                        >
                          Approve cancel
                        </button>
                        <button
                          onClick={() => openModal("approve_refund", b)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-50 hover:bg-amber-500/25 text-sm"
                        >
                          Approve + refund
                        </button>
                        <button
                          onClick={() => openModal("decline", b)}
                          className="px-3 py-1.5 rounded-lg bg-white/0 border border-white/15 text-sm hover:bg-white/10"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {hasDateReq && (
                      <button
                        onClick={() => openModal("approve_date", b)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-50 hover:bg-amber-500/25 text-sm"
                      >
                        Approve new dates
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* shared modal */}
      <ReasonModal
        open={modal.open}
        title={
          modal.mode === "approve_cancel"
            ? "Approve cancellation"
            : modal.mode === "approve_refund"
            ? "Approve cancellation + refund"
            : modal.mode === "approve_date"
            ? "Approve date change"
            : "Decline guest request"
        }
        confirmLabel={
          modal.mode === "approve_cancel"
            ? "Approve cancel"
            : modal.mode === "approve_refund"
            ? "Approve + refund"
            : modal.mode === "approve_date"
            ? "Apply new dates"
            : "Decline"
        }
        onClose={closeModal}
        onConfirm={async (reason) => {
          if (!modal.booking) return;
          const bk = modal.booking;
          if (modal.mode === "approve_cancel") await approveCancel(bk, reason);
          else if (modal.mode === "approve_refund") await approveRefund(bk, reason);
          else if (modal.mode === "approve_date") await approveDateChange(bk, reason);
          else await declineCancel(bk, reason);
          closeModal();
        }}
      />
    </main>
  );
}
