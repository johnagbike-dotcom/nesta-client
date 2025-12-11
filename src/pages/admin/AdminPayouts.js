// src/pages/admin/AdminPayouts.js
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(
    /\/$/,
    ""
  ),
  withCredentials: false,
  timeout: 15000,
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
  const [total, setTotal] = useState(0);

  /* ------------------------------- LOAD DATA ------------------------------ */
  const load = async () => {
    setLoading(true);
    try {
      // 1) Try the payouts ledger first
      const { data } = await api.get("/admin/payouts", {
        params: { tab, q: query, page, limit: perPage },
      });

      let list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      let totalCount = data?.total || list.length || 0;

      // 2) Fallback: if ledger is empty on "All" tab, derive from refunded bookings
      if ((!list || list.length === 0) && tab === "all") {
        try {
          const { data: bRes } = await api.get("/admin/bookings", {
            params: {
              status: "refunded", // only refunded bookings
              q: query,
              page,
              limit: perPage,
            },
          });

          const bList = Array.isArray(bRes?.data)
            ? bRes.data
            : Array.isArray(bRes?.items)
            ? bRes.items
            : Array.isArray(bRes)
            ? bRes
            : [];

          // Map each refunded booking into a "virtual" payout row
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
              Number(
                b.total ||
                  b.totalAmount ||
                  b.amountN ||
                  b.amount ||
                  0
              ) || 0;

            return {
              id: bookingId,
              date,
              payeeEmail: hostEmail,
              payeeType: "host",
              amount: gross, // show full booking amount; ledger split is a backend concern
              status: "pending", // as a payout waiting to be processed
              ref: `bo_${bookingId}`,
              _source: "bookings", // mark as derived from bookings (no ledger row yet)
            };
          });

          totalCount = bRes?.total || list.length || 0;
        } catch (err) {
          console.error("Fallback from /admin/bookings failed:", err);
          // If fallback fails, we just keep the (empty) payouts list
        }
      }

      setRows(list);
      setTotal(totalCount);
    } catch (e) {
      console.error("Failed to load payouts", e);
      tErr("Failed to load payouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query, page, perPage]);

  // server returns already-filtered data (or we derived it), keep "filtered" alias
  const filtered = rows;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  /* -------------------------- update payout status ------------------------- */
  const setStatus = async (row, status, note = "") => {
    const id = row.id || row._id;
    if (!id) return;

    // Virtual rows derived from bookings don't have a ledger entry yet
    if (row._source === "bookings") {
      tErr(
        "This row is derived from bookings only. A payouts ledger entry does not exist yet."
      );
      return;
    }

    setBusyId(id);
    const prev = rows.slice();
    setRows(
      rows.map((r) =>
        (r.id || r._id) === id ? { ...r, status } : r
      )
    );

    try {
      await api.patch(`/admin/payouts/${id}/status`, { status, note });
      tOk(`Marked ${status}.`);
    } catch {
      setRows(prev);
      tErr("Failed to update payout.");
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
      a.download = `payouts-${tab || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export payouts CSV", e);
      tErr("Failed to export CSV.");
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
          { k: "all", label: `All` },
          { k: "pending", label: `Pending` },
          { k: "processing", label: `Processing` },
          { k: "paid", label: `Paid` },
          { k: "failed", label: `Failed` },
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
                {["Date", "Payee", "Type", "Amount", "Status", "Ref", "Actions"].map(
                  (h) => (
                    <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  )
                )}
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

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((p) => {
                  const id = p.id || p._id;
                  const date =
                    p.date ||
                    p.createdAt ||
                    p.created ||
                    p.timestamp ||
                    p.created_at;
                  const payee = p.payeeEmail || p.payee || "-";
                  const type = p.payeeType || p.type || "-";
                  const amount = Number(p.amount || 0);
                  const status = String(p.status || "pending").toLowerCase();
                  const ref = p.ref || p.reference || "-";
                  const derived = p._source === "bookings";

                  return (
                    <tr key={id || Math.random()}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {date ? dayjs(date).format("YYYY-MM-DD, HH:mm") : "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{payee}</td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textTransform: "capitalize",
                        }}
                      >
                        {type}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
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
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,.10), rgba(0,0,0,.30))",
                          backdropFilter: "blur(2px)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn
                            kind="sky"
                            small
                            disabled={busyId === id || derived}
                            onClick={() => setStatus(p, "processing")}
                            title={
                              derived
                                ? "No payouts ledger entry yet"
                                : "Move to processing"
                            }
                          >
                            Process
                          </LuxeBtn>
                          <LuxeBtn
                            kind="emerald"
                            small
                            disabled={busyId === id || derived}
                            onClick={() => setStatus(p, "paid")}
                            title={
                              derived
                                ? "No payouts ledger entry yet"
                                : "Mark as paid"
                            }
                          >
                            Mark paid
                          </LuxeBtn>
                          <LuxeBtn
                            kind="ruby"
                            small
                            disabled={busyId === id || derived}
                            onClick={() => {
                              const note = window.prompt("Reason (optional)");
                              setStatus(p, "failed", note || "");
                            }}
                            title={
                              derived
                                ? "No payouts ledger entry yet"
                                : "Mark as failed"
                            }
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
            Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–
            {Math.min(page * perPage, total)} of {total}
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
