// src/pages/BookingCompletePage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* ---------- helpers ---------- */
const safeText = (v) => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
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
  let inD = checkIn,
    outD = checkOut;

  if (typeof inD === "object" && typeof inD.seconds === "number")
    inD = new Date(inD.seconds * 1000);
  if (typeof outD === "object" && typeof outD.seconds === "number")
    outD = new Date(outD.seconds * 1000);

  inD = inD instanceof Date ? inD : new Date(inD);
  outD = outD instanceof Date ? outD : new Date(outD);

  const ms = outD.setHours(12, 0, 0, 0) - inD.setHours(12, 0, 0, 0);
  return ms > 0 ? Math.round(ms / (1000 * 60 * 60 * 24)) : 0;
};

function isPaidOrConfirmed(statusRaw, paymentStatusRaw) {
  const s = String(statusRaw || "").toLowerCase().trim();
  const p = String(paymentStatusRaw || "").toLowerCase().trim();
  return (
    p === "paid" ||
    s === "confirmed" ||
    s === "paid" ||
    s === "paid-pending-confirmation" ||
    s === "paid-needs-review"
  );
}

function resolveHostUidFromBooking(b) {
  if (!b || typeof b !== "object") return null;
  return (
    b.hostId ||
    b.hostUid ||
    b.partnerUid ||
    b.partnerId ||
    b.ownerId ||
    b.ownerUid ||
    b.listing?.hostId ||
    b.listing?.hostUid ||
    b.listing?.partnerUid ||
    b.listing?.partnerId ||
    b.listing?.ownerId ||
    null
  );
}

function getIdToken() {
  // Adjust to your auth storage strategy if different
  return (
    localStorage.getItem("idToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

async function apiGetJson(url) {
  const token = getIdToken();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.error || json?.message || "Request failed");
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function apiPostJson(url, body) {
  const token = getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.error || json?.message || "Request failed");
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/* ---------- page ---------- */
export default function BookingCompletePage() {
  const { state } = useLocation();
  const nav = useNavigate();

  const [snapshot, setSnapshot] = useState(null);
  const [serverBooking, setServerBooking] = useState(null);
  const [serverError, setServerError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef(null);

  // Receipt mode (when you navigate from My Bookings with a full booking object)
  const routeBooking =
    state?.booking &&
    (state.booking.listingTitle || state.booking.total || state.booking.amountN)
      ? state.booking
      : null;

  const entrySourceRibbon = routeBooking
    ? "My Bookings → Receipt"
    : "Post-checkout summary";

  useEffect(() => {
    // Receipt mode: we still optionally poll server to ensure latest status
    if (routeBooking) {
      setSnapshot({
        mode: "receipt",
        bookingIdOrRef: routeBooking.id || routeBooking.reference || "",
        provider: routeBooking.provider || "",
        when: new Date().toISOString(),
      });
      return;
    }

    // Snapshot mode: read from router state then sessionStorage
    const statePending = state?.booking || state?.pending || null;
    const stateTx = state?.tx || null;

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
        // ✅ support both paystack and flutterwave keys
        const raw =
          sessionStorage.getItem("flutterwave_tx") ||
          sessionStorage.getItem("paystack_tx");
        tx = raw ? JSON.parse(raw) : null;
      } else {
        tx = stateTx;
      }
    } catch {
      tx = null;
    }

    // Normalize tx shape (supports Paystack + Flutterwave)
    const normalizedTx =
      tx && typeof tx === "object"
        ? {
            provider: (tx.provider || tx.gateway || tx.type || "").toString(),
            status: (tx.status || tx.message || tx.data?.status || "").toString(),
            reference:
              tx.reference ||
              tx.trxref ||
              tx.data?.reference ||
              tx.data?.txRef ||
              tx.data?.tx_ref ||
              tx.tx_ref ||
              "",
            transaction_id:
              tx.transaction_id ||
              tx.data?.id ||
              tx.id ||
              tx.data?.transaction_id ||
              "",
            raw: tx,
          }
        : null;

    // Determine bookingIdOrRef
    const bookingIdOrRef =
      safeText(pending?.bookingId) ||
      safeText(pending?.id) ||
      safeText(pending?.reference) ||
      safeText(normalizedTx?.reference) ||
      "";

    setSnapshot({
      mode: "snapshot",
      pending: pending || null,
      tx: normalizedTx,
      bookingIdOrRef,
      when: new Date().toISOString(),
    });

    // clear session copies so we don't re-use stale data
    try {
      sessionStorage.removeItem("booking_pending");
    } catch {}
    try {
      sessionStorage.removeItem("paystack_tx");
    } catch {}
    try {
      sessionStorage.removeItem("flutterwave_tx");
    } catch {}
  }, [state, routeBooking]);

  // Compute display info from snapshot.pending (for UI only; not proof of payment)
  const info = useMemo(() => {
    const p = snapshot?.pending;
    if (!p) return null;

    const listing = p.listing || {};
    const nightly = Number(listing.pricePerNight ?? listing.price ?? p.pricePerNight ?? 0);
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
      hostId:
        safeText(
          listing.hostId ||
            listing.hostUid ||
            listing.partnerUid ||
            listing.partnerId ||
            listing.ownerId ||
            ""
        ) || "",
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

  // ✅ Server-truth poller (booking status)
  useEffect(() => {
    if (!snapshot?.bookingIdOrRef) return;

    let cancelled = false;
    setServerError("");
    setServerBooking(null);

    async function loadOnce() {
      try {
        const json = await apiGetJson(`/api/bookings/${encodeURIComponent(snapshot.bookingIdOrRef)}`);
        if (!cancelled) setServerBooking(json?.booking || null);
      } catch (e) {
        if (!cancelled) setServerError(e?.message || "Could not load booking status.");
      }
    }

    // first load immediately
    loadOnce();

    // poll for a short time (payment + webhook can take a few seconds)
    const started = Date.now();
    const maxMs = 90_000; // 90s
    const intervalMs = 3000;

    pollRef.current = setInterval(async () => {
      if (Date.now() - started > maxMs) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      await loadOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [snapshot?.bookingIdOrRef]);

  // ✅ If flutterwave info exists, attempt server verify-booking once (optional)
  useEffect(() => {
    if (!snapshot || routeBooking) return;
    const provider = (snapshot?.tx?.provider || "").toLowerCase();
    const hasFlw = provider.includes("flutter") || safeText(snapshot?.tx?.transaction_id);
    if (!hasFlw) return;

    const bookingId = safeText(snapshot?.pending?.bookingId) || safeText(snapshot?.bookingIdOrRef);
    const tx_ref = safeText(snapshot?.tx?.reference);
    const transaction_id = safeText(snapshot?.tx?.transaction_id);

    if (!bookingId || !tx_ref || !transaction_id) return;

    let didRun = false;

    (async () => {
      if (didRun) return;
      didRun = true;
      setVerifying(true);
      try {
        // If you haven't added this endpoint yet, it will fail silently (and webhook polling still works)
        await apiPostJson(`/api/flutterwave/verify-booking`, {
          bookingId,
          tx_ref,
          transaction_id,
        });
      } catch {
        // swallow - the polling will still pick up webhook confirmation
      } finally {
        setVerifying(false);
      }
    })();
  }, [snapshot, routeBooking]);

  /* ---------- RECEIPT MODE (existing booking) ---------- */
  if (routeBooking) {
    const b = serverBooking || routeBooking; // prefer freshest data

    const listingTitle = b.listingTitle || b.listing?.title || b.title || "Listing";
    const location = b.listingLocation || [b.city, b.area].filter(Boolean).join(", ") || "";
    const ref = b.reference || b.ref || b.id || "";
    const status = (b.status || "").toLowerCase();
    const payStatus = (b.paymentStatus || "").toLowerCase();

    const nights =
      typeof b.nights === "number" && b.nights > 0 ? b.nights : diffNights(b.checkIn, b.checkOut);

    const nightly =
      b.pricePerNight ||
      b.listing?.pricePerNight ||
      (nights > 0 ? (b.total || b.amountN || 0) / nights : 0);

    const subtotal = b.subtotal ?? (nights > 0 ? nights * Number(nightly || 0) : 0);
    const fee = b.fee ?? (b.total != null ? Math.max(0, Number(b.total) - subtotal) : 0);
    const total = b.total != null ? Number(b.total) : subtotal + fee;

    const confirmed = isPaidOrConfirmed(status, payStatus);
    const hostUid = resolveHostUidFromBooking(b);
    const listingId = safeText(b.listingId || b.listing?.id || "");

    const canChat = !!(confirmed && hostUid && listingId);

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
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: confirmed ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.12)",
                    display: "grid",
                    placeItems: "center",
                    border: confirmed
                      ? "1px solid rgba(16,185,129,0.35)"
                      : "1px solid rgba(148,163,184,0.35)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{confirmed ? "✅" : "⏳"}</span>
                </div>
                <div>
                  <h2 style={{ margin: "0 0 6px" }}>
                    {confirmed ? "Booking confirmed" : "Booking processing"}
                  </h2>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Ref: {safeText(ref) || "—"}
                  </div>
                  {!confirmed && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      We’ll update this receipt once payment is verified.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.7)",
                    background: "rgba(15,23,42,0.9)",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entrySourceRibbon}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)",
                gap: 20,
                marginTop: 20,
              }}
            >
              <section>
                <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{listingTitle}</h3>
                {location && (
                  <p className="muted" style={{ margin: 0 }}>
                    {location}
                  </p>
                )}

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  }}
                >
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Check-in
                    </div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(b.checkIn)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Check-out
                    </div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(b.checkOut)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Nights
                    </div>
                    <div style={{ fontWeight: 600 }}>{nights || "—"}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Guests
                    </div>
                    <div style={{ fontWeight: 600 }}>{b.guests || 1}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, fontSize: 13 }}>
                  <div className="muted">
                    Status:{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.6)",
                        fontSize: 11,
                      }}
                    >
                      {b.status || "—"} / {b.paymentStatus || "—"}
                    </span>
                  </div>
                </div>

                {canChat ? (
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() =>
                        nav("/chat", {
                          state: {
                            partnerUid: hostUid,
                            listing: { id: listingId, title: listingTitle },
                          },
                        })
                      }
                      className="btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      Message host
                    </button>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Chat is available for confirmed bookings only.
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                style={{
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(148,163,184,0.4)",
                }}
              >
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Payment summary</h3>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="muted">Nightly rate × {nights || 1}</span>
                  <span style={{ fontWeight: 600 }}>{ngn(subtotal)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="muted">Service fee</span>
                  <span style={{ fontWeight: 600 }}>{ngn(fee)}</span>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(148,163,184,0.45)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                  }}
                >
                  <span>Total</span>
                  <span>{ngn(total)}</span>
                </div>

                {serverError ? (
                  <div style={{ marginTop: 10, fontSize: 12 }} className="muted">
                    Could not refresh status: {serverError}
                  </div>
                ) : null}
              </section>
            </div>

            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Link className="btn ghost" to="/bookings">
                My bookings
              </Link>
              <Link className="btn" to="/">
                Back home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- SNAPSHOT / CHECKOUT FLOW ---------- */
  if (!snapshot) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h2>Finishing up…</h2>
            <p className="muted">Please wait while we prepare your booking summary.</p>
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
            <p>We couldn’t find your booking details. Please go back to Explore and select a listing again.</p>
            <div style={{ marginTop: 16 }}>
              <Link className="btn" to="/explore">
                Explore listings
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { listing, checkIn, checkOut, guests, nights, nightly, subtotal, fee, total, feePct } = info;

  const b = serverBooking;
  const confirmed = b ? isPaidOrConfirmed(b.status, b.paymentStatus) : false;
  const processing = !confirmed;

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
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: confirmed ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.12)",
                  display: "grid",
                  placeItems: "center",
                  border: confirmed
                    ? "1px solid rgba(16,185,129,0.35)"
                    : "1px solid rgba(148,163,184,0.35)",
                }}
              >
                <span style={{ fontSize: 22 }}>{confirmed ? "✅" : "⏳"}</span>
              </div>
              <div>
                <h2 style={{ margin: "0 0 6px" }}>
                  {confirmed ? "Booking confirmed" : "Payment processing"}
                </h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  {safeText(snapshot?.bookingIdOrRef) ? (
                    <>
                      Booking: <code>{safeText(snapshot.bookingIdOrRef)}</code>
                    </>
                  ) : (
                    <>Completed at {fmtDate(snapshot.when)}</>
                  )}
                </div>
                {verifying ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Verifying with Flutterwave…
                  </div>
                ) : processing ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    We’re confirming your payment. This can take a few seconds.
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.7)",
                  background: "rgba(15,23,42,0.9)",
                  textTransform: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {entrySourceRibbon}
              </span>
            </div>
          </div>

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

              {b ? (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Status:{" "}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      fontSize: 11,
                    }}
                  >
                    {b.status || "—"} / {b.paymentStatus || "—"}
                  </span>
                </div>
              ) : serverError ? (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Could not load booking status: {serverError}
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
                  Fetching booking status…
                </div>
              )}
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

              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="btn" to="/bookings">
                  View bookings
                </Link>
                {safeText(listing.id) && (
                  <Link className="btn ghost" to={`/listing/${safeText(listing.id)}`}>
                    Open listing
                  </Link>
                )}
                <Link className="btn ghost" to="/explore">
                  Explore more
                </Link>
                {!confirmed ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => nav("/bookings")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    I’ll check later
                  </button>
                ) : null}
              </div>

              {!confirmed ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Don’t worry — your booking will only be confirmed after payment is verified.
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}