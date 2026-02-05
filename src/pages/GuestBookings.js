// src/pages/GuestBookings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import "../styles/polish.css";

const PAGE = 20;

/* ---------- helpers ---------- */
const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

function toDateObj(v) {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
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

function isPastDate(v) {
  const d = toDateObj(v);
  if (!d) return false;
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function compactRef(v) {
  const s = String(v || "");
  if (!s) return "—";
  return s.length <= 16 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function prettyStatus(status) {
  const s = safeLower(status);
  if (!s) return "Pending";
  if (s === "paid") return "Paid";
  if (s === "confirmed") return "Confirmed";
  if (s === "cancelled") return "Cancelled";
  if (s === "refunded") return "Refunded";
  if (s === "failed") return "Failed";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusTone(status) {
  const s = safeLower(status);
  if (s === "confirmed" || s === "paid") return "good";
  if (s === "cancelled" || s === "refunded" || s === "failed") return "bad";
  return "warn";
}

function Badge({ status = "" }) {
  const tone = statusTone(status);
  const cls =
    tone === "good"
      ? "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
      : tone === "bad"
      ? "border-rose-400/40 text-rose-200 bg-rose-500/10"
      : "border-amber-400/40 text-amber-200 bg-amber-500/10";

  return (
    <span className={`text-[11px] px-2 py-1 rounded-md border ${cls}`}>
      {prettyStatus(status)}
    </span>
  );
}

/* map firestore doc -> render row */
function mapBookingDoc(d) {
  const data = d.data ? d.data() : d;
  return {
    id: d.id || data.id,
    ...data,
    checkIn: toDateStr(data.checkIn),
    checkOut: toDateStr(data.checkOut),
    _rawCheckIn: data.checkIn,
    _rawCheckOut: data.checkOut,
  };
}

/** Deduplicate by id, keep the newest version (prefer later updatedAt/createdAt) */
function mergeUniqueById(existing, incoming) {
  const byId = new Map();
  const put = (row) => {
    if (!row?.id) return;
    const prev = byId.get(row.id);

    const prevTs =
      toDateObj(prev?.updatedAt) ||
      toDateObj(prev?.createdAt) ||
      toDateObj(prev?._rawUpdatedAt) ||
      toDateObj(prev?._rawCreatedAt);

    const nextTs =
      toDateObj(row?.updatedAt) ||
      toDateObj(row?.createdAt) ||
      toDateObj(row?._rawUpdatedAt) ||
      toDateObj(row?._rawCreatedAt);

    if (!prev) {
      byId.set(row.id, row);
      return;
    }

    const prevMs = prevTs?.getTime?.() || 0;
    const nextMs = nextTs?.getTime?.() || 0;
    if (nextMs >= prevMs) byId.set(row.id, { ...prev, ...row });
  };

  existing.forEach(put);
  incoming.forEach(put);

  // sort newest first (createdAt desc)
  const out = Array.from(byId.values());
  out.sort((a, b) => {
    const ta = (toDateObj(a.createdAt) || toDateObj(a.updatedAt) || new Date(0)).getTime();
    const tb = (toDateObj(b.createdAt) || toDateObj(b.updatedAt) || new Date(0)).getTime();
    return tb - ta;
  });
  return out;
}

export default function GuestBookings() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNavigate();
  const { showToast: toast } = useToast();

  const role = safeLower(profile?.role);
  const isGuest = !role || role === "guest"; // treat undefined as guest browsing

  /* state */
  const [tab, setTab] = useState("all"); // 'all' | 'upcoming' | 'past'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef(null);

  const [selected, setSelected] = useState(null); // details modal
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  /* edit form */
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");

  // light “Luxe” controls
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* queries */
  const baseCol = useMemo(() => collection(db, "bookings"), []);
  const liveQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(
      baseCol,
      where("guestId", "==", user.uid),
      orderBy("createdAt", "desc"),
      fsLimit(PAGE)
    );
  }, [baseCol, user?.uid]);

  /* subscribe */
  useEffect(() => {
    if (!user?.uid || !liveQuery) {
      setRows([]);
      setLoading(false);
      setErr("");
      return;
    }

    setLoading(true);
    setErr("");

    const unsub = onSnapshot(
      liveQuery,
      (snap) => {
        const list = snap.docs.map(mapBookingDoc);

        // merge with any older pages we may have loaded
        setRows((cur) => mergeUniqueById(cur, list));

        const last = snap.docs[snap.docs.length - 1] || null;
        lastDocRef.current = last;

        // ✅ hasMore should be “page is full” and we have a cursor
        setHasMore(Boolean(last) && snap.size === PAGE);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setErr("Couldn't load your bookings.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [liveQuery, user?.uid]);

  /* pagination */
  async function loadOlder() {
    if (!lastDocRef.current || !user?.uid) return;

    try {
      setLoadingMore(true);

      const snap = await getDocs(
        query(
          baseCol,
          where("guestId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastDocRef.current),
          fsLimit(PAGE)
        )
      );

      const more = snap.docs.map(mapBookingDoc);

      // advance cursor
      const last = snap.docs[snap.docs.length - 1] || null;
      lastDocRef.current = last;

      // ✅ same rule: page full + cursor
      setHasMore(Boolean(last) && snap.size === PAGE);

      // merge to prevent duplicates
      setRows((cur) => mergeUniqueById(cur, more));
    } catch (e) {
      console.error(e);
      toast("Couldn't load older bookings.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  /* filters */
  const filtered = useMemo(() => {
    const kw = safeLower(qText);
    const wantStatus = safeLower(statusFilter);

    return rows
      .filter((b) => {
        if (tab === "upcoming") return !isPastDate(b._rawCheckOut ?? b.checkOut);
        if (tab === "past") return isPastDate(b._rawCheckOut ?? b.checkOut);
        return true;
      })
      .filter((b) => {
        if (wantStatus === "all") return true;
        return safeLower(b.status) === wantStatus;
      })
      .filter((b) => {
        if (!kw) return true;
        const hay = `${b.title || ""} ${b.listingTitle || ""} ${b.listingLocation || ""} ${b.city || ""} ${
          b.area || ""
        } ${b.reference || ""} ${b.id || ""}`.toLowerCase();
        return hay.includes(kw);
      });
  }, [rows, tab, qText, statusFilter]);

  /* actions (guest) */
  const canEdit = (b) => {
    const s = safeLower(b.status);
    const future = !isPastDate(b._rawCheckIn ?? b.checkIn);
    return s === "confirmed" && future && isGuest;
  };

  const canCancel = (b) => {
    const s = safeLower(b.status);
    const future = !isPastDate(b._rawCheckIn ?? b.checkIn);
    return s === "confirmed" && future && isGuest && !b.cancellationRequested;
  };

  const canChat = (b) => {
    const s = safeLower(b.status);
    return isGuest && (s === "confirmed" || s === "paid");
  };

  const canSeeCheckinGuide = (b) => {
    const s = safeLower(b.status);
    return isGuest && (s === "confirmed" || s === "paid");
  };

  /* Booking → luxury chat (guest side) */
  function openChatFromBooking(bk) {
    if (!bk || !bk.id) return;

    const listingId = bk.listingId || bk.listing?.id || null;
    const listingTitle = bk.title || bk.listingTitle || bk.listing?.title || "Listing";

    const hostId = bk.hostId || bk.ownerId || bk.partnerUid || bk.listingOwner || null;

    if (!listingId || !hostId) {
      toast("This booking is missing host/partner details. Please contact support.", "error");
      return;
    }

    nav(`/booking/${bk.id}/chat`, {
      state: {
        bookingId: bk.id,
        listing: { id: listingId, title: listingTitle },
        guestId: user?.uid || bk.guestId || bk.guestUid || null,
        hostId,
        from: "guest_bookings",
      },
    });
  }

  function openEdit(b) {
    setSelected(b);
    setNewCheckIn(b.checkIn || "");
    setNewCheckOut(b.checkOut || "");
    setEditOpen(true);
  }

  function openCancel(b) {
    setSelected(b);
    setCancelOpen(true);
  }

  async function submitDateChange() {
    if (!selected?.id) return;

    if (!newCheckIn || !newCheckOut) {
      toast("Pick new dates.", "warning");
      return;
    }

    // simple client guard: check-out after check-in
    if (newCheckOut <= newCheckIn) {
      toast("Check-out must be after check-in.", "warning");
      return;
    }

    try {
      await updateDoc(doc(db, "bookings", selected.id), {
        dateChangeRequested: true,
        newCheckIn,
        newCheckOut,
        updatedAt: serverTimestamp(),
      });

      toast("Date change request sent. Host/Partner will review.", "success");
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      toast("Couldn't submit date change request.", "error");
    }
  }

  async function submitCancelRequest() {
    if (!selected?.id) return;

    try {
      await updateDoc(doc(db, "bookings", selected.id), {
        cancellationRequested: true,
        updatedAt: serverTimestamp(),
      });

      toast("Cancellation request sent. Host/Partner will review.", "success");
      setCancelOpen(false);
    } catch (e) {
      console.error(e);
      toast("Couldn't submit cancellation request.", "error");
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#030509] via-[#05070d] to-[#020308] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h1
              className="text-2xl md:text-3xl font-semibold tracking-tight"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              Your bookings
            </h1>
            <p className="text-white/60 mt-2 text-sm">
              Please sign in to view your reservations.
            </p>
            <button
              onClick={() => nav("/login")}
              className="mt-4 px-4 py-2 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold hover:from-amber-300 hover:to-amber-500"
            >
              Sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!isGuest) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#030509] via-[#05070d] to-[#020308] text-white px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h1
              className="text-2xl md:text-3xl font-semibold tracking-tight"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              Guest bookings
            </h1>
            <p className="text-white/60 mt-2 text-sm">
              This page is for guest accounts. Switch role or use the correct dashboard.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => nav("/role-selection")}
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10"
              >
                Go to role selection
              </button>
              <button
                onClick={() => nav("/dashboard")}
                className="px-4 py-2 rounded-2xl bg-amber-500/90 text-black font-semibold hover:bg-amber-400"
              >
                Go to dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#030509] via-[#05070d] to-[#020308] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-amber-300/80">
                Reservations
              </p>
              <h1
                className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight"
                style={{
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                Your bookings
              </h1>
              <p className="text-sm text-white/55 mt-2">
                Manage dates, open secure chat, and access check-in guides in one place.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {["all", "upcoming", "past"].map((key) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-3 py-2 rounded-2xl border text-sm transition ${
                      active
                        ? "bg-amber-500/12 border-amber-400/40 text-amber-200"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {key[0].toUpperCase() + key.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Luxe filter bar */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                Search
              </div>
              <input
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Listing, location, reference…"
                className="mt-1 w-full bg-transparent outline-none text-sm text-white placeholder-white/35"
              />
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                Status
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full bg-transparent outline-none text-sm text-white"
              >
                <option value="all">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Results
                </div>
                <div className="mt-1 text-sm text-white/80">
                  {filtered.length} booking{filtered.length === 1 ? "" : "s"}
                </div>
              </div>
              {(qText || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setQText("");
                    setStatusFilter("all");
                  }}
                  className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/80"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </header>

        {/* States */}
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            Loading bookings…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
            {err}
          </div>
        )}

        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <p className="font-semibold text-white/90">No bookings found.</p>
            <p className="text-white/60 mt-2 text-sm">
              When you reserve a stay, it will appear here.
            </p>
            <button
              onClick={() => nav("/")}
              className="mt-4 px-4 py-2 rounded-2xl bg-amber-500/90 text-black font-semibold hover:bg-amber-400"
            >
              Explore stays
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !err && filtered.length > 0 && (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((b) => {
                const title = b.title || b.listingTitle || "Listing";
                const location = b.listingLocation || b.city || b.area || "";

                return (
                  <li
                    key={b.id}
                    className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,.55)]"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold truncate">{title}</h3>
                          <p className="text-sm text-white/55 truncate">{location}</p>

                          <div className="mt-2 text-[11px] text-white/45">
                            Ref: <span className="text-white/70">{compactRef(b.reference || b.ref || b.id)}</span>
                          </div>

                          {b.cancellationRequested && (
                            <div className="mt-2 text-[11px] text-amber-200/90">
                              Cancellation requested — awaiting host/partner.
                            </div>
                          )}

                          {b.dateChangeRequested && (
                            <div className="mt-2 text-[11px] text-amber-200/90">
                              Date change requested — awaiting host/partner.
                            </div>
                          )}
                        </div>

                        <Badge status={b.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <InfoBoxLux label="Check-in" value={b.checkIn || "—"} />
                        <InfoBoxLux label="Check-out" value={b.checkOut || "—"} />
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-white/65">
                          Guests: <span className="text-white/90 font-semibold">{b.guests || 1}</span>
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {ngn(b.amountN ?? b.total)}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => setSelected(b)}
                          className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                        >
                          View details
                        </button>

                        {canEdit(b) && (
                          <button
                            onClick={() => openEdit(b)}
                            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                          >
                            Request date change
                          </button>
                        )}

                        {canCancel(b) && (
                          <button
                            onClick={() => openCancel(b)}
                            className="px-3 py-2 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white text-sm"
                          >
                            Request cancel
                          </button>
                        )}

                        {canChat(b) && (
                          <button
                            onClick={() => openChatFromBooking(b)}
                            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                          >
                            Secure chat
                          </button>
                        )}

                        {canSeeCheckinGuide(b) && (
                          <button
                            onClick={() => nav(`/checkin/${b.id}`, { state: { booking: b } })}
                            className="px-3 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                          >
                            Check-in guide
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMore && (
              <div className="mt-8 flex items-center justify-center">
                <button
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className={`px-5 py-2.5 rounded-2xl border transition ${
                    loadingMore
                      ? "border-white/10 text-white/40 bg-white/5 cursor-wait"
                      : "border-white/15 bg-white/5 hover:bg-white/10 text-white/80"
                  }`}
                >
                  {loadingMore ? "Loading…" : "Load older"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAILS MODAL */}
      {selected && !editOpen && !cancelOpen && (
        <Modal onClose={() => setSelected(null)} title="Booking details">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold truncate">
                {selected.title || selected.listingTitle || "Booking details"}
              </h3>
              <div className="text-sm text-white/55 truncate">
                {selected.listingLocation || selected.city || selected.area || ""}
              </div>
              <div className="mt-2 text-[11px] text-white/45">
                Provider: <span className="text-white/70">{selected.provider || "—"}</span>
                <span className="mx-2 text-white/20">•</span>
                Ref: <span className="text-white/70">{compactRef(selected.reference || selected.ref || selected.id)}</span>
              </div>
            </div>
            <Badge status={selected.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <InfoBoxLux label="Check-in" value={selected.checkIn || "—"} />
            <InfoBoxLux label="Check-out" value={selected.checkOut || "—"} />
            <InfoBoxLux label="Guests" value={selected.guests || 1} />
            <InfoBoxLux label="Nights" value={selected.nights || "—"} />
          </div>

          <div className="mt-4 rounded-2xl bg-black/25 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/65">Amount</span>
              <span className="font-semibold">{ngn(selected.amountN ?? selected.total)}</span>
            </div>
            {(selected.dateChangeRequested || selected.cancellationRequested) && (
              <div className="mt-2 text-[11px] text-amber-200/90">
                {selected.dateChangeRequested ? "Date change requested." : null}
                {selected.dateChangeRequested && selected.cancellationRequested ? " " : null}
                {selected.cancellationRequested ? "Cancellation requested." : null}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {selected.listingId && (
              <button
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                onClick={() => {
                  nav(`/listing/${selected.listingId}`);
                  setSelected(null);
                }}
              >
                Open listing
              </button>
            )}

            {canSeeCheckinGuide(selected) && (
              <button
                className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                onClick={() => {
                  nav(`/checkin/${selected.id}`, { state: { booking: selected } });
                  setSelected(null);
                }}
              >
                Check-in guide
              </button>
            )}

            {canChat(selected) && (
              <button
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                onClick={() => {
                  openChatFromBooking(selected);
                  setSelected(null);
                }}
              >
                Secure chat
              </button>
            )}

            <button
              className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* EDIT (DATE CHANGE) MODAL */}
      {editOpen && selected && (
        <Modal onClose={() => setEditOpen(false)} title="Request date change">
          <p className="text-sm text-white/60 mt-1">
            Current dates:{" "}
            <span className="text-white/85 font-semibold">
              {selected.checkIn || "—"} → {selected.checkOut || "—"}
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Field label="New check-in">
              <input
                type="date"
                className="w-full bg-transparent outline-none placeholder-white/30 text-white"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
              />
            </Field>
            <Field label="New check-out">
              <input
                type="date"
                className="w-full bg-transparent outline-none placeholder-white/30 text-white"
                value={newCheckOut}
                onChange={(e) => setNewCheckOut(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={submitDateChange}
              className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
            >
              Send request
            </button>
          </div>
        </Modal>
      )}

      {/* CANCEL MODAL */}
      {cancelOpen && selected && (
        <Modal onClose={() => setCancelOpen(false)} title="Request cancellation">
          <p className="text-sm text-white/60 mt-1">
            You’re requesting to cancel your booking for{" "}
            <span className="text-white/85 font-semibold">
              {selected.title || selected.listingTitle || "this stay"}
            </span>
            . The host/partner will review and confirm the refund per policy.
          </p>

          <div className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-400/20 p-4 text-sm text-rose-100/90">
            Please only request cancellation if you’re sure. Refund outcomes depend on the host’s policy and timing.
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setCancelOpen(false)}
              className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
            >
              Keep booking
            </button>
            <button
              onClick={submitCancelRequest}
              className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-600/90 text-white font-semibold text-sm"
            >
              Send request
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ------------- Luxe UI atoms ------------- */
function Modal({ children, onClose, title }) {
  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl rounded-3xl border border-white/10 bg-[#05070b]/95 p-5 md:p-6 shadow-[0_40px_120px_rgba(0,0,0,.75)]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/70">
              Nesta
            </div>
            <div
              className="text-xl font-semibold tracking-tight mt-1"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              {title || "Details"}
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-white/80"
          >
            Close
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      {label && <div className="text-[11px] uppercase tracking-[0.16em] text-white/55 mb-2">{label}</div>}
      {children}
    </div>
  );
}

function InfoBoxLux({ label, value }) {
  return (
    <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-1 font-semibold text-white/90">{value}</div>
    </div>
  );
}
