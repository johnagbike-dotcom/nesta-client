// src/pages/admin/Transactions.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  withCredentials: false,
  timeout: 15000,
});

/* --------------------------- resilient endpoints ------------------------- */
const LIST_ENDPOINTS = ["/bookings", "/admin/bookings", "/transactions"];
const PATCH_ENDPOINTS = [
  (id) => `/bookings/${id}/status`,
  (id) => `/admin/bookings/${id}/status`,
  (id) => `/transactions/${id}/status`,
  (id, s) => `/bookings/${id}/${s}`,
  (id, s) => `/admin/bookings/${id}/${s}`,
  (id, s) => `/transactions/${id}/${s}`,
];

/* ------------------------------- helpers -------------------------------- */
function getArrayFrom(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.bookings)) return data.bookings;
  if (Array.isArray(data.transactions)) return data.transactions;
  return [];
}
const money = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-NG", { style: "currency", currency: "NGN" })
    : String(n || 0);
const clip = (s, n = 20) => (s ? (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s)) : "");

const statusColor = {
  confirmed: { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  cancelled: { bg: "#cf2336", text: "#ffe9ec", ring: "#a51a2a" },
  refunded:  { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
  pending:   { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },
};

const Chip = ({ label, tone = "pending" }) => {
  const c = statusColor[tone] || statusColor.pending;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 96, height: 34, padding: "0 12px", borderRadius: 999,
        background: c.bg, color: c.text, border: `1px solid ${c.ring}`,
        fontWeight: 700, fontSize: 13, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)",
        textTransform: "capitalize",
      }}
    >
      {label || tone}
    </span>
  );
};

/* ------------------------------- component ------------------------------- */
export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const toast = useToast();
  const notify = (msg, type = "success") => {
    if (toast?.show) return toast.show(msg, type);
    if (type === "error" && toast?.error) return toast.error(msg);
    if (type === "success" && toast?.success) return toast.success(msg);
  };

  const load = async () => {
    setLoading(true);
    try {
      let out = null;
      for (const ep of LIST_ENDPOINTS) {
        try {
          const res = await api.get(ep);
          const arr = getArrayFrom(res.data);
          if (arr) { out = arr; break; }
        } catch {}
      }
      setRows(Array.isArray(out) ? out : []);
      setPage(1);
    } catch {
      notify("Failed to load transactions.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") list = list.filter((b) => String(b.status || "").toLowerCase() === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const email = (b.guestEmail || b.email || "").toLowerCase();
        const title = (b.listingTitle || b.listing || b.title || "").toLowerCase();
        const ref = (b.reference || b.ref || b.id || "").toLowerCase();
        return email.includes(q) || title.includes(q) || ref.includes(q);
      });
    }
    return list;
  }, [rows, tab, query]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, confirmed: 0, refunded: 0, cancelled: 0 };
    rows.forEach((r) => {
      const s = String(r.status || "pending").toLowerCase();
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [rows]);

  const patchStatus = async (id, status) => {
    for (const ep of PATCH_ENDPOINTS) {
      try {
        const path = ep.length === 1 ? ep(id) : ep(id, status);
        if (path.endsWith("/status")) await api.patch(path, { status });
        else await api.post(path);
        return true;
      } catch {}
    }
    return false;
  };

  const doAction = async (row, status) => {
    const id = row.id || row._id || row.reference || row.ref || row.bookingId;
    if (!id) return notify("Missing booking identifier.", "error");

    setBusyId(id);
    const prev = rows.slice();
    setRows(rows.map((r) => ((r.id || r._id || r.reference || r.ref || r.bookingId) === id ? { ...r, status } : r)));

    const ok = await patchStatus(id, status);
    setBusyId(null);
    if (!ok) { setRows(prev); notify(`Failed to set ${status}.`, "error"); }
    else { notify(`Marked as ${status}.`, "success"); }
  };

  /* --------------------------- CSV export (filtered) --------------------------- */
  const exportCsv = () => {
    try {
      const header = ["id","date","guest","listing","nights","amount","status","ref","gateway"];
      const lines = [header.join(",")];
      filtered.forEach((b) => {
        const id = b.id || b._id || b.reference || b.ref || b.bookingId || "";
        const dateRaw = b.createdAt || b.date || b.created || b.timestamp || b.created_at;
        const date = dateRaw ? dayjs(dateRaw).format("YYYY-MM-DD HH:mm:ss") : "";
        const guest = b.guestEmail || b.email || b.guest || "";
        const listing = b.listingTitle || b.listing || b.title || b.property || "";
        const nights = b.nights || b.night || 1;
        const amount = b.amount || b.total || 0;
        const status = String(b.status || "pending").toLowerCase();
        const ref = b.reference || b.ref || id;
        const gateway = b.gateway || b.paymentGateway || "";
        const row = [id,date,guest,listing,nights,amount,status,ref,gateway]
          .map((v) => {
            const s = v == null ? "" : String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(",");
        lines.push(row);
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nesta-transactions-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify("Transactions CSV exported.", "success");
    } catch {
      notify("Export failed.", "error");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 28, margin: "6px 0 18px" }}>Admin</h1>

      <AdminHeader
        back
        title="Transactions"
        subtitle="Review and update booking payments"
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn small kind="gold" onClick={exportCsv}>Export CSV</LuxeBtn>
            <LuxeBtn small onClick={load}>{loading ? "Loading…" : "Refresh"}</LuxeBtn>
          </div>
        }
      />

      {/* Controls: tabs + search (no extra Refresh here) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto auto auto auto 1fr",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "pending", label: `Pending ${counts.pending}` },
          { k: "confirmed", label: `Confirmed ${counts.confirmed}` },
          { k: "refunded", label: `Refunded ${counts.refunded}` },
          { k: "cancelled", label: `Cancelled ${counts.cancelled}` },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: tab === t.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: tab === t.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email, title, reference..."
          style={{
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "#dfe3ea",
            padding: "0 12px",
            minWidth: 220,
          }}
        />
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 800,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Transactions
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["Date", "Guest", "Listing", "Nights", "Amount", "Status", "Ref", "Gateway", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ padding: 20, color: "#aeb6c2" }}>Loading…</td></tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 20, color: "#aeb6c2" }}>No results.</td></tr>
              )}

              {!loading && pageItems.map((b) => {
                const id = b.id || b._id || b.reference || b.ref || b.bookingId;
                const status = String(b.status || "pending").toLowerCase();
                const date = b.createdAt || b.date || b.created || b.timestamp || b.created_at;
                const gateway = b.gateway || b.paymentGateway || "-";
                const amount = b.amount || b.total || 0;
                const nights = b.nights || b.night || 1;
                const guest = b.guestEmail || b.email || b.guest || "-";
                const listing = b.listingTitle || b.listing || b.title || b.property || "-";
                const ref = b.reference || b.ref || id || "-";

                return (
                  <tr key={id || Math.random()}>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {date ? dayjs(date).format("YYYY-MM-DD, HH:mm") : "-"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{clip(guest, 18)}</td>
                    <td style={{ padding: "12px 16px" }}>{clip(listing, 26)}</td>
                    <td style={{ padding: "12px 16px" }}>{nights}</td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{money(amount)}</td>
                    <td style={{ padding: "12px 16px" }}><Chip label={status} tone={status} /></td>
                    <td style={{ padding: "12px 16px" }}>{clip(ref, 10)}</td>
                    <td style={{ padding: "12px 16px" }}>{clip(gateway, 10)}</td>
                    <td
                      style={{
                        padding: "8px 12px",
                        whiteSpace: "nowrap",
                        position: "sticky",
                        right: 0,
                        background: "rgba(0,0,0,.25)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10 }}>
                        <LuxeBtn kind="emerald" small disabled={busyId === id} onClick={() => doAction(b, "confirmed")}>Confirm</LuxeBtn>
                        <LuxeBtn kind="ruby" small disabled={busyId === id} onClick={() => doAction(b, "cancelled")}>Cancel</LuxeBtn>
                        <LuxeBtn kind="sky" small disabled={busyId === id} onClick={() => doAction(b, "refunded")}>Refund</LuxeBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ color: "#aeb6c2", fontSize: 13 }}>
            Showing {(total === 0 ? 0 : (page - 1) * perPage + 1)}–{Math.min(page * perPage, total)} of {total}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#e6e9ef", border: "1px solid rgba(255,255,255,.12)" }}
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#cfd3da", cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              Prev
            </button>
            <div style={{ width: 80, textAlign: "center", color: "#cfd3da" }}>
              Page {page} of {lastPage}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#cfd3da", cursor: page >= lastPage ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
