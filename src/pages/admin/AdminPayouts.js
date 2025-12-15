// src/pages/admin/AdminPayouts.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

// ✅ attach Firebase token to requests
import { getAuth } from "firebase/auth";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* --------------------------------- UI ---------------------------------- */
const statusTone = {
  pending: {
    bg: "rgba(148,163,184,.20)",
    text: "#e2e8f0",
    ring: "rgba(148,163,184,.35)",
  },
  processing: {
    bg: "rgba(59,130,246,.20)",
    text: "#dbeafe",
    ring: "rgba(59,130,246,.35)",
  },
  paid: {
    bg: "rgba(16,185,129,.22)",
    text: "#a7f3d0",
    ring: "rgba(16,185,129,.35)",
  },
  failed: {
    bg: "rgba(239,68,68,.20)",
    text: "#fecaca",
    ring: "rgba(239,68,68,.35)",
  },
};

const Chip = ({ label, tone = "pending" }) => {
  const c = statusTone[tone] || statusTone.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 96,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 800,
        fontSize: 12,
        textTransform: "capitalize",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
      }}
    >
      {label}
    </span>
  );
};

const money = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-NG", { style: "currency", currency: "NGN" })
    : String(n || 0);

function normalizeListShape(payload) {
  // Accept:
  // - { data: [...] }
  // - { items: [...] }
  // - [...] (direct)
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function safeId(row) {
  return row?.id || row?._id || row?.ref || row?.reference || null;
}

function safeDate(row) {
  return (
    row?.date ||
    row?.createdAt ||
    row?.created ||
    row?.timestamp ||
    row?.created_at ||
    row?.updatedAt ||
    null
  );
}

/* ------------------------------- component ------------------------------- */
export default function AdminPayouts() {
  const toast = useToast() || {};
  const tOk = (m) => (toast.success ? toast.success(m) : alert(m));
  const tErr = (m) => (toast.error ? toast.error(m) : alert(m));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [tab, setTab] = useState("all"); // all|pending|processing|paid|failed
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Backend currently returns payouts as { data: [...] } without pagination.
  // We'll paginate on the client consistently.
  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? rows.slice() : [];

    // If backend already filtered by tab/q, this will be mostly no-op.
    // But keep it for robustness if you later change backend.
    const kw = String(query || "").trim().toLowerCase();

    if (tab !== "all") {
      list = list.filter((r) => String(r.status || "pending").toLowerCase() === String(tab).toLowerCase());
    }

    if (kw) {
      list = list.filter((r) => {
        const email = String(r.payeeEmail || r.payee || "").toLowerCase();
        const ref = String(r.ref || r.reference || "").toLowerCase();
        return email.includes(kw) || ref.includes(kw);
      });
    }

    // newest first (date/createdAt/updatedAt)
    list.sort((a, b) => {
      const ta = safeDate(a) ? new Date(safeDate(a)).getTime() : 0;
      const tb = safeDate(b) ? new Date(safeDate(b)).getTime() : 0;
      return tb - ta;
    });

    return list;
  }, [rows, tab, query]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  /* ------------------------------- LOAD DATA ------------------------------ */
  const load = async () => {
    setLoading(true);
    try {
      // 1) Try payouts ledger
      const { data } = await api.get("/admin/payouts", {
        // backend supports tab/q (and returns all results)
        params: { tab, q: query },
      });

      let list = normalizeListShape(data);

      // 2) If ledger is empty on "All" tab, derive from refunded bookings
      if ((!list || list.length === 0) && tab === "all") {
        try {
          const { data: bRes } = await api.get("/admin/bookings", {
            params: {
              status: "refunded",
              q: query,
              page: 1,
              limit: 500,
            },
          });

          const bList = normalizeListShape(bRes);

          list = bList.map((b) => {
            const bookingId = b.id || b.bookingId || b.reference || b.ref;

            const date =
              b.updatedAt ||
              b.createdAt ||
              b.date ||
              b.created ||
              b.timestamp ||
              null;

            const hostEmail =
              b.hostEmail ||
              b.ownerEmail ||
              b.providerEmail ||
              b.payeeEmail ||
              b.listingOwner ||
              "-";

            const gross =
              Number(b.total || b.totalAmount || b.amountN || b.amount || 0) || 0;

            return {
              id: bookingId,
              date,
              payeeEmail: hostEmail,
              payeeType: "host",
              amount: gross,
              status: "pending",
              ref: `bo_${bookingId}`,
              _source: "bookings",
            };
          });
        } catch (err) {
          console.error("Fallback from /admin/bookings failed:", err);
        }
      }

      setRows(list);
      setPage(1);
    } catch (e) {
      console.error("Failed to load payouts", e);

      // Common admin failure = 401/403 due to role/token
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        tErr("Unauthorized. Make sure you are logged in as an admin and your users/{uid}.role is 'admin'.");
      } else {
        tErr("Failed to load payouts.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query]);

  // Reset page when perPage changes (or tab/query changes)
  useEffect(() => {
    setPage(1);
  }, [perPage, tab, query]);

  /* -------------------------- update payout status ------------------------- */
  const setStatus = async (row, status, note = "") => {
    const id = safeId(row);
    if (!id) return;

    // Virtual rows derived from bookings don't have a ledger entry yet
    if (row._source === "bookings") {
      tErr("This row is derived from bookings only. A payouts ledger entry does not exist yet.");
      return;
    }

    setBusyId(id);
    const prev = rows.slice();

    setRows(rows.map((r) => (safeId(r) === id ? { ...r, status } : r)));

    try {
      await api.patch(`/admin/payouts/${encodeURIComponent(id)}/status`, { status, note });
      tOk(`Marked ${status}.`);
    } catch (e) {
      console.error("Failed to update payout:", e);
      setRows(prev);

      const code = e?.response?.status;
      if (code === 401 || code === 403) {
        tErr("Unauthorized. Your admin token/role may be failing.");
      } else {
        tErr("Failed to update payout.");
      }
    } finally {
      setBusyId(null);
    }
  };

  /* ------------------------------- EXPORT CSV ------------------------------ */
  const exportCsv = async () => {
    try {
      const res = await api.get("/admin/payouts/export.csv", {
        params: { tab, q: query },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payouts-${tab || "all"}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      tOk("CSV exported.");
    } catch (e) {
      console.error("Failed to export payouts CSV", e);

      const code = e?.response?.status;
      if (code === 401 || code === 403) {
        tErr("Unauthorized. You may not have admin access.");
      } else {
        tErr("Failed to export CSV.");
      }
    }
  };

  /* ------------------------------ render ------------------------------- */
  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Payouts"
        subtitle="Track partner/host payouts and settlement status."
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn kind="gold" small onClick={exportCsv} title="Export payouts CSV">
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load} title="Refresh">
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,auto) 1fr auto",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {[
          { k: "all", label: "All" },
          { k: "pending", label: "Pending" },
          { k: "processing", label: "Processing" },
          { k: "paid", label: "Paid" },
          { k: "failed", label: "Failed" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => {
              setTab(t.k);
              setPage(1);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background:
                tab === t.k
                  ? "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)"
                  : "rgba(255,255,255,.06)",
              color: tab === t.k ? "#1b1608" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                tab === t.k
                  ? "0 10px 30px rgba(250,204,21,.20), inset 0 1px 0 rgba(255,255,255,.06)"
                  : "inset 0 1px 0 rgba(255,255,255,.04)",
            }}
          >
            {t.label}
          </button>
        ))}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search email or ref…"
          style={{
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "#dfe3ea",
            padding: "0 12px",
            minWidth: 260,
          }}
        />

        <div />{/* layout spacer */}
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background:
            "radial-gradient(1200px 600px at 0% -10%, rgba(250,204,21,.04), transparent 40%), rgba(0,0,0,.25)",
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
          Payouts
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 980,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "rgba(255,255,255,.02)",
                  color: "#aeb6c2",
                  textAlign: "left",
                }}
              >
                {["Date", "Payee", "Type", "Amount", "Status", "Ref", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((p) => {
                  const id = safeId(p) || `row_${Math.random().toString(16).slice(2)}`;
                  const date = safeDate(p);
                  const payee = p.payeeEmail || p.payee || "-";
                  const type = p.payeeType || p.type || "-";
                  const amount = Number(p.amountN ?? p.amount ?? 0);
                  const status = String(p.status || "pending").toLowerCase();
                  const ref = p.ref || p.reference || "-";
                  const derived = p._source === "bookings";

                  return (
                    <tr key={id}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {date ? dayjs(date).format("YYYY-MM-DD, HH:mm") : "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{payee}</td>
                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{type}</td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontWeight: 800 }}>
                        {money(amount)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Chip label={status} tone={status} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>{ref}</td>
                      <td
                        style={{
                          padding: "8px 12px",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          right: 0,
                          background: "linear-gradient(90deg, rgba(0,0,0,.10), rgba(0,0,0,.30))",
                          backdropFilter: "blur(2px)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn
                            kind="sky"
                            small
                            disabled={busyId === safeId(p) || derived}
                            onClick={() => setStatus(p, "processing")}
                            title={derived ? "No payouts ledger entry yet" : "Move to processing"}
                          >
                            Process
                          </LuxeBtn>
                          <LuxeBtn
                            kind="emerald"
                            small
                            disabled={busyId === safeId(p) || derived}
                            onClick={() => setStatus(p, "paid")}
                            title={derived ? "No payouts ledger entry yet" : "Mark as paid"}
                          >
                            Mark paid
                          </LuxeBtn>
                          <LuxeBtn
                            kind="ruby"
                            small
                            disabled={busyId === safeId(p) || derived}
                            onClick={() => {
                              const note = window.prompt("Reason (optional)");
                              setStatus(p, "failed", note || "");
                            }}
                            title={derived ? "No payouts ledger entry yet" : "Mark as failed"}
                          >
                            Fail
                          </LuxeBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
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

            <div style={{ width: 80, textAlign: "center", color: "#cfd3da" }}>
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
