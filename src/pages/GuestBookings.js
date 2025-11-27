// src/pages/GuestBookings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  if (v instanceof Date) return v;
  return null;
}

function toDateStr(v) {
  const d = toDateObj(v);
  if (!d || isNaN(d.getTime())) return "";
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

function Badge({ status = "" }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "confirmed" || s === "paid"
      ? "border-emerald-400 text-emerald-300 bg-emerald-400/10"
      : s === "cancelled" || s === "refunded" || s === "failed"
      ? "border-red-400 text-red-300 bg-red-400/10"
      : "border-amber-400 text-amber-300 bg-amber-400/10";
  return (
    <span className={`text-xs px-2 py-1 rounded-md border ${cls}`}>
      {status || "—"}
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

export default function GuestBookings() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNavigate();
  const { showToast: toast } = useToast();

  const role = (profile?.role || "").toLowerCase();
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

  /* queries */
  const baseCol = useMemo(() => collection(db, "bookings"), []);
  const liveQuery = useMemo(() => {
    if (!user?.uid) return null;
    // we store as "guestId" — keep as is
    return query(
      baseCol,
      where("guestId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(PAGE)
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
        setRows(list);
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setHasMore(Boolean(lastDocRef.current));
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
          limit(PAGE)
        )
      );
      const more = snap.docs.map(mapBookingDoc);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(Boolean(lastDocRef.current));
      setRows((cur) => [...cur, ...more]);
    } catch (e) {
      console.error(e);
      toast("Couldn't load older bookings.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  /* filters */
  const filtered = useMemo(() => {
    if (tab === "upcoming")
      return rows.filter((b) => !isPastDate(b._rawCheckOut ?? b.checkOut));
    if (tab === "past")
      return rows.filter((b) => isPastDate(b._rawCheckOut ?? b.checkOut));
    return rows;
  }, [rows, tab]);

  /* actions (guest) */
  const canEdit = (b) => {
    const s = (b.status || "").toLowerCase();
    const future = !isPastDate(b._rawCheckIn ?? b.checkIn);
    return s === "confirmed" && future && isGuest;
  };
  const canCancel = (b) => {
    const s = (b.status || "").toLowerCase();
    const future = !isPastDate(b._rawCheckIn ?? b.checkIn);
    return s === "confirmed" && future && isGuest && !b.cancellationRequested;
  };
  const canChat = (b) => {
    const s = (b.status || "").toLowerCase();
    return isGuest && (s === "confirmed" || s === "paid");
  };

  /* ------------- 🔥 UPDATED: robust openChatFromBooking ------------- */
  async function openChatFromBooking(bk) {
    try {
      // 1) start from what booking already has
      let listingId = bk.listingId || bk.listing?.id || null;
      let partnerUid =
        bk.hostId ||
        bk.ownerId ||
        bk.partnerUid ||
        null; // support all naming variants
      let listingTitle =
        bk.title || bk.listingTitle || bk.listing?.title || "Listing";

      // 2) if booking was shallow, re-fetch booking
      if ((!listingId || !partnerUid) && bk.id) {
        const fresh = await getDoc(doc(db, "bookings", bk.id));
        if (fresh.exists()) {
          const bd = fresh.data();
          listingId = listingId || bd.listingId || bd.listing?.id || null;
          listingTitle =
            listingTitle ||
            bd.title ||
            bd.listingTitle ||
            bd.listing?.title ||
            "Listing";
          partnerUid =
            partnerUid ||
            bd.hostId ||
            bd.ownerId ||
            bd.partnerUid ||
            null;
        }
      }

      // 3) if we still don't have partner, look at the listing itself
      if (listingId && !partnerUid) {
        const lsnap = await getDoc(doc(db, "listings", listingId));
        if (lsnap.exists()) {
          const ld = lsnap.data();
          listingTitle = listingTitle || ld.title || "Listing";
          partnerUid =
            ld.ownerId || ld.hostId || ld.partnerUid || partnerUid || null;
        }
      }

      // 4) final guard
      if (!listingId || !partnerUid) {
        toast(
          "This booking doesn’t have a visible host/partner yet. Ask support to attach ownerId.",
          "error"
        );
        return;
      }

      // 5) go to chat – ChatPage.js already knows how to hydrate booking-based threads
      nav("/chat", {
        state: {
          partnerUid,
          listing: { id: listingId, title: listingTitle },
          from: "bookings",
          booking: bk,
          bookingId: bk.id,
        },
      });
    } catch (e) {
      console.error(e);
      toast("Couldn't open chat.", "error");
    }
  }
  /* ---------------------------------------------------- */

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
      <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Your Bookings</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1419] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Your Bookings
          </h1>
          <div className="flex gap-2">
            {["all", "upcoming", "past"].map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 rounded-xl border ${
                  tab === key
                    ? "bg-amber-500/15 border-amber-400 text-amber-300"
                    : "bg-gray-900/60 border-white/10 text-gray-200 hover:bg-gray-800"
                }`}
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* States */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
            Loading bookings…
          </div>
        )}
        {!loading && err && (
          <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}
        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
            <p className="mb-2 font-semibold">No bookings found.</p>
            <p className="text-gray-300">
              When you book a stay, it’ll appear here.
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && !err && filtered.length > 0 && (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((b) => (
                <li
                  key={b.id}
                  className="rounded-2xl border border-white/10 bg-gray-900/60 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {b.title || b.listingTitle || "Listing"}
                        </h3>
                        <p className="text-sm text-gray-300">
                          {b.listingLocation || b.city || b.area || ""}
                        </p>
                        {b.cancellationRequested && (
                          <div className="mt-1 text-xs text-amber-300">
                            Cancellation requested — awaiting host/partner.
                          </div>
                        )}
                        {b.dateChangeRequested && (
                          <div className="mt-1 text-xs text-amber-300">
                            Date change requested — awaiting host/partner.
                          </div>
                        )}
                      </div>
                      <Badge status={b.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                        <div className="text-gray-400">Check-in</div>
                        <div className="font-medium">{b.checkIn || "—"}</div>
                      </div>
                      <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                        <div className="text-gray-400">Check-out</div>
                        <div className="font-medium">{b.checkOut || "—"}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-gray-300">
                        Guests:{" "}
                        <span className="font-medium">{b.guests || 1}</span>
                      </div>
                      <div className="text-lg font-semibold">
                        {ngn(b.amountN ?? b.total)}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelected(b)}
                        className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
                      >
                        View details
                      </button>

                      {canEdit(b) && (
                        <button
                          onClick={() => openEdit(b)}
                          className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 border border-white/10"
                        >
                          Request date change
                        </button>
                      )}

                      {canCancel(b) && (
                        <button
                          onClick={() => openCancel(b)}
                          className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                        >
                          Request cancel
                        </button>
                      )}

                      {canChat(b) && (
                        <button
                          onClick={() => openChatFromBooking(b)}
                          className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          Chat with Host/Partner
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 flex items-center justify-center">
                <button
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className={`px-4 py-2 rounded-xl border ${
                    loadingMore
                      ? "border-white/10 text-gray-500 cursor-wait"
                      : "border-white/20 bg-gray-900/60 hover:bg-gray-800"
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
        <Modal onClose={() => setSelected(null)}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold">
                {selected.title || selected.listingTitle || "Booking details"}
              </h3>
              <div className="text-sm text-gray-300">
                {selected.listingLocation ||
                  selected.city ||
                  selected.area ||
                  ""}
              </div>
            </div>
            <Badge status={selected.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <InfoBox label="Check-in" value={selected.checkIn || "—"} />
            <InfoBox label="Check-out" value={selected.checkOut || "—"} />
            <InfoBox label="Guests" value={selected.guests || 1} />
            <InfoBox label="Nights" value={selected.nights || "-"} />
          </div>

          <div className="mt-4 rounded-xl bg-black/25 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span>Amount</span>
              <span className="font-semibold">
                {ngn(selected.amountN ?? selected.total)}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Provider: {selected.provider || "—"} • Ref:{" "}
              {selected.reference || "—"}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {selected.listingId && (
              <button
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
                onClick={() => {
                  nav(`/listing/${selected.listingId}`);
                  setSelected(null);
                }}
              >
                Open listing
              </button>
            )}
            <button
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* EDIT (DATE CHANGE) MODAL */}
      {editOpen && selected && (
        <Modal onClose={() => setEditOpen(false)}>
          <h3 className="text-xl font-bold">Request date change</h3>
          <p className="text-sm text-gray-300 mt-1">
            Your current dates are <b>{selected.checkIn}</b> to{" "}
            <b>{selected.checkOut}</b>.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="New check-in">
              <input
                type="date"
                className="w-full bg-transparent outline-none placeholder-white/30"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
              />
            </Field>
            <Field label="New check-out">
              <input
                type="date"
                className="w-full bg-transparent outline-none placeholder-white/30"
                value={newCheckOut}
                onChange={(e) => setNewCheckOut(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={submitDateChange}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700"
            >
              Send request
            </button>
          </div>
        </Modal>
      )}

      {/* CANCEL MODAL */}
      {cancelOpen && selected && (
        <Modal onClose={() => setCancelOpen(false)}>
          <h3 className="text-xl font-bold">Request cancellation</h3>
          <p className="text-sm text-gray-300 mt-1">
            You’re requesting to cancel your booking for{" "}
            <b>{selected.title || selected.listingTitle || "this stay"}</b>. The
            host/partner will review and confirm the refund per policy.
          </p>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setCancelOpen(false)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10"
            >
              Keep booking
            </button>
            <button
              onClick={submitCancelRequest}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Send request
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ------------- small UI atoms ------------- */
function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl rounded-2xl border border-white/10 bg-gray-900/95 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
      {label && <div className="text-gray-400 text-sm mb-1">{label}</div>}
      {children}
    </div>
  );
}
function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
