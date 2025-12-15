// src/pages/CheckinGuidePage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { doc as fsDoc, getDoc as fsGetDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000/api";

function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (v instanceof Date) return v;
    return new Date(v);
  } catch {
    return null;
  }
}

function fmt(v) {
  const d = toDate(v);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeLast4(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 4);
}

export default function CheckinGuidePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const bookingFromState = state?.booking || null;

  const [data, setData] = useState(bookingFromState);
  const [loading, setLoading] = useState(!bookingFromState);
  const [err, setErr] = useState("");

  // ID gate state
  const [idType, setIdType] = useState("passport");
  const [idLast4, setIdLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");

  // Fetch booking (API first; Firestore fallback for robustness)
  useEffect(() => {
    if (bookingFromState) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Try API
        try {
          const res = await fetch(`${API_BASE}/bookings/${id}`, {
            credentials: "include",
          });
          if (res.ok) {
            const json = await res.json();
            if (alive) setData(json || null);
            return;
          }
        } catch {}

        // Fallback: Firestore read (useful during transitions)
        const snap = await fsGetDoc(fsDoc(db, "bookings", id));
        if (!alive) return;
        if (snap.exists()) setData({ id: snap.id, ...snap.data() });
        else setData(null);
      } catch (e) {
        if (alive) setErr("Could not load check-in details.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, bookingFromState]);

  const b = data;

  const status = String(b?.status || "").toLowerCase();
  const isConfirmed = status === "paid" || status === "confirmed";

  const hasIdCheck = useMemo(() => {
    const last4 = safeLast4(b?.idCheck?.last4);
    return Boolean(b?.idCheck?.consent) && last4.length === 4;
  }, [b]);

  // Pre-fill gate inputs if already present
  useEffect(() => {
    if (!b) return;
    if (b?.idCheck?.type) setIdType(String(b.idCheck.type));
    if (b?.idCheck?.last4) setIdLast4(safeLast4(b.idCheck.last4));
    if (typeof b?.idCheck?.consent === "boolean") setConsent(Boolean(b.idCheck.consent));
  }, [b]);

  const hostName =
    b?.hostName || b?.ownerName || b?.partnerName || "Your Nesta host / partner";

  const arrivalWindow =
    b?.checkInWindow ||
    b?.checkInTime ||
    "Standard check-in from 2:00 pm (host can adjust if needed).";

  const instructions =
    b?.checkInInstructions ||
    b?.instructions ||
    "Your arrival notes will be shared via Nesta chat. Personal numbers are kept private by policy.";

  const doorCode = b?.doorCode || b?.gateCode || b?.pinCode || null;

  const canSubmitId = useMemo(() => {
    return safeLast4(idLast4).length === 4 && consent;
  }, [idLast4, consent]);

  async function saveIdCheck() {
    setBanner("");
    const user = getAuth().currentUser;
    if (!user) {
      nav("/login", { state: { from: `/checkin/${id}` } });
      return;
    }

    const last4 = safeLast4(idLast4);
    if (last4.length !== 4) {
      setBanner("Please enter the last 4 digits (numbers only).");
      return;
    }
    if (!consent) {
      setBanner("Please tick consent to continue.");
      return;
    }

    setSaving(true);
    try {
      // Store ONLY last4 + type + consent (luxury privacy: minimal data)
      const payload = {
        type: idType,
        last4,
        consent: true,
        verified: false, // later: you can integrate BVN/NIN verification provider
        masked: `${String(idType).toUpperCase()} ••••${last4}`,
        providedAt: serverTimestamp(),
      };

      // Write to Firestore (canonical)
      await updateDoc(fsDoc(db, "bookings", id), {
        idCheck: payload,
        updatedAt: serverTimestamp(),
      });

      // Update local state so UI unlocks immediately
      setData((prev) => ({
        ...(prev || {}),
        id,
        idCheck: { ...(prev?.idCheck || {}), ...payload, providedAt: new Date() },
      }));

      setBanner("✅ Check-in verification saved. Your guide is now unlocked.");
    } catch (e) {
      console.error(e);
      setBanner("Could not save ID verification right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#030509] via-[#05070d] to-[#020308] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Loading your check-in guide…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && !b && (
          <div className="rounded-3xl border border-white/10 bg-gray-900/70 p-6">
            Booking not found.
          </div>
        )}

        {!loading && b && (
          <div className="rounded-3xl border border-white/10 bg-[#05070b]/95 p-6 md:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            {/* Top summary */}
            <header className="mb-6">
              <p className="text-xs tracking-[0.25em] uppercase text-amber-300/80">
                Check-in guide
              </p>
              <h1
                className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight"
                style={{
                  fontFamily:
                    'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                }}
              >
                {b.listingTitle || b.listing?.title || "Your stay"}
              </h1>
              <p className="text-sm text-gray-300 mt-1">
                {b.listingLocation || b.listing?.location || ""}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Check-in: <span className="font-medium">{fmt(b.checkIn)}</span>{" "}
                • Check-out:{" "}
                <span className="font-medium">{fmt(b.checkOut)}</span>
              </p>
            </header>

            {/* Gate: ID required to unlock guide */}
            {!hasIdCheck && (
              <section className="rounded-2xl bg-amber-500/10 border border-amber-300/40 p-4 mb-6">
                <h2 className="text-sm font-semibold text-amber-200">
                  Complete check-in verification
                </h2>
                <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
                  Luxury platforms keep checkout fast, then collect minimal ID confirmation for safety.
                  We only store a masked reference (last 4 digits), not your full ID number.
                </p>

                {!isConfirmed && (
                  <div className="mt-3 text-[11px] text-amber-100/80">
                    Note: Your booking is not marked confirmed yet, but you can still complete verification early.
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/35 border border-white/10 px-3 py-2">
                    <div className="text-[11px] text-white/60 uppercase tracking-wide">
                      ID Type
                    </div>
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="w-full bg-transparent outline-none text-white text-sm mt-1"
                    >
                      <option value="passport">Passport</option>
                      <option value="nin">NIN</option>
                      <option value="bvn">BVN</option>
                      <option value="drivers_license">Driver’s licence</option>
                    </select>
                  </div>

                  <div className="rounded-xl bg-black/35 border border-white/10 px-3 py-2">
                    <div className="text-[11px] text-white/60 uppercase tracking-wide">
                      Last 4 digits
                    </div>
                    <input
                      value={idLast4}
                      maxLength={4}
                      onChange={(e) => setIdLast4(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-transparent outline-none text-white text-sm mt-1"
                      placeholder="0000"
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I consent to Nesta storing a masked ID reference to protect guests and hosts.
                </label>

                {banner && (
                  <div className="mt-3 text-xs text-white/80">
                    {banner}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={saveIdCheck}
                    disabled={!canSubmitId || saving}
                    className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold ${
                      canSubmitId && !saving
                        ? "bg-amber-500 hover:bg-amber-400 text-black"
                        : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
                    }`}
                  >
                    {saving ? "Saving…" : "Save & unlock guide"}
                  </button>

                  <button
                    onClick={() => nav("/bookings")}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm hover:bg-white/10"
                  >
                    Back to my bookings
                  </button>
                </div>
              </section>
            )}

            {/* The actual guide (only if unlocked) */}
            {hasIdCheck && (
              <>
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                    <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                      Host / partner
                    </h2>
                    <p className="mt-1 text-sm text-white/90">{hostName}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      All final details and changes will come through Nesta chat.
                      Personal numbers are kept private by policy.
                    </p>
                    <button
                      onClick={() => nav("/bookings", { state: { focus: b.id || id } })}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/90 text-black text-xs font-semibold hover:bg-amber-400"
                    >
                      Open booking & chat
                    </button>
                  </div>

                  <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                    <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                      Arrival window
                    </h2>
                    <p className="mt-1 text-sm text-white/90">{arrivalWindow}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      If you expect to arrive earlier/later, message in-app so your host can plan support.
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl bg-black/35 border border-white/10 p-4 mb-6">
                  <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    How to check in
                  </h2>
                  <p className="mt-2 text-sm text-gray-100 leading-relaxed">
                    {instructions}
                  </p>

                  {doorCode ? (
                    <div className="mt-4 inline-flex flex-col gap-1 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-300/50">
                      <span className="text-[11px] text-emerald-200 uppercase tracking-wide">
                        Access code
                      </span>
                      <span className="text-lg font-mono text-emerald-100">
                        {doorCode}
                      </span>
                      <span className="text-[10px] text-emerald-200/80">
                        Keep this private. Only guests on this booking should use it.
                      </span>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-amber-200/80">
                      Codes will be shared closer to arrival via secure Nesta chat.
                    </p>
                  )}
                </section>

                {!isConfirmed && (
                  <section className="rounded-2xl bg-amber-500/10 border border-amber-300/50 p-4 mb-4 text-xs text-amber-100">
                    This booking is not fully confirmed yet. Some check-in details may change until it is marked{" "}
                    <span className="font-semibold">confirmed</span>.
                  </section>
                )}

                <div className="flex flex-wrap justify-between items-center gap-3">
                  <p className="text-[11px] text-gray-500">
                    Nesta keeps all codes and timing details in one secure place.
                  </p>
                  <button
                    onClick={() => nav("/bookings")}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm hover:bg-white/10"
                  >
                    Back to my bookings
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
