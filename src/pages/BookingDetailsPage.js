// src/pages/BookingDetailsPage.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000/api";

/* ---------- helpers ---------- */

function ngn(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function fmt(d) {
  if (!d) return "-";
  try {
    if (typeof d === "object") {
      if (typeof d.toDate === "function") d = d.toDate();
      else if (typeof d.seconds === "number") d = new Date(d.seconds * 1000);
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toLocaleString();
  } catch {
    return "-";
  }
}

function justDate(d) {
  if (!d) return "-";
  try {
    if (typeof d === "object") {
      if (typeof d.toDate === "function") d = d.toDate();
      else if (typeof d.seconds === "number") d = new Date(d.seconds * 1000);
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toDateString();
  } catch {
    return "-";
  }
}

function isPast(checkOut) {
  try {
    let co = checkOut;
    if (co && typeof co === "object") {
      if (typeof co.toDate === "function") co = co.toDate();
      else if (typeof co.seconds === "number") co = new Date(co.seconds * 1000);
    }
    const d = co instanceof Date ? co : new Date(co);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
}

/* ---------- component ---------- */

export default function BookingDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/bookings/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setData(json || null);
      } catch (e) {
        if (alive) setErr("Could not load this booking. Please go back and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleCancel() {
    if (!data) return;
    const status = (data.status || "").toLowerCase();
    if (isPast(data.checkOut) || status === "cancelled") {
      alert("This booking can’t be cancelled.");
      return;
    }
    if (!window.confirm("Cancel this booking?")) return;

    setCancelling(true);
    const prev = data;
    setData((d) => ({ ...d, status: "cancelled" }));
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("Booking cancelled.");
    } catch (e) {
      alert("Could not cancel booking. Restoring previous state.");
      setData(prev);
    } finally {
      setCancelling(false);
    }
  }

  function rebook() {
    if (!data) return;
    const listing = {
      id: data.listingId || data.listing?.id || "",
      title: data.listingTitle || data.listing?.title || "Listing",
      location: data.listingLocation || data.listing?.location || "",
      pricePerNight: data.pricePerNight || data.listing?.pricePerNight || 0,
      city: data.city,
      area: data.area,
    };
    nav("/payment", {
      state: {
        booking: {
          listing,
          listingId: listing.id,
          checkIn: "",
          checkOut: "",
          guests: data.guests || 1,
          pricePerNight: listing.pricePerNight || 0,
          nights: 0,
          subtotal: 0,
          fee: 0,
          total: 0,
          userEmail: data.userEmail,
          userId: data.userId,
        },
        from: "rebook",
      },
    });
  }

  /* ---------- render ---------- */

  return (
    <main className="min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => nav(-1)}
          className="mb-4 text-sm text-gray-300 hover:text-white"
        >
          ← Back
        </button>

        {loading && (
          <div className="rounded-xl border border-white/10 bg-gray-800 p-6">
            Loading booking…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && !data && (
          <div className="rounded-xl border border-white/10 bg-gray-800 p-6">
            Booking not found.
          </div>
        )}

        {!loading && data && (
          <div className="rounded-2xl border border-white/10 bg-gray-800 p-6">
            <header className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{data.listingTitle || "Listing"}</h1>
                <p className="text-gray-300">{data.listingLocation || ""}</p>
                <p className="mt-1 text-sm text-gray-400">Created: {fmt(data.createdAt)}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-md border ${
                  (data.status || "").toLowerCase() === "paid"
                    ? "border-emerald-400 text-emerald-300 bg-emerald-400/10"
                    : (data.status || "").toLowerCase() === "cancelled"
                    ? "border-red-400 text-red-300 bg-red-400/10"
                    : "border-gray-400 text-gray-300 bg-gray-400/10"
                }`}
              >
                {data.status || "—"}
              </span>
            </header>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-900/40 border border-white/10 p-4">
                <div className="text-gray-400">Check-in</div>
                <div className="font-semibold">{justDate(data.checkIn)}</div>
              </div>
              <div className="rounded-lg bg-gray-900/40 border border-white/10 p-4">
                <div className="text-gray-400">Check-out</div>
                <div className="font-semibold">{justDate(data.checkOut)}</div>
              </div>
              <div className="rounded-lg bg-gray-900/40 border border-white/10 p-4">
                <div className="text-gray-400">Guests</div>
                <div className="font-semibold">{data.guests || 1}</div>
              </div>
              <div className="rounded-lg bg-gray-900/40 border border-white/10 p-4">
                <div className="text-gray-400">Nights</div>
                <div className="font-semibold">{data.nights ?? "-"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-gray-900/40 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{ngn(data.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Service fee</span>
                <span className="font-medium">{ngn(data.fee)}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{ngn(data.total)}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={rebook}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700"
              >
                Rebook
              </button>

              {(data.status || "").toLowerCase() !== "cancelled" && !isPast(data.checkOut) && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className={`px-4 py-2 rounded-lg border ${
                    cancelling
                      ? "bg-red-900/30 border-red-400/50 text-red-200 cursor-not-allowed"
                      : "bg-red-900/30 border-red-400/60 text-red-200 hover:bg-red-900/50"
                  }`}
                >
                  {cancelling ? "Cancelling…" : "Cancel booking"}
                </button>
              )}

              <button
                onClick={() => nav("/booking-complete", { state: { booking: data } })}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
              >
                View receipt
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 