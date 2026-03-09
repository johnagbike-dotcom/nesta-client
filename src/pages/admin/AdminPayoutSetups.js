// src/pages/admin/AdminPayoutSetups.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";
import { getAuth } from "firebase/auth";

/* ------------------------------ axios base ------------------------------ */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
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

/* -------------------------------- helpers ------------------------------- */
function safeLower(v) {
  return String(v ?? "").trim().toLowerCase();
}
function safeUpper(v) {
  return String(v ?? "").trim().toUpperCase();
}
function safeStr(v) {
  return String(v ?? "").trim();
}
function extractError(e, fallback = "Something went wrong.") {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}
function safeDateIso(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function arrayify(v) {
  return Array.isArray(v) ? v : [];
}

const statusTone = {
  PENDING_REVIEW: {
    bg: "rgba(148,163,184,.20)",
    text: "#e2e8f0",
    ring: "rgba(148,163,184,.35)",
  },
  VERIFIED: {
    bg: "rgba(16,185,129,.18)",
    text: "#d1fae5",
    ring: "rgba(16,185,129,.35)",
  },
  REJECTED: {
    bg: "rgba(239,68,68,.18)",
    text: "#fecaca",
    ring: "rgba(239,68,68,.35)",
  },
  READY: {
    bg: "rgba(16,185,129,.18)",
    text: "#d1fae5",
    ring: "rgba(16,185,129,.35)",
  },
  PARTIAL_ERROR: {
    bg: "rgba(245,158,11,.18)",
    text: "#fde68a",
    ring: "rgba(245,158,11,.35)",
  },
  INACTIVE: {
    bg: "rgba(120,120,120,.18)",
    text: "#e5e7eb",
    ring: "rgba(120,120,120,.35)",
  },
  ALL: {
    bg: "rgba(255,255,255,.06)",
    text: "#e6e9ef",
    ring: "rgba(255,255,255,.12)",
  },
};

const Chip = ({ label, tone }) => {
  const t = safeUpper(tone || label || "ALL");
  const c = statusTone[t] || statusTone.PENDING_REVIEW;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 128,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 900,
        fontSize: 12,
        textTransform: "capitalize",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
      }}
    >
      {String(label || "").replace(/_/g, " ").toLowerCase()}
    </span>
  );
};

function normalizeListShape(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function monoText(text) {
  return {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    color: "rgba(255,255,255,.82)",
    wordBreak: "break-all",
  };
}

/* ------------------------------- modal ------------------------------- */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(10,12,16,.96)",
          boxShadow: "0 30px 90px rgba(0,0,0,.6)",
          overflow: "hidden",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 10,
              padding: "6px 10px",
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.06)",
              color: "#e6e9ef",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- component ------------------------------ */
export default function AdminPayoutSetups() {
  const toast = useToast() || {};
  const tOk = (m) => (toast.success ? toast.success(m) : alert(m));
  const tErr = (m) => (toast.error ? toast.error(m) : alert(m));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState(null);

  const [tab, setTab] = useState("PENDING_REVIEW");
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewUid, setViewUid] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveResult, setResolveResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/payout-setups", {
        params: {
          status: tab,
          q: String(query || "").trim() || undefined,
        },
      });
      setRows(normalizeListShape(data));
      setPage(1);
    } catch (e) {
      console.error("Failed to load payout setups", e);
      const code = e?.response?.status;
      if (code === 401 || code === 403) tErr("Unauthorized. Log in as admin.");
      else tErr(extractError(e, "Failed to load payout setups."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [perPage, tab, query]);

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") load();
  };

  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? rows.slice() : [];
    const kw = String(query || "").trim().toLowerCase();

    if (kw) {
      list = list.filter((r) => {
        const uid = safeLower(r.uid);
        const role = safeLower(r.role);
        const kyc = safeLower(r.kycStatus);
        const ps = safeLower(r.payoutStatus);
        const bank = safeLower(r.bankName);
        const code = safeLower(r.bankCode);
        const acct = safeLower(r.accountNumberMasked);
        const note = safeLower(r.note);
        const name = safeLower(r.accountName);

        const paystackCode = safeLower(r.paystackSubaccountCode);
        const flwCollection = safeLower(r.flutterwaveCollectionSubaccountId);
        const flwPayout = safeLower(r.flutterwavePayoutSubaccountRef);
        const provisioningStatus = safeLower(r.provisioningStatus);
        const providerErrors = arrayify(r.provisioningErrors).join(" ").toLowerCase();

        return (
          uid.includes(kw) ||
          role.includes(kw) ||
          kyc.includes(kw) ||
          ps.includes(kw) ||
          bank.includes(kw) ||
          code.includes(kw) ||
          acct.includes(kw) ||
          note.includes(kw) ||
          name.includes(kw) ||
          paystackCode.includes(kw) ||
          flwCollection.includes(kw) ||
          flwPayout.includes(kw) ||
          provisioningStatus.includes(kw) ||
          providerErrors.includes(kw)
        );
      });
    }

    list.sort((a, b) => {
      const ta = safeDateIso(a.updatedAt) ? safeDateIso(a.updatedAt).getTime() : 0;
      const tb = safeDateIso(b.updatedAt) ? safeDateIso(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    return list;
  }, [rows, query]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const openView = async (uid) => {
    if (!uid) return;

    setViewOpen(true);
    setViewUid(uid);
    setViewData(null);
    setResolveResult(null);
    setViewLoading(true);

    try {
      const { data } = await api.get(`/admin/payout-setups/${encodeURIComponent(uid)}`);
      setViewData(data);
    } catch (e) {
      tErr(extractError(e, "Failed to load payout details."));
      setViewData(null);
    } finally {
      setViewLoading(false);
    }
  };

  const patchStatus = async (uid, nextStatus) => {
    if (!uid) return;

    const status = safeUpper(nextStatus);
    if (!["VERIFIED", "REJECTED"].includes(status)) return;

    const note =
      status === "REJECTED"
        ? window.prompt("Reason (optional). Keep it professional for audit.") || ""
        : "";

    setBusyUid(uid);

    try {
      const { data } = await api.patch(
        `/admin/payout-setups/${encodeURIComponent(uid)}/status`,
        { status, note }
      );

      if (data?.ok) {
        if (data?.warning) {
          tOk(data.warning);
        } else {
          tOk(status === "VERIFIED" ? "Payout method verified." : "Payout method rejected.");
        }

        await load();

        if (viewUid === uid && viewOpen) {
          await openView(uid);
        }
      } else {
        tErr(data?.error || "Update failed.");
      }
    } catch (e) {
      console.error("Update payout setup status failed", e);
      tErr(extractError(e, "Update failed."));
    } finally {
      setBusyUid(null);
    }
  };

  const validateAccount = async () => {
    const payout = viewData?.payout || {};
    const bankCode = String(payout.bankCode || "").trim();
    const accountNumber = String(payout.accountNumber || "").trim();

    if (!bankCode || !accountNumber) {
      tErr("Missing bank code or account number for validation.");
      return;
    }

    setResolveLoading(true);
    setResolveResult(null);

    try {
      const { data } = await api.post("/banks/resolve", {
        country: "NG",
        bankCode,
        accountNumber,
      });

      if (data?.ok) {
        setResolveResult({
          ok: true,
          accountName: data.accountName,
          provider: data.provider,
        });
        tOk(`Validated: ${data.accountName}`);
      } else {
        setResolveResult({
          ok: false,
          message: data?.message || "Validation failed.",
        });
        tErr(data?.message || "Validation failed.");
      }
    } catch (e) {
      const msg = extractError(e, "Validation failed.");
      setResolveResult({ ok: false, message: msg });
      tErr(msg);
    } finally {
      setResolveLoading(false);
    }
  };

  const tabs = [
    { k: "PENDING_REVIEW", label: "Pending review" },
    { k: "VERIFIED", label: "Verified" },
    { k: "REJECTED", label: "Rejected" },
    { k: "ALL", label: "All" },
  ];

  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Payout Setup Verification"
        subtitle="Verify payout accounts (BVN + bank) before withdrawals are unlocked."
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn small onClick={load} title="Refresh">
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,auto) 1fr auto",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {tabs.map((t) => (
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
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search uid/role/kyc/bank/code/last4/subaccounts/status… (Enter)"
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

        <LuxeBtn small onClick={load} title="Search">
          Search
        </LuxeBtn>
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
            fontWeight: 900,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>Payout setups</div>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>
            {loading ? "Loading…" : `Showing ${total} result${total === 1 ? "" : "s"}`}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 1720,
            }}
          >
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {[
                  "Updated",
                  "UID",
                  "Role",
                  "KYC",
                  "Bank",
                  "Code",
                  "Account",
                  "BVN",
                  "Payout Status",
                  "Provisioning",
                  "Paystack",
                  "Flutterwave",
                  "Note",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((p) => {
                  const uid = p.uid;
                  const updated = safeDateIso(p.updatedAt);
                  const payoutStatus = safeUpper(p.payoutStatus || "PENDING_REVIEW");
                  const provisioningStatus = safeUpper(p.provisioningStatus || "INACTIVE");
                  const isBusy = busyUid === uid;
                  const canAct = payoutStatus === "PENDING_REVIEW";

                  return (
                    <tr key={uid} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {updated ? dayjs(updated).format("YYYY-MM-DD, HH:mm") : "—"}
                      </td>

                      <td style={{ padding: "12px 16px", ...monoText(uid || "—") }}>
                        {uid || "—"}
                      </td>

                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                        {p.role || "—"}
                      </td>

                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                        {p.kycStatus || "—"}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800, color: "rgba(255,255,255,.9)" }}>
                          {p.bankName || "—"}
                        </div>
                        {p.accountName ? (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                            {p.accountName}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.75)" }}>
                        {p.bankCode || "—"}
                      </td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "rgba(255,255,255,.75)" }}>
                        {p.accountNumberMasked || "—"}
                      </td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "rgba(255,255,255,.75)" }}>
                        {p.bvnMasked || "—"}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <Chip label={payoutStatus} tone={payoutStatus} />
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <Chip label={provisioningStatus} tone={provisioningStatus} />
                        {arrayify(p.provisioningErrors).length > 0 ? (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 11,
                              color: "rgba(245,158,11,.95)",
                              maxWidth: 220,
                              whiteSpace: "normal",
                              lineHeight: 1.35,
                            }}
                            title={arrayify(p.provisioningErrors).join("\n")}
                          >
                            {arrayify(p.provisioningErrors)[0]}
                            {arrayify(p.provisioningErrors).length > 1
                              ? ` (+${arrayify(p.provisioningErrors).length - 1} more)`
                              : ""}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ ...monoText(p.paystackSubaccountCode || "—"), maxWidth: 180 }}>
                          {p.paystackSubaccountCode || "—"}
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ ...monoText(p.flutterwaveCollectionSubaccountId || "—"), maxWidth: 180 }}>
                          {p.flutterwaveCollectionSubaccountId || "—"}
                        </div>
                        {p.flutterwavePayoutSubaccountRef ? (
                          <div
                            style={{
                              ...monoText(p.flutterwavePayoutSubaccountRef),
                              maxWidth: 180,
                              marginTop: 6,
                              color: "rgba(255,255,255,.62)",
                            }}
                          >
                            payout: {p.flutterwavePayoutSubaccountRef}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.65)", maxWidth: 260 }}>
                        <div
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={p.note || ""}
                        >
                          {p.note || "—"}
                        </div>
                      </td>

                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn small onClick={() => openView(uid)} title="View payout details">
                            View
                          </LuxeBtn>

                          <LuxeBtn
                            small
                            kind="emerald"
                            disabled={isBusy || !canAct}
                            onClick={() => patchStatus(uid, "VERIFIED")}
                            title={!canAct ? "Only pending review can be verified" : "Verify payout method"}
                          >
                            {isBusy && busyUid === uid ? "Working…" : "Verify"}
                          </LuxeBtn>

                          <LuxeBtn
                            small
                            kind="ruby"
                            disabled={isBusy || !canAct}
                            onClick={() => patchStatus(uid, "REJECTED")}
                            title={!canAct ? "Only pending review can be rejected" : "Reject payout method"}
                          >
                            {isBusy && busyUid === uid ? "Working…" : "Reject"}
                          </LuxeBtn>
                        </div>

                        {!canAct ? (
                          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,.45)" }}>
                            This record is {String(payoutStatus).toLowerCase().replace(/_/g, " ")}.
                          </div>
                        ) : null}
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

            <div style={{ width: 88, textAlign: "center", color: "#cfd3da" }}>
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

      <div style={{ marginTop: 10, color: "rgba(255,255,255,.45)", fontSize: 12 }}>
        Luxury best-practice: verify payout destination before enabling withdrawals to reduce fraud and protect brand trust.
      </div>

      <Modal
        open={viewOpen}
        title={`Payout details — ${viewUid || ""}`}
        onClose={() => {
          setViewOpen(false);
          setViewUid(null);
          setViewData(null);
          setResolveResult(null);
        }}
      >
        {viewLoading ? (
          <div style={{ color: "rgba(255,255,255,.7)" }}>Loading…</div>
        ) : !viewData?.ok ? (
          <div style={{ color: "rgba(255,255,255,.7)" }}>No data.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".14em" }}>
                  Role / KYC
                </div>
                <div style={{ fontWeight: 900, marginTop: 6 }}>
                  {viewData.role || "—"} • {viewData.kycStatus || "—"}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".14em" }}>
                  Payout status
                </div>
                <div style={{ marginTop: 6 }}>
                  <Chip
                    label={safeUpper(viewData.payoutStatus || "PENDING_REVIEW")}
                    tone={safeUpper(viewData.payoutStatus || "PENDING_REVIEW")}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".14em" }}>
                  Provisioning
                </div>
                <div style={{ marginTop: 6 }}>
                  <Chip
                    label={safeUpper(viewData.paymentProfiles?.provisioningStatus || "INACTIVE")}
                    tone={safeUpper(viewData.paymentProfiles?.provisioningStatus || "INACTIVE")}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".14em" }}>
                Bank details
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Bank</div>
                  <div style={{ fontWeight: 900 }}>{viewData.payout?.bankName || "—"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Bank code</div>
                  <div style={{ fontWeight: 900 }}>{viewData.payout?.bankCode || "—"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Account number</div>
                  <div style={{ fontWeight: 900 }}>{viewData.payout?.accountNumber || "—"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Account name</div>
                  <div style={{ fontWeight: 900 }}>{viewData.payout?.accountName || "—"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>BVN</div>
                  <div style={{ fontWeight: 900 }}>{viewData.payout?.bvnMasked || "—"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Updated</div>
                  <div style={{ fontWeight: 900 }}>
                    {viewData.payout?.updatedAt
                      ? dayjs(viewData.payout.updatedAt).format("YYYY-MM-DD HH:mm")
                      : "—"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <LuxeBtn small onClick={validateAccount} disabled={resolveLoading}>
                  {resolveLoading ? "Validating…" : "Validate account"}
                </LuxeBtn>

                {safeUpper(viewData.payoutStatus || "") === "PENDING_REVIEW" ? (
                  <>
                    <LuxeBtn small kind="emerald" onClick={() => patchStatus(viewUid, "VERIFIED")}>
                      Verify
                    </LuxeBtn>
                    <LuxeBtn small kind="ruby" onClick={() => patchStatus(viewUid, "REJECTED")}>
                      Reject
                    </LuxeBtn>
                  </>
                ) : null}
              </div>

              {resolveResult ? (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: resolveResult.ok
                      ? "rgba(16,185,129,.95)"
                      : "rgba(239,68,68,.95)",
                  }}
                >
                  {resolveResult.ok
                    ? `✓ Validated via ${resolveResult.provider}: ${resolveResult.accountName}`
                    : `✕ Validation failed: ${resolveResult.message}`}
                </div>
              ) : null}
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".14em" }}>
                Provider profiles
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "rgba(255,255,255,.03)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>Paystack</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Subaccount code</div>
                  <div style={{ ...monoText(viewData.paymentProfiles?.paystack?.subaccountCode || "—"), marginTop: 4 }}>
                    {viewData.paymentProfiles?.paystack?.subaccountCode || "—"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>Status</div>
                  <div style={{ marginTop: 4 }}>
                    <Chip
                      label={safeUpper(viewData.paymentProfiles?.paystack?.status || "INACTIVE")}
                      tone={safeUpper(viewData.paymentProfiles?.paystack?.status || "INACTIVE")}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "rgba(255,255,255,.03)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>Flutterwave</div>

                  <div style={{ fontSize: 12, opacity: 0.65 }}>Collection subaccount ID</div>
                  <div
                    style={{
                      ...monoText(viewData.paymentProfiles?.flutterwave?.collectionSubaccountId || "—"),
                      marginTop: 4,
                    }}
                  >
                    {viewData.paymentProfiles?.flutterwave?.collectionSubaccountId || "—"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>Payout reference</div>
                  <div
                    style={{
                      ...monoText(viewData.paymentProfiles?.flutterwave?.payoutSubaccountRef || "—"),
                      marginTop: 4,
                    }}
                  >
                    {viewData.paymentProfiles?.flutterwave?.payoutSubaccountRef || "—"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>Status</div>
                  <div style={{ marginTop: 4 }}>
                    <Chip
                      label={safeUpper(viewData.paymentProfiles?.flutterwave?.status || "INACTIVE")}
                      tone={safeUpper(viewData.paymentProfiles?.flutterwave?.status || "INACTIVE")}
                    />
                  </div>
                </div>
              </div>

              {arrayify(viewData.paymentProfiles?.provisioningErrors).length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(245,158,11,.25)",
                    background: "rgba(245,158,11,.08)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#fde68a", marginBottom: 8 }}>
                    Provisioning errors
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {arrayify(viewData.paymentProfiles?.provisioningErrors).map((err, i) => (
                      <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,.82)" }}>
                        • {safeStr(err)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}