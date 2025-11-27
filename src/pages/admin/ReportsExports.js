// src/pages/admin/ReportsExports.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import DateRangeBar from "../../components/DateRangeBar";
import { withRangeParams } from "../../lib/api";

/* ------------------------------ API base ------------------------------ */
const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

/* ------------------------------ UI bits ------------------------------- */
const Card = ({ title, children }) => (
  <section
    style={{
      padding: 16,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,.10)",
      background:
        "radial-gradient(1200px 600px at -10% 0%, rgba(250,204,21,.05), transparent 40%), rgba(255,255,255,.04)",
      boxShadow: "0 12px 32px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.03)",
    }}
  >
    <h3 style={{ margin: "4px 0 10px", fontWeight: 900, color: "#f8fafc" }}>{title}</h3>
    {children}
  </section>
);

/* ------------------------------ Demo fallbacks ------------------------------ */
const demoBookings = [
  {
    id: "demo-bk-1",
    listingTitle: "Signature Loft • VI",
    guestEmail: "guest@nesta.dev",
    nights: 3,
    totalAmount: 270000,
    status: "confirmed",
    createdAt: { toDate: () => new Date() },
  },
];
const demoPayouts = [
  {
    id: "demo-po-1",
    payeeType: "host",
    payeeEmail: "host@nesta.dev",
    amount: 180000,
    status: "paid",
    createdAt: { toDate: () => new Date() },
  },
];

/* -------------------------------- Page -------------------------------- */
export default function ReportsExports() {
  const navigate = useNavigate();

  const [range, setRange] = useState({ from: "", to: "" });

  const [bookings, setBookings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Export links (server streams CSV) — range-aware
  const usersCsvHref = useMemo(() => withRangeParams("/admin/users/export.csv", range), [range]);
  const listingsCsvHref = useMemo(() => withRangeParams("/admin/listings/export.csv", range), [range]);
  const bookingsCsvHref = useMemo(() => withRangeParams("/admin/bookings/export.csv", range), [range]);
  const kycCsvHref = useMemo(() => withRangeParams("/admin/kyc/export.csv", range), [range]);

  const refresh = async () => {
    setErr("");
    setLoading(true);
    try {
      let b = [];
      let p = [];
      try {
        const qb = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
        const sb = await getDocs(qb);
        sb.forEach((d) => b.push({ id: d.id, ...d.data() }));
      } catch {}
      try {
        const qp = query(collection(db, "payouts"), orderBy("createdAt", "desc"));
        const sp = await getDocs(qp);
        sp.forEach((d) => p.push({ id: d.id, ...d.data() }));
      } catch {}

      if (b.length === 0) b = demoBookings;
      if (p.length === 0) p = demoPayouts;

      setBookings(b);
      setPayouts(p);
    } catch (e) {
      console.error(e);
      setErr("Couldn’t load data for preview.");
      setBookings(demoBookings);
      setPayouts(demoPayouts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookingTotal = useMemo(
    () => bookings.reduce((s, r) => s + Number(r.totalAmount || r.amount || 0), 0),
    [bookings]
  );
  const payoutTotal = useMemo(
    () => payouts.reduce((s, r) => s + Number(r.amount || 0), 0),
    [payouts]
  );

  const openHref = (href) => {
    try {
      const a = document.createElement("a");
      a.href = href.startsWith("http") ? href : `${API_BASE}${href}`;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.click();
    } catch {
      window.location.href = href;
    }
  };

  const tableWrap = {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.12)",
    background:
      "radial-gradient(1200px 600px at 0% -10%, rgba(250,204,21,.04), transparent 40%), rgba(0,0,0,.25)",
    overflow: "hidden",
  };

  const thRow = {
    background: "rgba(255,255,255,.02)",
    color: "#aeb6c2",
    textAlign: "left",
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <AdminHeader
          back
          title="Reports & Exports"
          subtitle="CSV exports and quick analytics previews."
          rightActions={
            <LuxeBtn small onClick={refresh} title="Refresh">
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          }
        />

        {/* Date range bar */}
        <div style={{ marginTop: 10 }}>
          <DateRangeBar range={range} onChange={setRange} />
        </div>

        {err ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.12)",
              color: "#fecaca",
              padding: "10px 12px",
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        ) : null}

        {/* Export tiles */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <Card title="Users">
            <div className="muted" style={{ marginBottom: 10, color: "#cbd5e1" }}>
              Directory of all accounts.
            </div>
            <LuxeBtn kind="gold" onClick={() => openHref(usersCsvHref)}>
              Export Users CSV
            </LuxeBtn>
          </Card>

          <Card title="Listings">
            <div className="muted" style={{ marginBottom: 10, color: "#cbd5e1" }}>
              Inventory, status, and premium flags.
            </div>
            <LuxeBtn kind="gold" onClick={() => openHref(listingsCsvHref)}>
              Export Listings CSV
            </LuxeBtn>
          </Card>

          <Card title="Bookings / Transactions">
            <div className="muted" style={{ marginBottom: 10, color: "#cbd5e1" }}>
              Payments, references, and states.
            </div>
            <LuxeBtn kind="gold" onClick={() => openHref(bookingsCsvHref)}>
              Export Bookings CSV
            </LuxeBtn>
          </Card>

          <Card title="KYC">
            <div className="muted" style={{ marginBottom: 10, color: "#cbd5e1" }}>
              Verification workflow data.
            </div>
            <LuxeBtn kind="gold" onClick={() => openHref(kycCsvHref)}>
              Export KYC CSV
            </LuxeBtn>
          </Card>
        </div>

        {/* Quick preview: bookings */}
        <div style={{ ...tableWrap, marginTop: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              fontWeight: 800,
              fontSize: 18,
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            Recent bookings
          </div>

          {loading ? (
            <div style={{ padding: 16, color: "#aeb6c2" }}>Loading…</div>
          ) : (
            <>
              <div style={{ padding: "8px 16px", color: "#cbd5e1" }}>
                Rows: {bookings.length.toLocaleString()} • Total: ₦
                {bookingTotal.toLocaleString()}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    minWidth: 760,
                  }}
                >
                  <thead>
                    <tr style={thRow}>
                      {["ID", "Listing", "Guest", "Nights", "Total", "Status"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 6).map((r) => (
                      <tr key={r.id}>
                        <td className="muted" style={{ padding: "10px 16px", color: "#94a3b8" }}>
                          {r.id}
                        </td>
                        <td style={{ padding: "10px 16px" }}>{r.listingTitle || r.listingId || "—"}</td>
                        <td style={{ padding: "10px 16px" }}>{r.guestEmail || "—"}</td>
                        <td style={{ padding: "10px 16px" }}>{Number(r.nights || 0)}</td>
                        <td style={{ padding: "10px 16px" }}>
                          ₦{Number(r.totalAmount || r.amount || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>
                          {r.status || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Quick preview: payouts */}
        <div style={{ ...tableWrap, marginTop: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              fontWeight: 800,
              fontSize: 18,
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            Recent payouts
          </div>

          {loading ? (
            <div style={{ padding: 16, color: "#aeb6c2" }}>Loading…</div>
          ) : (
            <>
              <div style={{ padding: "8px 16px", color: "#cbd5e1" }}>
                Rows: {payouts.length.toLocaleString()} • Total: ₦
                {payoutTotal.toLocaleString()}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    minWidth: 720,
                  }}
                >
                  <thead>
                    <tr style={thRow}>
                      {["ID", "Payee", "Type", "Amount", "Status"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.slice(0, 6).map((r) => (
                      <tr key={r.id}>
                        <td className="muted" style={{ padding: "10px 16px", color: "#94a3b8" }}>
                          {r.id}
                        </td>
                        <td style={{ padding: "10px 16px" }}>{r.payeeEmail || "—"}</td>
                        <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>
                          {r.payeeType || "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          ₦{Number(r.amount || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>
                          {r.status || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
