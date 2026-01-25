// src/pages/admin/AdminPayouts.js
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
  withCredentials: false,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* --------------------------------- UI ---------------------------------- */
const statusTone = {
  pending: { bg: "rgba(148,163,184,.20)", text: "#e2e8f0", ring: "rgba(148,163,184,.35)" },
  processing: { bg: "rgba(59,130,246,.20)", text: "#dbeafe", ring: "rgba(59,130,246,.35)" },
  paid: { bg: "rgba(16,185,129,.18)", text: "#d1fae5", ring: "rgba(16,185,129,.35)" },
  failed: { bg: "rgba(239,68,68,.18)", text: "#fecaca", ring: "rgba(239,68,68,.35)" },
};

const Chip = ({ label, tone = "pending" }) => {
  const t = statusTone[tone] || statusTone.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 110,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        fontWeight: 900,
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
  Number(n || 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });

function normalizeListShape(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows; // backend returns { ok, rows }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function safeDate(row) {
  const v = row?.createdAt || row?.updatedAt || row?.date || null;
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ------------------------------- component ------------------------------- */
export default function AdminPayouts() {
  const toast = useToast() || {};
  const tOk = (m) => (toast.success ? toast.success(m) : alert(m));
  const tErr = (m) => (toast.error ? toast.error(m) : alert(m));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // ✅ backend supports: all | pending | processing | paid | failed
  const [tab, setTab] = useState("pending");
  const [queryStr, setQueryStr] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? rows.slice() : [];
    const q = String(queryStr || "").trim().toLowerCase();

    if (q) {
      list = list.filter((r) => {
        const uid = String(r.uid || "").toLowerCase();
        const role = String(r.role || "").toLowerCase();
        const status = String(r.status || "").toLowerCase();
        const note = String(r.note || "").toLowerCase();
        const bankCode = String(r.bankCode || "").toLowerCase();
        const acct = String(r.accountNumberMasked || "").toLowerCase();
        return (
          uid.includes(q) ||
          role.includes(q) ||
          status.includes(q) ||
          note.includes(q) ||
          bankCode.includes(q) ||
          acct.includes(q)
        );
      });
    }

    list.sort((a, b) => {
      const ta = safeDate(a) ? safeDate(a).getTime() : 0;
      const tb = safeDate(b) ? safeDate(b).getTime() : 0;
      return tb - ta;
    });

    return list;
  }, [rows, queryStr]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/payouts", {
        params: { status: tab, q: "" }, // backend supports q but we filter client-side too
      });
      setRows(normalizeListShape(data));
      setPage(1);
    } catch (e) {
      console.error("Failed to load payout_requests", e);
      const code = e?.response?.status;
      if (code === 401 || code === 403) {
        tErr("Unauthorized. Log in as admin (users/{uid}.role='admin' or isAdmin=true).");
      } else {
        tErr(e?.response?.data?.error || "Failed to load payout requests.");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => setPage(1), [perPage, tab, queryStr]);

  const updateStatus = async (row, nextStatus) => {
    const id = row?.id;
    if (!id) return;

    let note = "";
    if (nextStatus === "failed") {
      note = window.prompt("Reason / note (recommended)") || "";
    }

    setBusyId(id);
    try {
      await api.patch(`/admin/payouts/${encodeURIComponent(id)}/status`, {
        status: nextStatus,
        note,
      });
      tOk(`Updated to ${nextStatus}.`);
      await load();
    } catch (e) {
      console.error("Status update failed", e);
      tErr(e?.response?.data?.error || "Update failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Payout requests"
        subtitle="Move payouts: pending → processing → paid (or failed to release funds)."
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
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
          gridTemplateColumns: "repeat(5,auto) 1fr",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {[
          { k: "pending", label: "Pending" },
          { k: "processing", label: "Processing" },
          { k: "paid", label: "Paid" },
          { k: "failed", label: "Failed" },
          { k: "all", label: "All" },
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
            }}
          >
            {t.label}
          </button>
        ))}

        <input
          value={queryStr}
          onChange={(e) => setQueryStr(e.target.value)}
          placeholder="Search uid/role/status/bank/last4/note…"
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
      </div>

      {/* Table */}
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
            fontWeight: 900,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Withdrawal requests
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1150 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["Date", "UID", "Role", "Amount", "Bank", "Account", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((p) => {
                  const id = p.id;
                  const date = safeDate(p);
                  const role = p.role || "-";
                  const amount = Number(p.amount || 0);
                  const status = String(p.status || "pending").toLowerCase();

                  return (
                    <tr key={id}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {date ? dayjs(date).format("YYYY-MM-DD, HH:mm") : "-"}
                      </td>

                      <td style={{ padding: "12px 16px" }}>{p.uid || "-"}</td>

                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{role}</td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontWeight: 900 }}>
                        {money(amount)}
                      </td>

                      <td style={{ padding: "12px 16px" }}>{p.bankCode || p.bankName || "-"}</td>

                      <td style={{ padding: "12px 16px" }}>{p.accountNumberMasked || "-"}</td>

                      <td style={{ padding: "12px 16px" }}>
                        <Chip label={status} tone={status} />
                      </td>

                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn
                            small
                            kind="slate"
                            disabled={busyId === id || !(status === "pending")}
                            onClick={() => updateStatus(p, "processing")}
                          >
                            Mark processing
                          </LuxeBtn>

                          <LuxeBtn
                            small
                            kind="emerald"
                            disabled={busyId === id || !(status === "pending" || status === "processing")}
                            onClick={() => updateStatus(p, "paid")}
                          >
                            Mark paid
                          </LuxeBtn>

                          <LuxeBtn
                            small
                            kind="ruby"
                            disabled={busyId === id || !(status === "pending" || status === "processing")}
                            onClick={() => updateStatus(p, "failed")}
                          >
                            Mark failed
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
              onChange={(e) => setPerPage(Number(e.target.value))}
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
