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
    <div className="flex items-center gap-3 mb-6">
      {steps.map((s, idx) => {
        const active = step === s.id;
        const done = step > s.id;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold border ${
                active
                  ? "bg-amber-400 text-black border-amber-300"
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
      <main className="min-h-screen bg-[#0b0f14] text-white grid place-items-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-amber-400/30 bg-black/30 p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-amber-300">
            Reservation not available
          </h2>
          <p className="mt-2 text-gray-200">
            You’re signed in as <strong>{role}</strong>. Only guests can make
            reservations.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
              onClick={() => nav(-1)}
            >
              ← Back
            </button>
            {role === "partner" || role === "verified_partner" ? (
              <button
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm hover:bg-white/15"
                onClick={() => nav("/partner")}
              >
                Go to Partner dashboard
              </button>
            ) : role === "host" ? (
              <button
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm hover:bg-white/15"
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

  // Flutterwave gateway
  async function onFlutterwave() {
    const bookingId = await ensureHold();
    if (!bookingId) return;
    setBusy(true);
    try {
      const fw = window.FlutterwaveCheckout;
      if (!fw) {
        await markBookingFailedFS(bookingId, "gateway_unavailable");
        setBusy(false);
        toast(
          "Flutterwave script not found. Check your test key/script include.",
          "error"
        );
        return;
      }
      fw({
        public_key: process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY,
        tx_ref: `NESTA_${bookingId}_${Date.now()}`,
        amount: Number(total),
        currency: "NGN",
        payment_options: "card,ussd,banktransfer",
        customer: { email: user?.email || "guest@example.com" },
        callback: async (data) => {
          await markBookingConfirmedFS(bookingId, {
            provider: "flutterwave",
            reference: data?.tx_ref || "",
          });
          setBusy(false);
          toast("Payment complete! 🎉", "success");
          nav("/reserve/success", {
            replace: true,
            state: { bookingId, listing },
          });
        },
        onclose: async () => {
          await markBookingFailedFS(bookingId, "cancelled");
          setBusy(false);
          toast("Payment closed.", "info");
        },
      });
    } catch (e) {
      console.error(e);
      await markBookingFailedFS(bookingId, "gateway_error");
      setBusy(false);
      toast("Could not start Flutterwave payment.", "error");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
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

        {/* Stepper */}
        <Stepper step={step} />

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)] items-start">
          {/* LEFT – forms per step */}
          <div className="space-y-4">
            {/* Listing title */}
            <div className="rounded-2xl bg-gradient-to-r from-[#12151c] via-[#0b0f14] to-[#05070b] border border-white/10 p-4">
              {loadingListing ? (
                <div className="h-6 w-40 rounded-full bg-white/5 animate-pulse" />
              ) : (
                <>
                  <h2 className="text-xl font-bold">
                    Reserve: {listing?.title || "Listing"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Secure booking on Nesta • host is notified instantly after
                    payment.
                  </p>
                </>
              )}
            </div>

            {/* Step 1: Dates & guests */}
            {step === 1 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-amber-300">
                  Step 1 · Dates & guests
                </h3>

                <Field label="Guests" hint="Max as allowed by listing">
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
                  Choose valid dates; check-out must be after check-in.
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
                    className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                      canGoToStep2
                        ? "bg-amber-500 hover:bg-amber-400 text-black"
                        : "bg-white/5 text-white/40 cursor-not-allowed"
                    }`}
                  >
                    Next: guest details →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Guest details / ID */}
            {step === 2 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-amber-300">
                  Step 2 · Guest details
                </h3>

                <p className="text-xs text-gray-400">
                  For security, we capture a quick ID reference. The host will
                  only see a masked version.
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
                    className="px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/15 hover:bg-white/10"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!canGoToStep3}
                    onClick={() => setStep(3)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                      canGoToStep3
                        ? "bg-amber-500 hover:bg-amber-400 text-black"
                        : "bg-white/5 text-white/40 cursor-not-allowed"
                    }`}
                  >
                    Next: payment →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-amber-300">
                  Step 3 · Payment
                </h3>
                <p className="text-xs text-gray-400">
                  We’ll create a temporary reservation hold, then redirect you
                  to a secure payment window.
                </p>

                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={onPaystack}
                    disabled={!canPay || busy}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                      canPay
                        ? "bg-amber-500 hover:bg-amber-600 text-black"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    } ${busy ? "animate-pulse" : ""}`}
                  >
                    {busy ? "Processing…" : "Confirm & Pay (Paystack)"}
                  </button>

                <button
                  onClick={onFlutterwave}
                  disabled={!canPay || busy}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                    canPay
                      ? "bg-amber-500 hover:bg-amber-600 text-black"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  } ${busy ? "animate-pulse" : ""}`}
                >
                  {busy ? "Processing…" : "Confirm & Pay (Flutterwave)"}
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
                  className="mt-3 px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/15 hover:bg-white/10"
                >
                  ← Back to details
                </button>
              </div>
            )}
          </div>

          {/* RIGHT – summary card */}
          <aside className="space-y-4">
            <div className="rounded-2xl bg-[#090d12] border border-white/10 p-4">
              <h3 className="text-sm font-semibold mb-2">Booking summary</h3>
              {listing ? (
                <>
                  <p className="text-sm text-white/90">{listing.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {listing.area || "—"}, {listing.city || "Nigeria"}
                  </p>
                  <div className="mt-3 text-sm text-gray-300">
                    ₦{Number(listing.pricePerNight || 0).toLocaleString()}/night
                  </div>
                  <div className="mt-2 text-sm">
                    {nights > 0 ? (
                      <>
                        {nights} night(s) · {guests} guest(s)
                        <br />
                        <span className="font-semibold">
                          Total: {ngn(total)}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs">
                        Select dates to see total.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
              )}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-gray-400 space-y-2">
              <p>
                Your payment is processed securely via Paystack or Flutterwave.
                Nesta does not store your full card details.
              </p>
              <p>
                In case of any issue, your reservation hold will automatically
                expire and the host will not be notified as confirmed.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
