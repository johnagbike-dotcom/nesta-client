// src/pages/admin/Transactions.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";
import { getAuth } from "firebase/auth";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 15000,
});

// Attach Firebase ID token automatically (works with requireAdmin middleware)
api.interceptors.request.use(async (config) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return config;
});

/* ------------------------------- helpers -------------------------------- */
function safeDate(value) {
  if (!value) return null;

  // Firestore Timestamp-like
  if (typeof value === "object" && typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d?.getTime?.()) ? null : d;
  }

  // Timestamp-like {seconds, nanoseconds}
  if (typeof value === "object" && typeof value.seconds === "number") {
    const ms = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Epoch ms
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO/string
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function getArrayFrom(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.bookings)) return data.bookings;
  if (Array.isArray(data.transactions)) return data.transactions;
  return [];
}

const money = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("en-NG", { style: "currency", currency: "NGN" });
};

const clip = (s, n = 20) =>
  s ? (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s)) : "";

/* ------------------------------- chips ---------------------------------- */
const statusColor = {
  confirmed: { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  cancelled: { bg: "#cf2336", text: "#ffe9ec", ring: "#a51a2a" },
  refunded: { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
  pending: { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },
};

const Chip = ({ label, tone = "pending" }) => {
  const c = statusColor[tone] || statusColor.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 96,
        height: 34,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 800,
        fontSize: 13,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)",
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
  const [tab, setTab] = useState("all"); // all|pending|confirmed|refunded|cancelled

  // client-side paging (since /api/bookings returns an array)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const toast = useToast();
  const notify = (msg, type = "success") => {
    if (toast?.show) return toast.show(msg, type);
    if (type === "error" && toast?.error) return toast.error(msg);
    if (type === "success" && toast?.success) return toast.success(msg);
    alert(msg);
  };

  /* ------------------------------- load -------------------------------- */
  const load = async () => {
    setLoading(true);
    try {
      // bookings route returns an array (per your routes/bookings.js)
      const res = await api.get("/bookings");
      const arr = getArrayFrom(res.data);

      // normalise a bit for UI safety
      const mapped = (Array.isArray(arr) ? arr : []).map((b) => ({
        ...b,
        status: String(b.status || "pending").toLowerCase(),
      }));

      setRows(mapped);
      setPage(1);
    } catch (e) {
      console.error("Transactions load failed:", e?.response?.data || e.message);
      notify("Failed to load transactions.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- filtering ----------------------------- */
  const filtered = useMemo(() => {
    let list = rows.slice();

    if (tab !== "all") {
      list = list.filter((b) => String(b.status || "pending").toLowerCase() === tab);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const email = (b.guestEmail || b.email || b.guest || "").toLowerCase();
        const title = (b.listingTitle || b.listing || b.title || b.property || "").toLowerCase();
        const ref = (b.reference || b.ref || b.id || b.bookingId || "").toLowerCase();
        return email.includes(q) || title.includes(q) || ref.includes(q);
      });
    }

    // newest first by updatedAt/createdAt
    list.sort((a, b) => {
      const ad =
        safeDate(a.updatedAt) ||
        safeDate(a.createdAt) ||
        safeDate(a.created) ||
        safeDate(a.timestamp) ||
        safeDate(a.created_at) ||
        safeDate(a.date);
      const bd =
        safeDate(b.updatedAt) ||
        safeDate(b.createdAt) ||
        safeDate(b.created) ||
        safeDate(b.timestamp) ||
        safeDate(b.created_at) ||
        safeDate(b.date);
      return (bd ? +bd : 0) - (ad ? +ad : 0);
    });

    return list;
  }, [rows, tab, query]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const counts = useMemo(() => {
    const c = { all: filtered.length, pending: 0, confirmed: 0, refunded: 0, cancelled: 0 };
    filtered.forEach((r) => {
      const s = String(r.status || "pending").toLowerCase();
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [filtered]);

  /* ---------------------------- update status ---------------------------- */
  const patchStatus = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      return true;
    } catch (e) {
      console.error("patchStatus failed:", e?.response?.data || e.message);
      return false;
    }
  };

  const doAction = async (row, status) => {
    const id = row.id || row._id || row.bookingId || row.reference || row.ref;
    if (!id) return notify("Missing booking identifier.", "error");

    setBusyId(id);

    const prev = rows.slice();
    setRows((cur) =>
      cur.map((r) => {
        const rid = r.id || r._id || r.bookingId || r.reference || r.ref;
        return rid === id ? { ...r, status } : r;
      })
    );

    const ok = await patchStatus(id, status);
    setBusyId(null);

    if (!ok) {
      setRows(prev);
      notify(`Failed to set ${status}.`, "error");
    } else {
      notify(`Marked as ${status}.`, "success");
    }
  };

  /* --------------------------- CSV export (filtered) -------------------------- */
  const exportCsv = () => {
    try {
      const header = ["id", "date", "guest", "listing", "nights", "amount", "status", "ref", "gateway"];
      const lines = [header.join(",")];

      filtered.forEach((b) => {
        const id = b.id || b._id || b.bookingId || b.reference || b.ref || "";
        const dateRaw =
          b.updatedAt ||
          b.createdAt ||
          b.created ||
          b.timestamp ||
          b.created_at ||
          b.date;
        const parsed = safeDate(dateRaw);
        const date = parsed ? dayjs(parsed).format("YYYY-MM-DD HH:mm:ss") : "";

        const guest = b.guestEmail || b.email || b.guest || "";
        const listing = b.listingTitle || b.listing || b.title || b.property || "";
        const nights = b.nights || b.night || 1;
        const amount = Number(b.amount ?? b.total ?? b.amountN ?? 0);
        const status = String(b.status || "pending").toLowerCase();
        const ref = b.reference || b.ref || id;
        const gateway = b.gateway || b.paymentGateway || b.provider || "";

        const rowLine = [id, date, guest, listing, nights, amount, status, ref, gateway]
          .map((v) => {
            const s = v == null ? "" : String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",");

        lines.push(rowLine);
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
    } catch (e) {
      console.error("exportCsv failed:", e);
      notify("Export failed.", "error");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Transactions"
        subtitle="Review and update booking payments"
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn small kind="gold" onClick={exportCsv}>
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load}>
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Controls: tabs + search */}
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
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => {
              setTab(x.k);
              setPage(1);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: tab === x.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: tab === x.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {x.label}
          </button>
        ))}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
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
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((b) => {
                  const id = b.id || b._id || b.bookingId || b.reference || b.ref;

                  const status = String(b.status || "pending").toLowerCase();

                  const dateRaw =
                    b.updatedAt ||
                    b.createdAt ||
                    b.created ||
                    b.timestamp ||
                    b.created_at ||
                    b.date;

                  const parsedDate = safeDate(dateRaw);

                  const gateway = b.gateway || b.paymentGateway || b.provider || "-";
                  const amount = Number(b.amount ?? b.total ?? b.amountN ?? 0);
                  const nights = b.nights || b.night || 1;
                  const guest = b.guestEmail || b.email || b.guest || "-";
                  const listing = b.listingTitle || b.listing || b.title || b.property || "-";
                  const ref = b.reference || b.ref || id || "-";

                  return (
                    <tr key={id || `${ref}_${Math.random()}`}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {parsedDate ? dayjs(parsedDate).format("YYYY-MM-DD, HH:mm") : "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{clip(guest, 18)}</td>
                      <td style={{ padding: "12px 16px" }}>{clip(listing, 26)}</td>
                      <td style={{ padding: "12px 16px" }}>{nights}</td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{money(amount)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <Chip label={status} tone={status} />
                      </td>
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
                          <LuxeBtn kind="emerald" small disabled={busyId === id} onClick={() => doAction(b, "confirmed")}>
                            Confirm
                          </LuxeBtn>
                          <LuxeBtn kind="ruby" small disabled={busyId === id} onClick={() => doAction(b, "cancelled")}>
                            Cancel
                          </LuxeBtn>
                          <LuxeBtn kind="sky" small disabled={busyId === id} onClick={() => doAction(b, "refunded")}>
                            Refund
                          </LuxeBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
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
            Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              style={{
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,.06)",
                color: "#e6e9ef",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                color: "#cfd3da",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.6 : 1,
              }}
            >
              Prev
            </button>

            <div style={{ width: 90, textAlign: "center", color: "#cfd3da" }}>
              Page {page} of {lastPage}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                color: "#cfd3da",
                cursor: page >= lastPage ? "not-allowed" : "pointer",
                opacity: page >= lastPage ? 0.6 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
