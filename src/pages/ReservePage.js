// src/pages/ReservePage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  ensurePendingHoldFS,
  markBookingConfirmedFS,
  markBookingFailedFS,
} from "../api/bookings";
import useUserProfile from "../hooks/useUserProfile";

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
    { id: 2, label: "Guest details" },
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
            {idx < steps.length - 1 && (
              <div className="w-6 h-px bg-white/10 hidden md:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ReservePage() {
  const { user } = useAuth();
  const { showToast: toast } = useToast();
  const nav = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { profile } = useUserProfile(user?.uid);
  const role = (profile?.role || "").toLowerCase();
  const isGuest = role === "guest" || !role;

  // state listing (from navigate or direct fetch)
  const state = location.state || {};
  const [listing, setListing] = useState(
    state.id
      ? {
          id: state.id,
          title: state.title ?? "Listing",
          pricePerNight: Number(state.price ?? 0),
          ownerId: state.hostId ?? null,
        }
      : null
  );
  const [loadingListing, setLoadingListing] = useState(!state.id);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (listing || !params.id) return;
        setLoadingListing(true);
        const snap = await getDoc(doc(db, "listings", params.id));
        if (alive && snap.exists()) {
          const d = snap.data();
          setListing({
            id: snap.id,
            title: d.title || "Listing",
            pricePerNight: Number(d.pricePerNight || d.price || 0),
            ownerId: d.ownerId || null,
            city: d.city || "",
            area: d.area || "",
          });
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

  // form state
  const [step, setStep] = useState(1);
  const [guests, setGuests] = useState(1);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [idType, setIdType] = useState("passport");
  const [idLast4, setIdLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [holdInfo, setHoldInfo] = useState(null);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  }, [checkIn, checkOut]);

  const datesValid =
    Boolean(checkIn && checkOut) && new Date(checkOut) > new Date(checkIn);

  const total = useMemo(() => {
    if (!listing) return 0;
    const perNight = Number(listing.pricePerNight || 0);
    return Math.max(Number(perNight) * nights * Number(guests || 0), 0);
  }, [listing, nights, guests]);

  const canGoToStep2 = Boolean(listing && guests > 0 && datesValid && nights > 0);
  const canGoToStep3 = Boolean(idLast4.length === 4 && consent && canGoToStep2);

  const canPay =
    Boolean(
      user &&
        listing &&
        datesValid &&
        total > 0 &&
        guests > 0 &&
        consent &&
        idLast4.length === 4
    );

  // Guard – non-guests
  if (user && !isGuest) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white grid place-items-center px-4">
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
            You’re signed in as <strong>{role}</strong>. Only guests can make
            reservations.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 text-sm"
              onClick={() => nav(-1)}
            >
              ← Back
            </button>
            {role === "partner" || role === "verified_partner" ? (
              <button
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs md:text-sm hover:bg-white/15"
                onClick={() => nav("/partner")}
              >
                Go to Partner dashboard
              </button>
            ) : role === "host" ? (
              <button
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs md:text-sm hover:bg-white/15"
                onClick={() => nav("/host")}
              >
                Go to Host dashboard
              </button>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  // Reserve helpers
  async function ensureHold() {
    if (!user) {
      toast("Please log in first.", "warning");
      nav("/login", { state: { from: location.pathname } });
      return null;
    }
    if (!listing) return null;
    if (!datesValid) {
      toast("Select valid dates (check-in before check-out).", "warning");
      return null;
    }
    try {
      const { id, expiresAt } = await ensurePendingHoldFS({
        listing,
        user,
        guests,
        nights,
        amountN: total,
        idType,
        idLast4,
        consent,
        checkIn,
        checkOut,
        ttlMinutes: 90,
      });
      setHoldInfo({ id, expiresAt });
      return id;
    } catch (e) {
      console.error(e);
      toast("Could not create a reservation hold.", "error");
      return null;
    }
  }

  // Paystack gateway
  async function onPaystack() {
    const bookingId = await ensureHold();
    if (!bookingId) return;
    const key = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    if (!window.PaystackPop || !key) {
      toast("Paystack script/key missing.", "error");
      return;
    }
    const amountKobo = Math.max(100, Math.floor(Number(total || 0) * 100));
    const ref = `NESTA_${bookingId}_${Date.now()}`;
    setBusy(true);
    const handler = window.PaystackPop.setup({
      key,
      email: user?.email || "guest@example.com",
      amount: amountKobo,
      currency: "NGN",
      ref,
      callback: function (response) {
        markBookingConfirmedFS(bookingId, {
          provider: "paystack",
          reference: response?.reference || ref,
        })
          .then(() => {
            setBusy(false);
            toast("Payment complete! 🎉", "success");
            nav("/reserve/success", {
              replace: true,
              state: { bookingId, listing },
            });
          })
          .catch((e) => {
            console.error(e);
            setBusy(false);
            toast("Couldn’t confirm payment.", "error");
          });
      },
      onClose: function () {
        markBookingFailedFS(bookingId, "cancelled")
          .catch(() => {})
          .finally(() => {
            setBusy(false);
            toast("Payment closed.", "info");
          });
      },
    });
    if (handler?.openIframe) handler.openIframe();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#050a12] to-[#05070d] text-white">
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-10">
        {/* Header + back */}
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

        {/* Title + stepper */}
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
            Lock in your stay with secure payment. Hosts are notified instantly
            once your booking is confirmed.
          </p>
        </div>

        <Stepper step={step} />

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.55fr),minmax(0,1fr)] items-start">
          {/* LEFT – forms per step */}
          <div className="space-y-4">
            {/* Listing title card */}
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
                    Secure booking on Nesta • host sees your request as soon as
                    payment is successful.
                  </p>
                </>
              )}
            </div>

            {/* Step 1: Dates & guests */}
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
                    onChange={(e) =>
                      setGuests(Math.max(1, Number(e.target.value || 1)))
                    }
                  />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Check-in">
                    <Input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </Field>
                  <Field label="Check-out">
                    <Input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </Field>
                </div>

                <p className="text-xs text-gray-400">
                  Choose valid dates – your check-out must be after check-in.
                </p>

                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-400">
                    {datesValid && nights > 0
                      ? `${nights} night(s) selected`
                      : "No valid dates yet"}
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
                    Next: guest details →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Guest details / ID */}
            {step === 2 && (
              <div className="rounded-3xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-4">
                <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.15em]">
                  Step 2 · Guest details
                </h3>

                <p className="text-xs text-gray-400">
                  For security, we capture a quick ID reference. The host only
                  sees a masked version.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="ID Type">
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="w-full bg-transparent outline-none text-white text-sm"
                    >
                      <option value="passport">Passport</option>
                      <option value="nin">NIN</option>
                      <option value="bvn">BVN</option>
                    </select>
                  </Field>
                  <Field label="Last 4 digits">
                    <Input
                      type="text"
                      maxLength={4}
                      value={idLast4}
                      onChange={(e) =>
                        setIdLast4(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </Field>
                </div>

                <label className="flex items-center gap-2 mt-1 text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I consent to Nesta using this ID reference to protect both
                  guest and host.
                </label>

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

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="rounded-3xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-4">
                <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.15em]">
                  Step 3 · Payment
                </h3>
                <p className="text-xs text-gray-400">
                  We’ll create a temporary reservation hold, then open a secure
                  Paystack window to complete your booking.
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
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
                </div>

                {holdInfo?.expiresAt && (
                  <div className="mt-3 text-xs text-amber-300">
                    Your provisional hold will expire at{" "}
                    {holdInfo.expiresAt.toLocaleTimeString()}.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-3 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/15 hover:bg-white/10"
                >
                  ← Back to details
                </button>
              </div>
            )}
          </div>

          {/* RIGHT – summary card */}
          <aside className="space-y-4">
            <div className="rounded-3xl bg-[#05090f] border border-white/10 p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,.8)]">
              <h3
                className="text-sm font-semibold mb-2 uppercase tracking-[0.16em] text-white/70"
              >
                Booking summary
              </h3>
              {listing ? (
                <>
                  <p className="text-sm text-white/90">{listing.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {listing.area || "—"}, {listing.city || "Nigeria"}
                  </p>
                  <div className="mt-3 text-sm text-gray-300">
                    {ngn(listing.pricePerNight || 0)}{" "}
                    <span className="text-xs text-white/60">/ night</span>
                  </div>
                  <div className="mt-3 text-sm">
                    {nights > 0 ? (
                      <>
                        {nights} night(s) · {guests} guest(s)
                        <br />
                        <span className="font-semibold text-amber-300">
                          Total: {ngn(total)}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs">
                        Select dates to see your total.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
              )}
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/10 p-4 text-xs text-gray-400 space-y-2">
              <p>
                Your payment is processed securely via Paystack. Nesta never
                stores your full card details.
              </p>
              <p>
                If payment fails or is cancelled, your temporary reservation
                hold will automatically expire and the host will not see it as a
                confirmed booking.
              </p>
            </div>
          </aside>
        </div>
      </div>
      {/* Secure Checkout Strip */}
<div className="mt-10 border-t border-white/5 pt-6">
  <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
    <span className="text-lg">🔒</span>
    <span>Secure checkout · Powered by Paystack · Encrypted payment processing</span>
  </div>
</div>

    </main>
  );
}
