// src/pages/CheckoutPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Currency helper (₦ with thousand separators) */
function ngn(n) {
  const v = Number(n || 0);
  return `₦${v.toLocaleString("en-NG")}`;
}

/** LocalStorage key to allow refreshing checkout without losing the id */
const LS_KEY = "nesta:lastListingId";

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ---- Resolve listing id & mode (book/reserve) ----
  const queryId = searchParams.get("id");
  const stateId = location.state?.id;
  const lastId = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
  const listingId = queryId || stateId || lastId || null;

  const mode = (searchParams.get("mode") || location.state?.mode || "book")
    .toString()
    .toLowerCase(); // "book" | "reserve"
  const title = mode === "reserve" ? "Reserve your stay" : "Confirm your stay";

  // ---- Listing data ----
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ---- Form state ----
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);

  // Persist id so a refresh still works
  useEffect(() => {
    if (listingId) localStorage.setItem(LS_KEY, listingId);
  }, [listingId]);

  // Fetch listing
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setErr("");
        setLoading(true);

        if (!listingId) {
          setListing(null);
          return;
        }

        const snap = await getDoc(doc(db, "listings", listingId));
        if (!alive) return;

        if (snap.exists()) {
          setListing({ id: snap.id, ...snap.data() });
        } else {
          setErr("Could not find this listing.");
          setListing(null);
        }
      } catch (e) {
        console.error("[Checkout] load listing failed:", e);
        if (alive) setErr("We couldn't load this listing right now.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [listingId]);

  // Parse dates & compute nights
  const parsed = useMemo(() => {
    const inDate = checkIn ? new Date(checkIn) : null;
    const outDate = checkOut ? new Date(checkOut) : null;

    let nights = 0;
    if (inDate && outDate) {
      // 00:00 normalize to avoid DST hiccups
      const a = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
      const b = new Date(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());
      const diff = (b - a) / (1000 * 60 * 60 * 24);
      nights = Math.max(0, Math.ceil(diff));
    }

    return { inDate, outDate, nights };
  }, [checkIn, checkOut]);

  // Totals
  const price = Number(listing?.pricePerNight || 0);
  const subtotal = parsed.nights * price;
  const fee = Math.round(subtotal * 0.05); // 5% service fee
  const total = subtotal + fee;

  const canPay = Boolean(listing && parsed.nights > 0 && guests > 0);

  const onProceed = () => {
    if (!canPay) return;
    // TODO: plug your gateway here (Stripe/Paystack).
    // You have the full payload below:
    const payload = {
      listingId: listing.id,
      title: listing.title || "Listing",
      city: listing.city || "",
      area: listing.area || "",
      pricePerNight: price,
      mode,
      checkIn,
      checkOut,
      nights: parsed.nights,
      guests,
      fee,
      total,
    };
    console.log("[Checkout] Proceeding with:", payload);
    // Example: navigate("/payment", { state: payload });
    alert("Proceeding to payment… (check console for payload)");
  };

  // Simple banner when id is missing
  const missingId = !listingId;

  return (
    <main className="dash-bg">
      <div className="container dash-wrap" style={{ paddingBottom: 40 }}>
        <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 20,
            marginTop: 16,
          }}
        >
          {/* Left: form */}
          <section className="card" style={{ padding: 16, borderRadius: 14 }}>
            <h2 style={{ marginTop: 0 }}>{title}</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Choose dates and guests, then proceed to payment.
            </p>

            {missingId && (
              <div
                style={{
                  marginTop: 12,
                  marginBottom: 12,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#fecaca",
                  padding: "10px 12px",
                  borderRadius: 10,
                }}
              >
                Missing listing id. Please return to <strong>Browse</strong> and try again.
              </div>
            )}

            {err && !missingId && (
              <div
                style={{
                  marginTop: 12,
                  marginBottom: 12,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#fecaca",
                  padding: "10px 12px",
                  borderRadius: 10,
                }}
              >
                {err}
              </div>
            )}

            {/* Form rows */}
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div>
                <label className="muted">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={todayISO()}
                />
              </div>

              <div>
                <label className="muted">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn || todayISO()}
                />
              </div>

              <div>
                <label className="muted">Guests</label>
                <input
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
            </div>

            {/* Totals */}
            <div style={{ marginTop: 16 }}>
              <div className="muted">
                {ngn(price)} × {parsed.nights} {parsed.nights === 1 ? "night" : "nights"}
              </div>
              <div className="muted">Service fee (5%): <strong>{ngn(fee)}</strong></div>

              <div
                style={{
                  marginTop: 10,
                  borderTop: "1px dashed rgba(255,255,255,0.12)",
                  paddingTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontWeight: 700 }}>Total</div>
                <div style={{ fontWeight: 800 }}>{ngn(total)}</div>
              </div>
            </div>

            <button
              className="btn"
              style={{ marginTop: 16 }}
              onClick={onProceed}
              disabled={!canPay || loading || missingId}
            >
              Proceed to payment
            </button>
          </section>

          {/* Right: summary */}
          <aside className="card" style={{ padding: 16, borderRadius: 14 }}>
            <h3 style={{ marginTop: 0 }}>Stay summary</h3>

            {loading ? (
              <p className="muted">Loading listing…</p>
            ) : !listing ? (
              <p className="muted">No listing selected.</p>
            ) : (
              <div>
                <div
                  style={{
                    borderRadius: 12,
                    background: "linear-gradient(120deg, rgba(255,214,102,0.12), rgba(255,255,255,0.06))",
                    height: 120,
                    marginBottom: 10,
                  }}
                />
                <div style={{ fontWeight: 700 }}>
                  {listing.title || "Listing"}
                </div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {(listing.city || "—")} • {(listing.area || "—")}
                </div>
                <div style={{ marginTop: 6 }}>{ngn(price)}/night</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

// Small helper to produce today's date as yyyy-mm-dd (for <input type="date"> mins)
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
