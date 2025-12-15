// src/pages/HostReservationsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

const toDateObj = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
};

const fmtDate = (v, fallback = "—") => {
  const d = toDateObj(v);
  if (!d || isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isPast = (checkOut) => {
  const d = toDateObj(checkOut);
  if (!d) return false;
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const isAttentionStatus = (statusRaw) => {
  const s = String(statusRaw || "").toLowerCase();
  return [
    "pending",
    "hold",
    "hold-pending",
    "change-request",
    "date-change",
    "cancel-request",
    "cancel_request",
    "refund_requested",
  ].includes(s);
};

// Normalise a Firestore booking row into something consistent
const normalizeBooking = (docSnap) => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  const listingTitle =
    data.listingTitle ||
    data.listing?.title ||
    data.title ||
    "Listing";

  const guestEmail =
    data.guestEmail ||
    data.userEmail ||
    data.email ||
    "—";

  const amount =
    Number(
      data.amountN ??
        data.total ??
        data.totalAmount ??
        data.amount ??
        0
    ) || 0;

  return {
    id,
    ...data,
    listingTitle,
    guestEmail,
    amount,
    checkIn: data.checkIn ?? data.checkin ?? data.startDate ?? data.from,
    checkOut: data.checkOut ?? data.checkout ?? data.endDate ?? data.to,
    createdAt: data.createdAt ?? data.created ?? data.created_on,
  };
};

export default function HostReservationsPage({
  ownerField = "hostId",
  pageTitle = "Host reservations",
}) {
  const { user } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); // all | upcoming | past | attention
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState({}); // per-row action state

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user?.uid) return;
      setLoading(true);
      setErr("");

      try {
        const qRef = query(
          collection(db, "bookings"),
          where(ownerField, "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qRef);
        if (!alive) return;

        const out = snap.docs.map((d) => normalizeBooking(d));
        setRows(out);
      } catch (e) {
        console.error("[HostReservations] load failed:", e);
        if (alive) {
          setErr("Could not load reservations right now.");
          setRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [user?.uid, ownerField]);

  // Derived lists
  const filtered = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (tab === "upcoming") {
      return rows.filter((r) => !isPast(r.checkOut));
    }
    if (tab === "past") {
      return rows.filter((r) => isPast(r.checkOut));
    }
    if (tab === "attention") {
      return rows.filter((r) => isAttentionStatus(r.status));
    }
    return rows;
  }, [rows, tab]);

  const stats = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;
    let refunded = 0;
    let attention = 0;
    let gross = 0;

    rows.forEach((r) => {
      const s = String(r.status || "").toLowerCase();
      gross += r.amount || 0;

      if (["confirmed", "paid", "completed"].includes(s)) confirmed += 1;
      else if (["pending", "hold", "reserved_unpaid", "awaiting_payment"].includes(s))
        pending += 1;
      else if (s === "cancelled" || s === "canceled") cancelled += 1;
      else if (s === "refunded") refunded += 1;

      if (isAttentionStatus(s)) attention += 1;
    });

    return {
      confirmed,
      pending,
      cancelled,
      refunded,
      attention,
      gross,
      total: rows.length,
    };
  }, [rows]);

  const openDrawerFor = (row) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
  };

  const markBusy = (id, flag) =>
    setBusy((prev) => ({ ...prev, [id]: flag }));

  // Host-side actions
  const handleConfirm = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Confirm this booking for the guest?")) return;

    markBusy(row.id, true);
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "confirmed",
        cancelRequested: false,
        cancellationRequested: false,
        updatedAt: new Date(),
      });
      setRows((list) =>
        list.map((b) =>
          b.id === row.id
            ? {
                ...b,
                status: "confirmed",
                cancelRequested: false,
                cancellationRequested: false,
              }
            : b
        )
      );
      alert("Booking confirmed.");
    } catch (e) {
      console.error("[HostReservations] confirm failed:", e);
      alert("Could not confirm booking. Please try again.");
    } finally {
      markBusy(row.id, false);
    }
  };

  const handleCancel = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Cancel this booking?")) return;

    markBusy(row.id, true);
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "cancelled",
        updatedAt: new Date(),
      });
      setRows((list) =>
        list.map((b) =>
          b.id === row.id ? { ...b, status: "cancelled" } : b
        )
      );
      alert("Booking cancelled.");
    } catch (e) {
      console.error("[HostReservations] cancel failed:", e);
      alert("Could not cancel booking. Please try again.");
    } finally {
      markBusy(row.id, false);
    }
  };

  const handleRefund = async (row) => {
    if (!row?.id) return;
    if (
      !window.confirm(
        "Mark this booking as refunded? Make sure you have processed payment in your gateway."
      )
    )
      return;

    markBusy(row.id, true);
    try {
      await updateDoc(doc(db, "bookings", row.id), {
        status: "refunded",
        updatedAt: new Date(),
      });
      setRows((list) =>
        list.map((b) =>
          b.id === row.id ? { ...b, status: "refunded" } : b
        )
      );
      alert("Booking marked as refunded.");
    } catch (e) {
      console.error("[HostReservations] refund failed:", e);
      alert("Could not update refund status. Please try again.");
    } finally {
      markBusy(row.id, false);
    }
  };

  const handleMessage = (row) => {
    if (!row?.id) return;
    // Use the booking-based chat route (you already wired in AppRouter)
    nav(`/booking/${row.id}/chat`, {
      state: {
        booking: row,
        from: ownerField === "partnerUid" ? "partner-reservations" : "host-reservations",
      },
    });
  };

  return (
    <main className="min-h-screen bg-[#05070b] text-white pt-20 pb-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {pageTitle || "Host reservations"}
            </h1>
            <p className="text-sm text-white/70 mt-1">
              Review guest bookings, confirm or decline stays, and open
              guest-facing receipts and check-in guides from one place.
            </p>
          </div>
          <button
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs md:text-sm hover:bg-white/10"
          >
            ← Back
          </button>
        </header>

        {/* Small KPI row */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4 text-xs md:text-sm">
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Confirmed" value={stats.confirmed} tone="emerald" />
          <Kpi label="Pending" value={stats.pending} tone="amber" />
          <Kpi label="Cancelled" value={stats.cancelled} tone="rose" />
          <Kpi label="Refunded" value={stats.refunded} />
          <Kpi
            label="Needs attention"
            value={stats.attention}
            tone="amberStrong"
          />
        </section>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            ["all", "All"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["attention", "Needs attention"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                tab === key
                  ? "bg-amber-500 text-black border-amber-400"
                  : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
            Loading reservations…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-100">
            {err}
          </div>
        )}

        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm">
            <p className="font-semibold mb-1">No reservations found.</p>
            <p className="text-white/70">
              Once guests book your listing, reservations will appear here.
            </p>
          </div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <section className="space-y-3">
            {filtered.map((row) => {
              const s = String(row.status || "").toLowerCase();
              const showAttentionBadge = isAttentionStatus(s);
              const id = row.id;

              return (
                <button
                  key={id}
                  onClick={() => openDrawerFor(row)}
                  className="w-full text-left rounded-2xl bg-[#0b0f15] border border-white/10 hover:border-amber-300/70 hover:bg-[#111826] transition shadow-[0_14px_40px_rgba(0,0,0,0.35)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">
                          {row.listingTitle}
                        </p>
                        <StatusChip status={s} />
                        {showAttentionBadge && (
                          <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                            Needs attention
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">
                        Guest: {row.guestEmail}
                      </p>
                      <p className="text-xs text-white/50 mt-0.5">
                        {fmtDate(row.checkIn)} → {fmtDate(row.checkOut)} ·{" "}
                        {row.guests || 1} guest(s)
                      </p>
                    </div>
                    <div className="text-right text-xs md:text-sm">
                      <div className="font-semibold">
                        {ngn(row.amount || 0)}
                      </div>
                      <div className="text-white/50 mt-0.5">
                        Ref:{" "}
                        <span className="font-mono">
                          {(row.reference || row.id || "—")
                            .toString()
                            .slice(0, 10)}
                        </span>
                      </div>
                      {busy[id] && (
                        <div className="text-[10px] text-amber-200 mt-1">
                          Updating…
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>

      {/* Booking detail drawer */}
      <BookingDetailDrawer
        open={drawerOpen}
        booking={selected}
        onClose={closeDrawer}
        onConfirm={
          selected ? () => handleConfirm(selected) : undefined
        }
        onCancel={
          selected ? () => handleCancel(selected) : undefined
        }
        onRefund={
          selected ? () => handleRefund(selected) : undefined
        }
        onMessage={selected ? () => handleMessage(selected) : undefined}
      />
    </main>
  );
}

/* ---------- Small subcomponents ---------- */

function Kpi({ label, value, tone }) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-500/10"
      : tone === "amber"
      ? "border-amber-400/40 bg-amber-500/10"
      : tone === "amberStrong"
      ? "border-amber-300/70 bg-amber-500/15"
      : tone === "rose"
      ? "border-rose-400/40 bg-rose-500/10"
      : "border-white/10 bg-white/5";

  return (
    <div
      className={`rounded-2xl px-3 py-2 border ${toneClasses} flex flex-col justify-between`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/55">
        {label}
      </div>
      <div className="mt-1 text-base md:text-lg font-semibold">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const s = String(status || "").toLowerCase();
  let classes =
    "border-slate-400/50 text-slate-200 bg-slate-500/10";
  if (s === "confirmed" || s === "paid") {
    classes =
      "border-emerald-400/60 text-emerald-200 bg-emerald-500/10";
  } else if (s === "cancelled" || s === "canceled") {
    classes = "border-rose-400/60 text-rose-200 bg-rose-500/10";
  } else if (s === "refunded") {
    classes =
      "border-amber-400/60 text-amber-200 bg-amber-500/10";
  } else if (isAttentionStatus(s)) {
    classes =
      "border-amber-400/60 text-amber-100 bg-amber-500/10";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] capitalize border ${classes}`}
    >
      {s || "pending"}
    </span>
  );
}

/* ---------- Booking detail drawer (with receipt + check-in buttons) ---------- */

function BookingDetailDrawer({
  open,
  booking,
  onClose,
  onConfirm,
  onCancel,
  onRefund,
  onMessage,
}) {
  const nav = useNavigate();

  const [contact, setContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactErr, setContactErr] = useState("");

  useEffect(() => {
    // Reset contact state each time a new booking is opened
    if (open && booking?.id) {
      setContact(null);
      setContactErr("");
      setContactLoading(false);
    }
  }, [open, booking?.id]);

  if (!open || !booking) return null;

  const s = String(booking.status || "").toLowerCase();

  const isConfirmable = ["pending", "hold", "reserved_unpaid", "awaiting_payment"].includes(s);
  const isRefundable = s === "confirmed" || s === "paid";
  const isCancelable = ["pending", "hold", "reserved_unpaid", "confirmed", "paid"].includes(s);

  const goReceipt = () => nav("/booking-complete", { state: { booking } });
  const goCheckin = () => booking.id && nav(`/checkin/${booking.id}`, { state: { booking } });

  const datesLabel = () => {
    const ci = toDateObj(booking.checkIn);
    const co = toDateObj(booking.checkOut);
    const fmt = (d) =>
      d
        ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : "—";
    return `${fmt(ci)} → ${fmt(co)}`;
  };

  const amount = booking.amountN || booking.total || booking.amount || 0;

  const fetchContact = async () => {
    if (!booking?.id) return;

    setContactLoading(true);
    setContactErr("");
    try {
      const res = await fetch(`${API_BASE}/bookings/${booking.id}/contact`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      // Try to read JSON safely
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const msg =
          payload?.message ||
          payload?.error ||
          (res.status === 403
            ? "Contact details are locked right now (timing/subscription/KYC rule)."
            : "Could not fetch contact details.");
        setContactErr(msg);
        setContact(null);
        return;
      }

      setContact({
        phone: payload?.phone || null,
        email: payload?.email || null,
      });

      if (!payload?.phone && !payload?.email) {
        setContactErr("No contact details found for this booking.");
      }
    } catch (e) {
      console.error("fetchContact failed:", e);
      setContactErr("Network error: could not fetch contact details.");
      setContact(null);
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-[#05070b] border-l border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Booking details</h2>
            <p className="text-xs text-white/50">
              {booking.listingTitle || booking.title || "Listing"} · {booking.guestEmail || "guest"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-white/5 border border-white/15 text-xs hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs text-white/60">Dates</div>
            <div className="font-semibold mt-0.5">{datesLabel()}</div>
            <div className="text-xs text-white/60 mt-1">
              {booking.nights || 0} night(s) · {booking.guests || 1} guest(s)
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs text-white/60">Amount</div>
            <div className="font-semibold mt-0.5">{ngn(amount)}</div>
            <div className="text-xs text-white/60 mt-1">
              Provider: {booking.provider || "—"} · Ref: {booking.reference || booking.id || "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs text-white/60">Status</div>
            <div className="mt-1 inline-flex items-center gap-2">
              <StatusChip status={s} />
              {booking.cancelRequested ||
              booking.cancellationRequested ||
              s === "cancel_request" ||
              s === "refund_requested" ? (
                <span className="px-2 py-1 rounded-md border border-amber-400/40 bg-amber-500/10 text-[11px] text-amber-200">
                  Cancellation requested
                </span>
              ) : null}
            </div>
          </div>

          {/* ✅ Contact reveal card */}
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-white/60">Contact details</div>
                <div className="text-[11px] text-white/45 mt-1">
                  Locked until eligible (confirmed booking + timing/subscription/KYC rules).
                </div>
              </div>

              <button
                onClick={fetchContact}
                disabled={contactLoading}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  contactLoading
                    ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                    : "bg-amber-500 text-black border-amber-400 hover:brightness-110"
                }`}
              >
                {contactLoading ? "Checking…" : "Reveal"}
              </button>
            </div>

            {contactErr ? (
              <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                {contactErr}
              </div>
            ) : null}

            {contact && (contact.phone || contact.email) ? (
              <div className="mt-3 space-y-2">
                {contact.phone ? (
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs text-white/60">Phone</div>
                    <div className="text-sm font-semibold">{contact.phone}</div>
                  </div>
                ) : null}

                {contact.email ? (
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs text-white/60">Email</div>
                    <div className="text-sm font-semibold">{contact.email}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-white/10 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={goReceipt}
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs hover:bg-white/10"
            >
              Open receipt
            </button>
            <button
              onClick={goCheckin}
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs hover:bg-white/10"
            >
              Check-in guide
            </button>
          </div>

          <div className="flex flex-wrap gap-2 ml-auto">
            {isConfirmable && onConfirm && (
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-black hover:bg-emerald-500"
              >
                Confirm
              </button>
            )}
            {isCancelable && onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs border border-white/20 hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
            {isRefundable && onRefund && (
              <button
                onClick={onRefund}
                className="px-3 py-1.5 rounded-xl bg-red-700/80 text-xs text-red-50 border border-red-400/60 hover:bg-red-700"
              >
                Refund
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="px-3 py-1.5 rounded-xl bg-gray-800 text-xs border border-white/20 hover:bg-gray-700"
              >
                Message guest
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
