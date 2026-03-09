// src/pages/GuestBookings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDocs,
  limit as fsLimit, onSnapshot, orderBy,
  query, startAfter, where,
  updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db }               from "../firebase";
import { useAuth }          from "../auth/AuthContext";
import useUserProfile       from "../hooks/useUserProfile";
import { useNavigate }      from "react-router-dom";
import { useToast }         from "../context/ToastContext";
import "../styles/polish.css";

const PAGE      = 20;
const CORMORANT = "'Cormorant Garamond', Georgia, serif";

/* ─── Ghost booking filter (mirrors admin/reports pages) ─── */
const GHOST_STATUSES = new Set([
  "initialized","pending","hold","hold-pending",
  "awaiting_payment","reserved_unpaid","pending_payment",
]);
function isRealBooking(row) {
  if (row.archived === true) return false;
  const s      = String(row.status || "").toLowerCase();
  const hasRef = !!(row.reference || row.paymentRef || row.paymentReference || row.transactionId);
  const isPaid = String(row.paymentStatus || "").toLowerCase() === "paid" || row.paid === true;
  if (hasRef || isPaid) return true;
  if (GHOST_STATUSES.has(s)) return false;
  return true;
}

/* ─── Helpers ─── */
const ngn = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function toDateObj(v) {
  if (!v) return null;
  if (v?.toDate)  return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (typeof v === "string" || typeof v === "number") { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  if (v instanceof Date) return v;
  return null;
}

function toDateStr(v) {
  const d = toDateObj(v);
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isPastDate(v) {
  const d = toDateObj(v);
  if (!d) return false;
  const today = new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  return d < today;
}

function safeLower(v) { return String(v || "").trim().toLowerCase(); }

function compactRef(v) {
  const s = String(v || "");
  if (!s) return "—";
  return s.length <= 16 ? s : `${s.slice(0,6)}…${s.slice(-4)}`;
}

function prettyStatus(status) {
  const s = safeLower(status);
  if (!s)                          return "Pending";
  if (s === "paid")                return "Paid";
  if (s === "confirmed")           return "Confirmed";
  if (s === "paid_pending_release")return "Paid · awaiting check-in";
  if (s === "checked_in")          return "Checked in";
  if (s === "released")            return "Stay active";
  if (s === "cancelled")           return "Cancelled";
  if (s === "refunded")            return "Refunded";
  if (s === "failed")              return "Failed";
  return s.replace(/_/g," ").replace(/\b\w/g,(m)=>m.toUpperCase());
}

function statusTone(status) {
  const s = safeLower(status);
  if (["confirmed","paid","paid_pending_release","checked_in","released"].includes(s)) return "good";
  if (["cancelled","refunded","failed"].includes(s))                                   return "bad";
  return "warn";
}

function mapBookingDoc(d) {
  const data = d.data ? d.data() : d;
  return {
    id: d.id || data.id, ...data,
    checkIn: toDateStr(data.checkIn), checkOut: toDateStr(data.checkOut),
    _rawCheckIn: data.checkIn, _rawCheckOut: data.checkOut,
  };
}

function mergeUniqueById(existing, incoming) {
  const byId = new Map();
  const put  = (row) => {
    if (!row?.id) return;
    const prev    = byId.get(row.id);
    if (!prev)    { byId.set(row.id, row); return; }
    const prevMs  = (toDateObj(prev?.updatedAt || prev?.createdAt)?.getTime?.()) || 0;
    const nextMs  = (toDateObj(row?.updatedAt  || row?.createdAt)?.getTime?.())  || 0;
    if (nextMs >= prevMs) byId.set(row.id, { ...prev, ...row });
  };
  existing.forEach(put); incoming.forEach(put);
  const out = [...byId.values()];
  out.sort((a,b) => ((toDateObj(b.createdAt||b.updatedAt)||new Date(0)).getTime()) - ((toDateObj(a.createdAt||a.updatedAt)||new Date(0)).getTime()));
  return out;
}

/* ─── Badge ─── */
function StatusBadge({ status = "" }) {
  const tone = statusTone(status);
  const styles = {
    good: { border:"1px solid rgba(52,211,153,0.35)", color:"#6ee7b7",  background:"rgba(52,211,153,0.08)" },
    bad:  { border:"1px solid rgba(239,68,68,0.35)",  color:"#fca5a5",  background:"rgba(239,68,68,0.08)" },
    warn: { border:"1px solid rgba(201,168,76,0.40)", color:"#c9a84c",  background:"rgba(201,168,76,0.08)" },
  };
  return (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, fontWeight:600, letterSpacing:"0.04em", whiteSpace:"nowrap", ...styles[tone] }}>
      {prettyStatus(status)}
    </span>
  );
}

/* ─── Info box ─── */
function InfoBox({ label, value }) {
  return (
    <div style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.25)", padding:"12px 14px" }}>
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.4)", marginBottom:5 }}>{label}</div>
      <div style={{ fontWeight:600, color:"rgba(255,255,255,0.9)", fontSize:14 }}>{value}</div>
    </div>
  );
}

/* ─── Modal ─── */
function Modal({ children, onClose, title }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:40, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onMouseDown={onClose}
    >
      <div
        style={{ width:"100%", maxWidth:560, borderRadius:28, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(5,7,11,0.97)", padding:"24px 26px", boxShadow:"0 40px 120px rgba(0,0,0,0.8)" }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
      >
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.3em", color:"#c9a84c", marginBottom:5 }}>NestaNg</div>
            <div style={{ fontFamily:CORMORANT, fontSize:22, fontWeight:600, color:"#f5f0e8", lineHeight:1.15 }}>{title || "Details"}</div>
          </div>
          <button onClick={onClose} style={{ padding:"6px 14px", borderRadius:999, fontSize:13, cursor:"pointer", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.7)" }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Field (date inputs in modal) ─── */
function Field({ label, children }) {
  return (
    <div style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.04)", padding:"12px 14px" }}>
      {label && <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.4)", marginBottom:6 }}>{label}</div>}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function GuestBookings() {
  const { user }    = useAuth();
  const { profile } = useUserProfile();
  const nav         = useNavigate();
  const { showToast: toast } = useToast();

  const role    = safeLower(profile?.role);
  const isGuest = !role || role === "guest";

  const [tab,          setTab]          = useState("all");
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState("");
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const lastDocRef = useRef(null);

  const [selected,    setSelected]    = useState(null);
  const [editOpen,    setEditOpen]    = useState(false);
  const [cancelOpen,  setCancelOpen]  = useState(false);
  const [newCheckIn,  setNewCheckIn]  = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");

  const [qText,        setQText]        = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const baseCol  = useMemo(() => collection(db, "bookings"), []);
  const liveQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(baseCol, where("guestId","==",user.uid), orderBy("createdAt","desc"), fsLimit(PAGE));
  }, [baseCol, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !liveQuery) { setRows([]); setLoading(false); setErr(""); return; }
    setLoading(true); setErr("");
    const unsub = onSnapshot(
      liveQuery,
      (snap) => {
        const list = snap.docs.map(mapBookingDoc).filter(isRealBooking);
        setRows((cur) => mergeUniqueById(cur, list));
        const last = snap.docs[snap.docs.length - 1] || null;
        lastDocRef.current = last;
        setHasMore(Boolean(last) && snap.size === PAGE);
        setLoading(false);
      },
      (e) => { console.error(e); setErr("Couldn't load your bookings."); setLoading(false); }
    );
    return () => unsub();
  }, [liveQuery, user?.uid]);

  async function loadOlder() {
    if (!lastDocRef.current || !user?.uid) return;
    try {
      setLoadingMore(true);
      const snap = await getDocs(query(baseCol, where("guestId","==",user.uid), orderBy("createdAt","desc"), startAfter(lastDocRef.current), fsLimit(PAGE)));
      const more = snap.docs.map(mapBookingDoc).filter(isRealBooking);
      const last = snap.docs[snap.docs.length - 1] || null;
      lastDocRef.current = last;
      setHasMore(Boolean(last) && snap.size === PAGE);
      setRows((cur) => mergeUniqueById(cur, more));
    } catch (e) {
      console.error(e); toast("Couldn't load older bookings.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const kw         = safeLower(qText);
    const wantStatus = safeLower(statusFilter);
    return rows
      .filter((b) => {
        if (tab === "upcoming") return !isPastDate(b._rawCheckOut ?? b.checkOut);
        if (tab === "past")     return isPastDate(b._rawCheckOut ?? b.checkOut);
        return true;
      })
      .filter((b) => wantStatus === "all" || safeLower(b.status) === wantStatus)
      .filter((b) => {
        if (!kw) return true;
        const hay = `${b.title||""} ${b.listingTitle||""} ${b.listingLocation||""} ${b.city||""} ${b.area||""} ${b.reference||""} ${b.id||""}`.toLowerCase();
        return hay.includes(kw);
      });
  }, [rows, tab, qText, statusFilter]);

  const canEdit  = (b) => { const s=safeLower(b.status); const future=!isPastDate(b._rawCheckIn??b.checkIn); return (s==="confirmed"||s==="paid"||s==="paid_pending_release")&&future&&isGuest; };
  const canCancel= (b) => { const s=safeLower(b.status); const future=!isPastDate(b._rawCheckIn??b.checkIn); return (s==="confirmed"||s==="paid"||s==="paid_pending_release")&&future&&isGuest&&!b.cancellationRequested; };
  const canChat  = (b) => { const s=safeLower(b.status); return isGuest&&["confirmed","paid","paid_pending_release","checked_in","released"].includes(s); };
  const canGuide = (b) => canChat(b);

  function openChatFromBooking(bk) {
    if (!bk?.id) return;
    const listingId    = bk.listingId || bk.listing?.id || null;
    const listingTitle = bk.title || bk.listingTitle || bk.listing?.title || "Listing";
    const hostId       = bk.hostId || bk.ownerId || bk.partnerUid || bk.listingOwner || null;
    if (!listingId || !hostId) { toast("Missing host/partner details. Contact support.", "error"); return; }
    nav(`/booking/${bk.id}/chat`, { state: { bookingId:bk.id, listing:{id:listingId,title:listingTitle}, guestId:user?.uid||bk.guestId||null, hostId, from:"guest_bookings" } });
  }

  function openEdit(b) { setSelected(b); setNewCheckIn(b.checkIn||""); setNewCheckOut(b.checkOut||""); setEditOpen(true); }
  function openCancel(b) { setSelected(b); setCancelOpen(true); }

  async function submitDateChange() {
    if (!selected?.id) return;
    if (!newCheckIn || !newCheckOut) { toast("Pick new dates.", "warning"); return; }
    if (newCheckOut <= newCheckIn)   { toast("Check-out must be after check-in.", "warning"); return; }
    try {
      await updateDoc(doc(db,"bookings",selected.id), { dateChangeRequested:true, newCheckIn, newCheckOut, updatedAt:serverTimestamp() });
      toast("Date change request sent. Host/Partner will review.", "success");
      setEditOpen(false);
    } catch (e) { console.error(e); toast("Couldn't submit date change request.", "error"); }
  }

  async function submitCancelRequest() {
    if (!selected?.id) return;
    try {
      await updateDoc(doc(db,"bookings",selected.id), { cancellationRequested:true, updatedAt:serverTimestamp() });
      toast("Cancellation request sent. Host/Partner will review.", "success");
      setCancelOpen(false);
    } catch (e) { console.error(e); toast("Couldn't submit cancellation request.", "error"); }
  }

  /* ── Shared button styles ── */
  const btnGold   = { padding:"8px 18px", borderRadius:999, fontSize:13, fontWeight:600, cursor:"pointer", background:"linear-gradient(135deg,#e8c96b,#c9a84c)", color:"#120d02", border:"none", boxShadow:"0 4px 14px rgba(201,168,76,0.25)" };
  const btnWhite  = { padding:"8px 14px", borderRadius:999, fontSize:13, cursor:"pointer", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.8)" };
  const btnDanger = { padding:"8px 14px", borderRadius:999, fontSize:13, fontWeight:600, cursor:"pointer", background:"rgba(239,68,68,0.85)", border:"1px solid rgba(239,68,68,0.4)", color:"#fff" };

  /* ── unauthenticated state ── */
  if (!user) {
    return (
      <main style={pageWrap}>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"80px 20px" }}>
          <div style={card}>
            <p style={eyebrow}>NestaNg · Reservations</p>
            <h1 style={pageTitle}>Your bookings</h1>
            <p style={pageSub}>Sign in to view your reservations and manage your stays.</p>
            <button onClick={() => nav("/login")} style={{ ...btnGold, marginTop:20 }}>Sign in</button>
          </div>
        </div>
      </main>
    );
  }

  if (!isGuest) {
    return (
      <main style={pageWrap}>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"80px 20px" }}>
          <div style={card}>
            <p style={eyebrow}>NestaNg · Reservations</p>
            <h1 style={pageTitle}>Guest bookings</h1>
            <p style={pageSub}>This page is for guest accounts. Use the correct dashboard for your role.</p>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => nav("/role-selection")} style={btnWhite}>Role selection</button>
              <button onClick={() => nav("/dashboard")}      style={btnGold}>Go to dashboard</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes gbFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .gb-card { animation: gbFadeUp 0.32s ease-out both; }
        .gb-card:hover { border-color: rgba(255,255,255,0.14) !important; }
      `}</style>

      <main style={pageWrap}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"80px 20px 64px" }}>

          {/* ── Page header ── */}
          <header style={{ marginBottom:28 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:20 }}>
              <p style={eyebrow}>NestaNg · Reservations</p>
              <h1 style={pageTitle}>Your bookings</h1>
              <p style={pageSub}>Manage dates, access secure chat and check-in guides — all in one place.</p>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
              {[["all","All"],["upcoming","Upcoming"],["past","Past"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    padding:"8px 18px", borderRadius:999, fontSize:13, cursor:"pointer",
                    border: tab===key ? "1px solid rgba(201,168,76,0.45)" : "1px solid rgba(255,255,255,0.10)",
                    background: tab===key ? "rgba(201,168,76,0.10)" : "rgba(255,255,255,0.04)",
                    color: tab===key ? "#c9a84c" : "rgba(255,255,255,0.65)",
                    fontWeight: tab===key ? 600 : 400,
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Filter bar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:12 }}>
              <div style={filterBox}>
                <div style={filterLabel}>Search</div>
                <input
                  value={qText} onChange={(e) => setQText(e.target.value)}
                  placeholder="Listing, location, reference…"
                  style={{ background:"transparent", border:"none", outline:"none", fontSize:14, color:"#fff", width:"100%", marginTop:4 }}
                />
              </div>
              <div style={filterBox}>
                <div style={filterLabel}>Status</div>
                <select
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ background:"transparent", border:"none", outline:"none", fontSize:14, color:"#fff", width:"100%", marginTop:4, appearance:"none" }}
                >
                  <option value="all">All statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="paid">Paid</option>
                  <option value="paid_pending_release">Paid — awaiting check-in</option>
                  <option value="checked_in">Checked in</option>
                  <option value="released">Stay active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div style={{ ...filterBox, flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:12, minWidth:120 }}>
                <div>
                  <div style={filterLabel}>Results</div>
                  <div style={{ fontSize:14, color:"rgba(255,255,255,0.8)", marginTop:4, fontWeight:600 }}>
                    {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {(qText || statusFilter !== "all") && (
                  <button onClick={() => { setQText(""); setStatusFilter("all"); }} style={{ ...btnWhite, fontSize:12, padding:"5px 12px" }}>Clear</button>
                )}
              </div>
            </div>
          </header>

          {/* ── States ── */}
          {loading && (
            <div style={{ ...card, textAlign:"center", color:"rgba(255,255,255,0.45)", padding:"48px 24px" }}>
              <div style={{ fontSize:16, marginBottom:8, fontWeight:500 }}>Loading your bookings…</div>
            </div>
          )}

          {!loading && err && (
            <div style={{ borderRadius:20, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", padding:"20px 24px", color:"#fca5a5", fontSize:14, marginBottom:16 }}>
              {err}
            </div>
          )}

          {!loading && !err && filtered.length === 0 && (
            <div style={{ ...card, textAlign:"center", padding:"52px 24px" }}>
              <p style={{ fontSize:17, fontWeight:600, color:"rgba(255,255,255,0.85)", marginBottom:8 }}>No bookings found</p>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.4)", marginBottom:24 }}>
                When you reserve a stay, it will appear here.
              </p>
              <button onClick={() => nav("/")} style={btnGold}>Explore stays</button>
            </div>
          )}

          {/* ── Booking cards ── */}
          {!loading && !err && filtered.length > 0 && (
            <>
              <ul style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(400px, 1fr))", gap:16, listStyle:"none", margin:0, padding:0 }}>
                {filtered.map((b, idx) => {
                  const title    = b.title || b.listingTitle || "Listing";
                  const location = b.listingLocation || b.city || b.area || "";
                  const amount   = b.amountN ?? b.amountLockedN ?? b.total ?? 0;
                  const isActive = ["confirmed","paid","paid_pending_release","checked_in","released"].includes(safeLower(b.status));

                  return (
                    <li key={b.id} className="gb-card" style={{ animationDelay: `${idx * 40}ms`, ...card, position:"relative", overflow:"hidden" }}>
                      {/* Status accent bar */}
                      <div style={{
                        position:"absolute", top:0, left:0, right:0, height:3,
                        background: statusTone(b.status) === "good" ? "linear-gradient(90deg,rgba(52,211,153,0.7),transparent)"
                          : statusTone(b.status) === "bad" ? "linear-gradient(90deg,rgba(239,68,68,0.6),transparent)"
                          : "linear-gradient(90deg,rgba(201,168,76,0.5),transparent)",
                      }} />

                      <div style={{ padding:"20px 22px 22px" }}>
                        {/* Header row */}
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}>
                          <div style={{ minWidth:0 }}>
                            <h3 style={{ fontSize:16, fontWeight:600, color:"rgba(255,255,255,0.95)", marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</h3>
                            {location && <p style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{location}</p>}
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                              Ref: <span style={{ color:"rgba(255,255,255,0.6)" }}>{compactRef(b.reference || b.ref || b.id)}</span>
                            </span>
                            {b.cancellationRequested && <div style={{ marginTop:5, fontSize:11, color:"#c9a84c" }}>Cancellation requested — awaiting review</div>}
                            {b.dateChangeRequested   && <div style={{ marginTop:5, fontSize:11, color:"#c9a84c" }}>Date change requested — awaiting review</div>}
                          </div>
                          <StatusBadge status={b.status} />
                        </div>

                        {/* Date + amount grid */}
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                          <InfoBox label="Check-in"  value={b.checkIn  || "—"} />
                          <InfoBox label="Check-out" value={b.checkOut || "—"} />
                        </div>

                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                          <span style={{ fontSize:13, color:"rgba(255,255,255,0.45)" }}>
                            Guests: <span style={{ color:"rgba(255,255,255,0.85)", fontWeight:600 }}>{b.guests || 1}</span>
                          </span>
                          <span style={{ fontSize:18, fontWeight:700, color:"#fff" }}>{ngn(amount)}</span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
                          <button onClick={() => setSelected(b)} style={btnWhite}>View details</button>
                          {canEdit(b)   && <button onClick={() => openEdit(b)}   style={btnWhite}>Request date change</button>}
                          {canCancel(b) && <button onClick={() => openCancel(b)} style={btnDanger}>Request cancel</button>}
                          {canChat(b)   && <button onClick={() => openChatFromBooking(b)} style={btnWhite}>Secure chat</button>}
                          {canGuide(b)  && (
                            <button onClick={() => nav(`/checkin/${b.id}`, { state:{ booking:b } })} style={btnGold}>
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
                <div style={{ display:"flex", justifyContent:"center", marginTop:28 }}>
                  <button onClick={loadOlder} disabled={loadingMore} style={{ ...btnWhite, padding:"10px 28px", fontSize:14, opacity: loadingMore ? 0.6 : 1 }}>
                    {loadingMore ? "Loading…" : "Load older bookings"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ DETAILS MODAL ═══ */}
        {selected && !editOpen && !cancelOpen && (
          <Modal onClose={() => setSelected(null)} title="Booking details">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}>
              <div style={{ minWidth:0 }}>
                <h3 style={{ fontSize:18, fontWeight:600, color:"#f5f0e8", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {selected.title || selected.listingTitle || "Booking details"}
                </h3>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)" }}>{selected.listingLocation || selected.city || selected.area || ""}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:5 }}>
                  Provider: <span style={{ color:"rgba(255,255,255,0.6)" }}>{selected.provider || "—"}</span>
                  <span style={{ margin:"0 8px", opacity:0.3 }}>·</span>
                  Ref: <span style={{ color:"rgba(255,255,255,0.6)" }}>{compactRef(selected.reference || selected.ref || selected.id)}</span>
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <InfoBox label="Check-in"  value={selected.checkIn  || "—"} />
              <InfoBox label="Check-out" value={selected.checkOut || "—"} />
              <InfoBox label="Guests"    value={selected.guests || 1} />
              <InfoBox label="Nights"    value={selected.nights || "—"} />
            </div>

            <div style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.25)", padding:"14px 16px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Total paid</span>
                <span style={{ fontWeight:700, fontSize:16, color:"#fff" }}>{ngn(selected.amountN ?? selected.amountLockedN ?? selected.total ?? 0)}</span>
              </div>
              {selected.dateChangeRequested   && <div style={{ marginTop:8, fontSize:11, color:"#c9a84c" }}>Date change requested.</div>}
              {selected.cancellationRequested && <div style={{ marginTop:8, fontSize:11, color:"#c9a84c" }}>Cancellation requested.</div>}
              {safeLower(selected.status) === "paid_pending_release" && <div style={{ marginTop:8, fontSize:11, color:"#c9a84c" }}>Your booking is paid and awaiting host check-in confirmation.</div>}
              {safeLower(selected.status) === "checked_in"          && <div style={{ marginTop:8, fontSize:11, color:"#93c5fd" }}>Check-in confirmed for this stay.</div>}
              {safeLower(selected.status) === "released"            && <div style={{ marginTop:8, fontSize:11, color:"#6ee7b7" }}>Your stay is active.</div>}
            </div>

            <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
              {selected.listingId && <button style={btnWhite} onClick={() => { nav(`/listing/${selected.listingId}`); setSelected(null); }}>Open listing</button>}
              {canGuide(selected) && <button style={btnGold}  onClick={() => { nav(`/checkin/${selected.id}`, { state:{booking:selected} }); setSelected(null); }}>Check-in guide</button>}
              {canChat(selected)  && <button style={btnWhite} onClick={() => { openChatFromBooking(selected); setSelected(null); }}>Secure chat</button>}
              <button style={btnWhite} onClick={() => setSelected(null)}>Close</button>
            </div>
          </Modal>
        )}

        {/* ═══ EDIT MODAL ═══ */}
        {editOpen && selected && (
          <Modal onClose={() => setEditOpen(false)} title="Request date change">
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:16 }}>
              Current dates: <span style={{ color:"rgba(255,255,255,0.85)", fontWeight:600 }}>{selected.checkIn || "—"} → {selected.checkOut || "—"}</span>
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <Field label="New check-in">
                <input type="date" value={newCheckIn} onChange={(e) => setNewCheckIn(e.target.value)}
                  style={{ background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:14, width:"100%" }} />
              </Field>
              <Field label="New check-out">
                <input type="date" value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)}
                  style={{ background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:14, width:"100%" }} />
              </Field>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={() => setEditOpen(false)} style={btnWhite}>Cancel</button>
              <button onClick={submitDateChange}         style={btnGold}>Send request</button>
            </div>
          </Modal>
        )}

        {/* ═══ CANCEL MODAL ═══ */}
        {cancelOpen && selected && (
          <Modal onClose={() => setCancelOpen(false)} title="Request cancellation">
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:14 }}>
              You're requesting to cancel your booking for{" "}
              <span style={{ color:"rgba(255,255,255,0.85)", fontWeight:600 }}>{selected.title || selected.listingTitle || "this stay"}</span>.
              The host/partner will review and confirm the refund per policy.
            </p>
            <div style={{ borderRadius:14, border:"1px solid rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.08)", padding:"12px 14px", fontSize:13, color:"rgba(252,165,165,0.9)", marginBottom:20 }}>
              Refund outcomes depend on the host's cancellation policy and timing. Only request if you're sure.
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={() => setCancelOpen(false)} style={btnWhite}>Keep booking</button>
              <button onClick={submitCancelRequest}        style={btnDanger}>Send request</button>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}

/* ─── Shared styles ─── */
const pageWrap = {
  minHeight: "100vh",
  background: "radial-gradient(1400px 600px at 30% -5%, rgba(201,168,76,0.04), transparent 55%), #05070a",
  color: "#fff",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};
const card = {
  borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(160deg,rgba(14,18,28,0.95),rgba(8,11,18,0.90))",
  boxShadow: "0 14px 44px rgba(0,0,0,0.45)",
};
const eyebrow = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.36em",
  textTransform: "uppercase", color: "#c9a84c", margin: 0,
};
const pageTitle = {
  fontFamily: CORMORANT, fontSize: "clamp(26px,4vw,38px)", fontWeight: 600,
  color: "#f5f0e8", margin: "6px 0 8px", lineHeight: 1.15,
};
const pageSub = {
  fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, margin: 0,
};
const filterBox = {
  borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
  padding: "12px 16px", display: "flex", flexDirection: "column",
};
const filterLabel = {
  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)",
};