// src/pages/BookingCompletePage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

/* ---------- helpers ---------- */
const safeText = (v) => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  // Firestore Timestamp-ish
  if (typeof v === "object" && typeof v.seconds === "number") {
    try {
      return new Date(v.seconds * 1000).toLocaleString();
    } catch {}
  }
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().toLocaleString();
    } catch {}
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const fmtDate = (d, fallback = "—") => {
  if (!d) return fallback;
  try {
    if (typeof d === "object") {
      if (typeof d.toDate === "function") d = d.toDate();
      else if (typeof d.seconds === "number") d = new Date(d.seconds * 1000);
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return fallback;
    return dt.toDateString();
  } catch {
    return fallback;
  }
};

const ngn = (n) => {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₦${num.toLocaleString()}`;
  }
};

const diffNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  let inD = checkIn, outD = checkOut;
  if (typeof inD === "object" && typeof inD.seconds === "number")
    inD = new Date(inD.seconds * 1000);
  if (typeof outD === "object" && typeof outD.seconds === "number")
    outD = new Date(outD.seconds * 1000);
  inD = inD instanceof Date ? inD : new Date(inD);
  outD = outD instanceof Date ? outD : new Date(outD);
  // normalize to noon to avoid DST edges
  const ms = outD.setHours(12, 0, 0, 0) - inD.setHours(12, 0, 0, 0);
  return ms > 0 ? Math.round(ms / (1000 * 60 * 60 * 24)) : 0;
};

/* ---------- page ---------- */
export default function BookingCompletePage() {
  const { state } = useLocation();
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    // 1) prefer router state
    const statePending = state?.booking || state?.pending || null;
    const stateTx = state?.tx || null;

    // 2) fall back to sessionStorage
    let pending = null;
    let tx = null;
    try {
      if (!statePending) {
        const raw = sessionStorage.getItem("booking_pending");
        pending = raw ? JSON.parse(raw) : null;
      } else {
        pending = statePending;
      }
    } catch {
      pending = null;
    }
    try {
      if (!stateTx) {
        const raw = sessionStorage.getItem("paystack_tx");
        tx = raw ? JSON.parse(raw) : null;
      } else {
        tx = stateTx;
      }
    } catch {
      tx = null;
    }

    // normalize tx shape
    const normalizedTx =
      tx && typeof tx === "object"
        ? {
            status:
              (tx.status || tx.message || tx.data?.status || "").toString(),
            reference:
              tx.reference ||
              tx.trxref ||
              tx.data?.reference ||
              tx.data?.txRef ||
              "",
            raw: tx,
          }
        : null;

    setSnapshot({
      pending: pending || null,
      tx: normalizedTx,
      when: new Date().toISOString(),
    });

    // clear session copies so we don't re-use stale data
    try {
      sessionStorage.removeItem("booking_pending");
    } catch {}
    try {
      sessionStorage.removeItem("paystack_tx");
    } catch {}
  }, [state]);

  const info = useMemo(() => {
    const p = snapshot?.pending;
    if (!p) return null;

    const listing = p.listing || {};
    const nightly = Number(
      listing.pricePerNight ?? listing.price ?? p.pricePerNight ?? 0
    );
    const checkIn = p.checkIn ?? listing.checkIn ?? null;
    const checkOut = p.checkOut ?? listing.checkOut ?? null;
    const nights = diffNights(checkIn, checkOut);
    const guests = Number(p.guests ?? 1) || 1;
    const feePct = Number(p.feePct ?? 5) || 0;
    const subtotal = nightly * nights;
    const fee = Math.round((feePct / 100) * subtotal);
    const total = subtotal + fee;

    return {
      listing: {
        id: safeText(listing.id),
        title: safeText(listing.title || "Listing"),
        city: safeText(listing.city),
        area: safeText(listing.area),
      },
      checkIn,
      checkOut,
      guests,
      nights,
      nightly,
      feePct,
      subtotal,
      fee,
      total,
    };
  }, [snapshot]);

  const isSuccess = (snapshot?.tx?.status || "")
    .toString()
    .toLowerCase()
    .includes("success");

  /* ---------- states ---------- */
  if (!snapshot) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h2>Finishing up…</h2>
            <p className="muted">
              Please wait while we prepare your booking summary.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!info || !info.listing) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <div
            className="card"
            style={{
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Checkout</h2>
            <p>
              We couldn’t find your booking details. Please go back to Browse
              and select a listing again.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className="btn" to="/browse">
                Explore listings
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const {
    listing,
    checkIn,
    checkOut,
    guests,
    nights,
    nightly,
    subtotal,
    fee,
    total,
    feePct,
  } = info;

  return (
    <main className="dash-bg">
      <div className="container dash-wrap" style={{ paddingBottom: 64 }}>
        <div
          className="card"
          style={{
            maxWidth: 980,
            marginInline: "auto",
            borderRadius: 18,
            padding: 22,
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(30,41,59,0.45) 0%, rgba(30,41,59,0.30) 100%)",
          }}
        >
          {/* header */}
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: isSuccess
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(239,68,68,0.15)",
                display: "grid",
                placeItems: "center",
                border: isSuccess
                  ? "1px solid rgba(16,185,129,0.35)"
                  : "1px solid rgba(239,68,68,0.35)",
              }}
            >
              <span style={{ fontSize: 22 }}>{isSuccess ? "✅" : "⚠️"}</span>
            </div>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>
                {isSuccess ? "Payment successful" : "Payment status unknown"}
              </h2>
              <div className="muted" style={{ fontSize: 13 }}>
                {safeText(snapshot?.tx?.reference)
                  ? (
                    <>
                      Reference:{" "}
                      <code>{safeText(snapshot.tx.reference)}</code>
                    </>
                    )
                  : <>Completed at {fmtDate(snapshot.when)}</>}
              </div>
            </div>
          </div>

          {/* summary + totals */}
          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "minmax(260px,1fr) minmax(260px,1fr)",
              marginTop: 18,
            }}
          >
            <section
              className="card"
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <h3>Stay summary</h3>
              <div style={{ fontWeight: 600 }}>{safeText(listing.title)}</div>
              <div className="muted">
                {safeText(listing.city)} • {safeText(listing.area)}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Check-in: <strong>{fmtDate(checkIn)}</strong>
                <br />
                Check-out: <strong>{fmtDate(checkOut)}</strong>
                <br />
                Guests: <strong>{guests}</strong>
                <br />
                Nights: <strong>{nights}</strong>
              </div>
            </section>

            <section
              className="card"
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <h3>Charges</h3>
              <div className="muted">
                {ngn(nightly)} × {nights} nights
                <div style={{ float: "right" }}>{ngn(subtotal)}</div>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Service fee ({feePct}%)
                <div style={{ float: "right" }}>{ngn(fee)}</div>
              </div>
              <hr />
              <div style={{ fontWeight: 700 }}>
                Total
                <div style={{ float: "right" }}>{ngn(total)}</div>
              </div>
              <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                <Link className="btn" to="/bookings">
                  View bookings
                </Link>
                {safeText(listing.id) && (
                  <Link className="btn ghost" to={`/listing/${safeText(listing.id)}`}>
                    Open listing
                  </Link>
                )}
                <Link className="btn ghost" to="/browse">
                  Explore more
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
} 
