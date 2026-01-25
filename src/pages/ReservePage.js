// src/pages/ReservePage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import useUserProfile from "../hooks/useUserProfile";
import { createBookingHoldAPI } from "../api/bookings";

/* ---------- Tiny UI helpers ---------- */
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-200">{label}</span>
          {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
        </div>
      )}
      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white/90 focus-within:border-amber-400/80 transition-colors duration-200">
        {children}
      </div>
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full bg-transparent outline-none placeholder-white/30 text-white text-sm"
    />
  );
}

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

/* ---------- Step indicator ---------- */
function Stepper({ step }) {
  const steps = [
    { id: 1, label: "Dates & guests" },
    { id: 2, label: "Confirm details" },
    { id: 3, label: "Payment" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {steps.map((s, idx) => {
        const active = step === s.id;
        const done = step > s.id;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold border ${
                active
                  ? "bg-amber-400 text-black border-amber-300 shadow-[0_10px_30px_rgba(0,0,0,.6)]"
                  : done
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-300/60"
                  : "bg-white/5 text-white/70 border-white/20"
              }`}
            >
              {done ? "✓" : s.id}
            </div>
            <div className="text-xs md:text-sm text-white/70">{s.label}</div>
            {idx < steps.length - 1 && <div className="w-6 h-px bg-white/10 hidden md:block" />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Date helpers ---------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmdLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysYmd(ymd, days) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  return toYmdLocal(dt);
}

function isPastYmd(ymd) {
  if (!ymd) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const selected = new Date(y, m - 1, d);
  selected.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected.getTime() < today.getTime();
}

function safeLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

export default function ReservePage() {
  const { user } = useAuth();
  const { showToast: toast } = useToast();
  const nav = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { profile } = useUserProfile(user?.uid);

  // Guests only can reserve
  const role = safeLower(profile?.role || "");
  const isGuest = role === "guest" || !role;

  // ✅ Normalise API root so we never produce /api/api
  const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
  const API = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

  // state listing (from navigate or direct fetch)
  const state = location.state || {};
  const [listing, setListing] = useState(
    state.id
      ? {
          id: state.id,
          title: state.title ?? "Listing",
          pricePerNight: Number(state.price ?? 0),
          ownerId: state.hostId ?? null,
          city: state.city || "",
          area: state.area || "",
        }
      : null
  );
  const [loadingListing, setLoadingListing] = useState(!state.id);

  // form state
  const [step, setStep] = useState(1);
  const [guests, setGuests] = useState(1);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [holdInfo, setHoldInfo] = useState(null);

  // availability state
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availOk, setAvailOk] = useState(true);
  const [availMsg, setAvailMsg] = useState("");

  // payment provider (default to Flutterwave if Paystack isn't ready)
  const [payProvider, setPayProvider] = useState("flutterwave"); // "flutterwave" | "paystack"

  const todayMin = useMemo(() => toYmdLocal(new Date()), []);
  const checkOutMin = useMemo(() => {
    if (checkIn) return addDaysYmd(checkIn, 1);
    return todayMin;
  }, [checkIn, todayMin]);

  // load listing if needed
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (listing || !params.id) return;
        setLoadingListing(true);

        const snap = await getDoc(doc(db, "listings", params.id));
        if (!alive) return;

        if (snap.exists()) {
          const d = snap.data();
          setListing({
            id: snap.id,
            title: d.title || "Listing",
            pricePerNight: Number(d.pricePerNight || d.price || 0),
            ownerId: d.ownerId || d.ownerUid || null,
            city: d.city || "",
            area: d.area || "",
          });
        } else {
          toast("Listing not found.", "error");
          setListing(null);
        }
      } catch (e) {
        console.error(e);
        toast("Couldn't load listing.", "error");
      } finally {
        if (alive) setLoadingListing(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, listing]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  }, [checkIn, checkOut]);

  const datesValid =
    Boolean(checkIn && checkOut) &&
    !isPastYmd(checkIn) &&
    !isPastYmd(checkOut) &&
    new Date(checkOut) > new Date(checkIn);

  const total = useMemo(() => {
    if (!listing) return 0;
    const perNight = Number(listing.pricePerNight || 0);
    return Math.max(perNight * nights * Number(guests || 0), 0);
  }, [listing, nights, guests]);

  const canGoToStep2 = Boolean(listing && guests > 0 && datesValid && nights > 0 && availOk && !checkingAvail);
  const canGoToStep3 = Boolean(canGoToStep2);
  const canPay = Boolean(user && listing && datesValid && total > 0 && guests > 0 && availOk && !checkingAvail);

  async function getIdTokenOrNull() {
    try {
      if (!user) return "";
      return await user.getIdToken();
    } catch {
      return "";
    }
  }

  function buildRedirectUrl(provider = "flutterwave") {
    // You can change these later; just keep it consistent with your routes.
    // Must be an absolute URL for Flutterwave.
    const origin = window.location.origin;
    const qp = new URLSearchParams();
    qp.set("provider", provider);
    qp.set("listingId", listing?.id || "");
    qp.set("checkIn", checkIn || "");
    qp.set("checkOut", checkOut || "");
    qp.set("guests", String(guests || 1));
    qp.set("nights", String(nights || 1));
    qp.set("amountN", String(total || 0));
    return `${origin}/reserve/success?${qp.toString()}`;
  }

  // ✅ Server availability (no Firestore permissions issues)
  const checkAvailability = useCallback(
    async (ci, co) => {
      if (!listing?.id) return { ok: true, msg: "" };
      if (!ci || !co) return { ok: true, msg: "" };

      if (isPastYmd(ci)) return { ok: false, msg: "Check-in cannot be in the past." };
      if (isPastYmd(co)) return { ok: false, msg: "Check-out cannot be in the past." };

      setCheckingAvail(true);
      setAvailMsg("");
      setAvailOk(true);

      try {
        const url =
          `${API}/bookings/availability` +
          `?listingId=${encodeURIComponent(listing.id)}` +
          `&checkIn=${encodeURIComponent(ci)}` +
          `&checkOut=${encodeURIComponent(co)}`;

        const res = await fetch(url, { method: "GET" });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const message = data?.error || data?.message || "Availability check failed";
          return { ok: true, msg: `Availability could not be verified. (${message})` };
        }

        if (data?.available === false) {
          return { ok: false, msg: "These dates are not available. Please choose different dates." };
        }

        return { ok: true, msg: "" };
      } catch (e) {
        console.error("[ReservePage] server availability check failed:", e);
        return {
          ok: true,
          msg: "Availability could not be verified right now. If payment fails, try again.",
        };
      } finally {
        setCheckingAvail(false);
      }
    },
    [API, listing?.id]
  );

  // re-check availability when dates change
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!checkIn || !checkOut || !listing?.id) {
        setAvailOk(true);
        setAvailMsg("");
        return;
      }

      if (isPastYmd(checkIn) || isPastYmd(checkOut)) {
        setAvailOk(false);
        setAvailMsg("Past dates are not allowed.");
        return;
      }

      const res = await checkAvailability(checkIn, checkOut);
      if (!alive) return;
      setAvailOk(res.ok);
      setAvailMsg(res.msg || "");
    })();

    return () => {
      alive = false;
    };
  }, [checkIn, checkOut, listing?.id, checkAvailability]);

  // SERVER creates hold + reference (re-check before hold)
  async function ensureHoldViaServer() {
    if (!user) {
      toast("Please log in first.", "warning");
      nav("/login", { state: { from: location.pathname } });
      return null;
    }
    if (!listing) return null;

    if (!checkIn || !checkOut) {
      toast("Please select check-in and check-out dates.", "warning");
      return null;
    }

    if (isPastYmd(checkIn)) {
      toast("Check-in cannot be in the past.", "warning");
      return null;
    }

    if (isPastYmd(checkOut)) {
      toast("Check-out cannot be in the past.", "warning");
      return null;
    }

    if (!datesValid) {
      toast("Select valid dates (check-in before check-out).", "warning");
      return null;
    }

    const res = await checkAvailability(checkIn, checkOut);
    if (!res.ok) {
      setAvailOk(false);
      setAvailMsg(res.msg || "These dates are not available.");
      toast(res.msg || "Selected dates are not available.", "warning");
      return null;
    }

    try {
      setBusy(true);

      const payload = {
        listingId: listing.id,
        guests,
        nights,
        amountN: total,
        checkIn,
        checkOut,
        ttlMinutes: 90,
      };

      const data = await createBookingHoldAPI(payload);
      setHoldInfo({ id: data.bookingId, expiresAt: data.expiresAt || null });

      return { bookingId: data.bookingId, reference: data.reference };
    } catch (e) {
      console.error(e);
      toast(e?.message || "Could not create a reservation hold.", "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onPaystack() {
    const hold = await ensureHoldViaServer();
    if (!hold) return;

    const { bookingId, reference } = hold;

    const key = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    if (!window.PaystackPop || !key) {
      toast("Paystack script/key missing.", "error");
      return;
    }

    const amountKobo = Math.max(100, Math.floor(Number(total || 0) * 100));
    setBusy(true);

    const handler = window.PaystackPop.setup({
      key,
      email: user?.email || "guest@example.com",
      amount: amountKobo,
      currency: "NGN",
      ref: reference,
      callback: function () {
        setBusy(false);
        toast("Payment received ✅ Redirecting…", "success");
        nav("/reserve/success", {
          replace: true,
          state: {
            bookingId,
            listing,
            checkIn,
            checkOut,
            provider: "paystack",
          },
        });
      },
      onClose: function () {
        setBusy(false);
        toast("Payment closed.", "info");
      },
    });

    if (handler?.openIframe) handler.openIframe();
  }

  async function onFlutterwave() {
    const hold = await ensureHoldViaServer();
    if (!hold) return;

    const { bookingId } = hold;

    try {
      setBusy(true);

      const token = await getIdTokenOrNull();
      if (!token) {
        toast("Please log in again.", "warning");
        nav("/login", { state: { from: location.pathname } });
        return;
      }

      const redirectUrl = buildRedirectUrl("flutterwave");

      const res = await fetch(`${API}/flutterwave/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "booking",
          bookingId,
          redirectUrl,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || !data?.link) {
        const msg = data?.message || "flutterwave_init_failed";
        toast(`Flutterwave init failed: ${msg}`, "error");
        return;
      }

      // Redirect to Flutterwave hosted payment page
      window.location.href = data.link;
    } catch (e) {
      console.error(e);
      toast(e?.message || "Could not start Flutterwave checkout.", "error");
    } finally {
      setBusy(false);
    }
  }

  const showNonGuestBlock = Boolean(user && !isGuest);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white">
      {showNonGuestBlock ? (
        <div className="min-h-screen grid place-items-center px-4">
          <div className="max-w-lg w-full rounded-3xl border border-amber-400/30 bg-black/40 p-6 backdrop-blur-sm shadow-[0_24px_70px_rgba(0,0,0,.75)]">
            <h2
              className="text-xl font-bold text-amber-300"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              Reservation not available
            </h2>
            <p className="mt-2 text-gray-200 text-sm">
              You’re signed in as <strong>{role || "user"}</strong>. Only guests can make reservations.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
                onClick={() => nav(-1)}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 pt-24 pb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs md:text-sm"
              onClick={() => nav(-1)}
            >
              ← Back to details
            </button>
            {listing && (
              <span className="text-[11px] text-white/40">
                {listing.city || "Nigeria"} • {listing.area || ""}
              </span>
            )}
          </div>

          <div className="mb-6">
            <h1
              className="text-2xl md:text-[28px] font-semibold tracking-tight"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              Complete your reservation
            </h1>
            <p className="text-sm text-white/70 max-w-xl mt-1">
              Pay securely to confirm. ID check opens <strong>24hrs before arrival</strong> to unlock check-in details.
            </p>
          </div>

          <Stepper step={step} />

          <div className="grid gap-6 md:grid-cols-[minmax(0,1.55fr),minmax(0,1fr)] items-start">
            <div className="space-y-4">
              <div className="rounded-3xl bg-gradient-to-r from-[#12151c] via-[#0b0f14] to-[#05070b] border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,.75)]">
                {loadingListing ? (
                  <div className="h-6 w-40 rounded-full bg-white/5 animate-pulse" />
                ) : (
                  <>
                    <h2
                      className="text-lg font-semibold"
                      style={{
                        fontFamily:
                          'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
                      }}
                    >
                      {listing?.title || "Listing"}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Secure booking on NestaNg • contact details remain hidden until booking rules allow.
                    </p>
                  </>
                )}
              </div>

              {(checkingAvail || availMsg) && (
                <div
                  className={`rounded-2xl border p-4 text-xs md:text-sm ${
                    checkingAvail
                      ? "border-white/10 bg-white/5 text-white/80"
                      : availOk
                      ? "border-amber-300/25 bg-amber-400/5 text-amber-100"
                      : "border-red-400/25 bg-red-500/10 text-red-100"
                  }`}
                >
                  {checkingAvail
                    ? "Checking availability…"
                    : availOk
                    ? availMsg
                    : availMsg || "These dates are not available."}
                </div>
              )}

              {step === 1 && (
                <div className="rounded-3xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.15em]">
                    Step 1 · Dates & guests
                  </h3>

                  <Field label="Guests" hint="Max as allowed by host">
                    <Input
                      type="number"
                      min={1}
                      value={guests}
                      onChange={(e) => setGuests(Math.max(1, Number(e.target.value || 1)))}
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Check-in" hint={`From ${todayMin}`}>
                      <Input
                        type="date"
                        min={todayMin}
                        value={checkIn}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && isPastYmd(v)) {
                            toast("Past dates are not allowed.", "warning");
                            return;
                          }
                          setCheckIn(v);
                          if (checkOut && v && new Date(checkOut) <= new Date(v)) {
                            setCheckOut("");
                          }
                        }}
                      />
                    </Field>
                    <Field label="Check-out" hint={`From ${checkOutMin}`}>
                      <Input
                        type="date"
                        min={checkOutMin}
                        value={checkOut}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && isPastYmd(v)) {
                            toast("Past dates are not allowed.", "warning");
                            return;
                          }
                          if (checkIn && v && new Date(v) <= new Date(checkIn)) {
                            toast("Check-out must be after check-in.", "warning");
                            return;
                          }
                          setCheckOut(v);
                        }}
                      />
                    </Field>
                  </div>

                  <p className="text-xs text-gray-400">Past dates are blocked. Your check-out must be after check-in.</p>

                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-gray-400">
                      {datesValid && nights > 0 ? `${nights} night(s) selected` : "No valid dates yet"}
                      {datesValid && !checkingAvail && !availOk ? <span className="ml-2 text-red-200">• Unavailable</span> : null}
                    </div>
                    <button
                      type="button"
                      disabled={!canGoToStep2}
                      onClick={() => setStep(2)}
                      className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold ${
                        canGoToStep2
                          ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_12px_40px_rgba(0,0,0,.6)]"
                          : "bg-white/5 text-white/35 cursor-not-allowed"
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="rounded-3xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.15em]">
                    Step 2 · Confirm details
                  </h3>

                  <div className="rounded-2xl bg-black/20 border border-white/10 p-4 text-sm text-white/80">
                    <p className="text-white/90 font-semibold">Privacy & security</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">
                      Contact details stay private. <strong>ID check opens 24hrs before arrival</strong> to unlock check-in details.
                    </p>
                  </div>

                  {!availOk && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-xs text-red-100">
                      Dates unavailable. Please go back and select new dates.
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/15 hover:bg-white/10"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={!canGoToStep3}
                      onClick={() => setStep(3)}
                      className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold ${
                        canGoToStep3
                          ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_12px_40px_rgba(0,0,0,.6)]"
                          : "bg-white/5 text-white/35 cursor-not-allowed"
                      }`}
                    >
                      Next: payment →
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="rounded-3xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.15em]">Step 3 · Payment</h3>
                  <p className="text-xs text-gray-400">
                    We’ll create a temporary reservation hold, then start secure checkout. Use Flutterwave if Paystack is not yet activated.
                  </p>

                  {!availOk && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-xs text-red-100">
                      Dates unavailable. Please go back and select new dates.
                    </div>
                  )}

                  {/* Provider toggle */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPayProvider("flutterwave")}
                      className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                        payProvider === "flutterwave"
                          ? "border-amber-300/60 bg-amber-400/10 text-amber-200"
                          : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      Flutterwave
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayProvider("paystack")}
                      className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                        payProvider === "paystack"
                          ? "border-amber-300/60 bg-amber-400/10 text-amber-200"
                          : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      Paystack
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {payProvider === "flutterwave" ? (
                      <button
                        onClick={onFlutterwave}
                        disabled={!canPay || busy}
                        className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold ${
                          canPay
                            ? "bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-500 text-black shadow-[0_18px_50px_rgba(0,0,0,.7)]"
                            : "bg-gray-700/80 text-gray-400 cursor-not-allowed"
                        } ${busy ? "animate-pulse" : ""}`}
                      >
                        {busy ? "Processing…" : "Confirm & Pay (Flutterwave)"}
                      </button>
                    ) : (
                      <button
                        onClick={onPaystack}
                        disabled={!canPay || busy}
                        className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold ${
                          canPay
                            ? "bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-500 text-black shadow-[0_18px_50px_rgba(0,0,0,.7)]"
                            : "bg-gray-700/80 text-gray-400 cursor-not-allowed"
                        } ${busy ? "animate-pulse" : ""}`}
                      >
                        {busy ? "Processing…" : "Confirm & Pay (Paystack)"}
                      </button>
                    )}
                  </div>

                  {holdInfo?.expiresAt && <div className="mt-3 text-xs text-amber-300">Your provisional hold will expire soon.</div>}

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-3 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/15 hover:bg-white/10"
                  >
                    ← Back
                  </button>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl bg-[#05090f] border border-white/10 p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,.8)]">
                <h3 className="text-sm font-semibold mb-2 uppercase tracking-[0.16em] text-white/70">Booking summary</h3>
                {listing ? (
                  <>
                    <p className="text-sm text-white/90">{listing.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {listing.area || "—"}, {listing.city || "Nigeria"}
                    </p>
                    <div className="mt-3 text-sm text-gray-300">
                      {ngn(listing.pricePerNight || 0)} <span className="text-xs text-white/60">/ night</span>
                    </div>
                    <div className="mt-3 text-sm">
                      {nights > 0 ? (
                        <>
                          {nights} night(s) · {guests} guest(s)
                          <br />
                          <span className="font-semibold text-amber-300">Total: {ngn(total)}</span>
                          {!checkingAvail && !availOk ? (
                            <div className="mt-2 text-xs text-red-200">Dates unavailable — choose different dates.</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-gray-500 text-xs">Select dates to see your total.</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
                )}
              </div>

              <div className="rounded-3xl bg-white/5 border border-white/10 p-4 text-xs text-gray-400 space-y-2">
                <p>Your payment is processed securely via Flutterwave/Paystack. NestaNg never stores your full card details.</p>
                <p>After payment, you’ll complete a short check-in ID confirmation to unlock your check-in guide.</p>
              </div>
            </aside>
          </div>

          <div className="mt-10 border-t border-white/5 pt-6">
            <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
              <span className="text-lg">🔒</span>
              <span>Secure checkout · Powered by Flutterwave/Paystack · Encrypted payment processing</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
