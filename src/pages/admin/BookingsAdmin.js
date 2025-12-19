// src/pages/admin/BookingsAdmin.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import AdminLayout from "../../layouts/AdminLayout";

// Firestore helpers (for resolving chat UIDs)
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  limit as fsLimit,
} from "firebase/firestore";

// ✅ attach Firebase token to requests
import { getAuth } from "firebase/auth";

/* axios base */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(
    /\/$/,
    ""
  ),
  timeout: 20000,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* helpers */
const safeLower = (v) => String(v || "").trim().toLowerCase();

const money = (n) => {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return "₦0";
  return num.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
};

function errMsg(e) {
  const status = e?.response?.status;
  const apiMsg = e?.response?.data?.error || e?.response?.data?.message;
  const txt = apiMsg || e?.message || "Request failed";
  return status ? `${status}: ${txt}` : txt;
}

/**
 * Stronger status normalization:
 * - Trusts booking.status if present
 * - ALSO detects "paid/success" from common fields used by gateways/webhooks
 * - Keeps your custom flags (cancel req / date change)
 *
 * Returns one of:
 * pending | confirmed | failed | cancelled | refunded | paid | cancel_req | date_change
 */
function normalizeStatus(rawStatus, booking) {
  const b = booking || {};
  const s = safeLower(rawStatus);

  // --- Flags override ---
  const cancelReq =
    b?.cancellationRequested === true ||
    b?.cancelRequested === true ||
    b?.cancel_request === true ||
    ["cancel_req", "cancel-requested", "cancel_requested", "cancel request"].includes(
      s
    );

  if (cancelReq) return "cancel_req";

  const dateChange =
    b?.dateChangeRequested === true ||
    b?.date_change_requested === true ||
    ["date_change", "date-change", "datechange", "date change"].includes(s);

  if (dateChange) return "date_change";

  // --- Direct status mapping (if server stored status properly) ---
  if (["confirmed", "confirm", "booked", "accepted"].includes(s)) return "confirmed";
  if (["paid", "payment_success", "payment-success", "success_paid"].includes(s))
    return "paid";
  if (["failed", "fail", "declined", "error"].includes(s)) return "failed";
  if (["cancelled", "canceled", "cancel", "void"].includes(s)) return "cancelled";
  if (["refunded", "refund", "refunded_full", "refund_success"].includes(s))
    return "refunded";
  if (["pending", "awaiting", "processing", "created", "initiated"].includes(s))
    return "pending";

  // --- Heuristics (THIS IS WHAT FIXES "PENDING EVERYWHERE") ---
  // Many systems store payment result in other fields:
  const gateway = safeLower(b.gateway || b.paymentGateway || b.payment?.gateway || "");
  const gatewayStatus = safeLower(
    b.gatewayStatus ||
      b.paymentStatus ||
      b.payment?.status ||
      b.transactionStatus ||
      b.chargeStatus ||
      b.paystackStatus ||
      ""
  );

  const hasPaidMarkers =
    b.paid === true ||
    b.isPaid === true ||
    b.paymentSuccess === true ||
    b.verified === true ||
    !!b.paidAt ||
    !!b.payment?.paidAt ||
    !!b.transactionId ||
    !!b.gatewayRef ||
    !!b.providerRef;

  // If gateway status indicates success, treat as paid
  const gatewayLooksSuccess = ["success", "successful", "paid", "completed"].includes(
    gatewayStatus
  );

  // If gateway indicates failure
  const gatewayLooksFailed = ["failed", "failure", "error", "declined"].includes(
    gatewayStatus
  );

  if (gatewayLooksFailed) return "failed";

  // If we see success indicators but no explicit status, call it PAID (or CONFIRMED)
  if (gatewayLooksSuccess || hasPaidMarkers) {
    // Some apps use "confirmed" after payment; some show "paid"
    // Keep as "paid" so admin can still “Mark confirmed” if you want.
    return "paid";
  }

  // If we see explicit refund markers
  const refundMarkers =
    b.refunded === true ||
    b.isRefunded === true ||
    safeLower(b.refundStatus || "") === "success" ||
    safeLower(b.refund?.status || "") === "success";

  if (refundMarkers) return "refunded";

  // Default safe
  return "pending";
}

/* status tones */
const statusTone = {
  confirmed: { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  paid: { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
  cancelled: { bg: "#ef4444", text: "#ffecec", ring: "#dc2626" },
  failed: { bg: "#ef4444", text: "#ffecec", ring: "#dc2626" },
  refunded: { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
  pending: { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },
  cancel_req: {
    bg: "rgba(245,158,11,.35)",
    text: "#fde68a",
    ring: "rgba(245,158,11,.35)",
  },
  date_change: {
    bg: "rgba(59,130,246,.35)",
    text: "#dbeafe",
    ring: "rgba(59,130,246,.45)",
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
        minWidth: 88,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 700,
        fontSize: 12,
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
};

const ActionBtn = ({ kind = "ghost", children, onClick, disabled }) => {
  const m =
    {
      confirm: { bg: "#16a34a", text: "#ecfdf5" },
      cancel: { bg: "#e11d2e", text: "#fff1f3" },
      ghost: { bg: "rgba(15,23,42,.25)", text: "#e2e8f0" },
    }[kind] || { bg: "rgba(15,23,42,.25)", text: "#e2e8f0" };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid rgba(255,255,255,.06)",
        background: m.bg,
        color: m.text,
        padding: "7px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "filter .12s ease, transform .04s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.filter = "brightness(1.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      {children}
    </button>
  );
};

/**
 * Try multiple endpoint shapes.
 * Your backend supports:
 * - PATCH /api/admin/bookings/:id/status { status }
 * - POST  /api/admin/bookings/:id/confirmed|cancelled|refunded
 */
async function patchStatusBooking(id, toStatus) {
  const lower = String(toStatus || "").toLowerCase();

  const tries = [
    {
      label: "PATCH /admin/bookings/:id/status",
      fn: async () =>
        api.patch(`/admin/bookings/${encodeURIComponent(id)}/status`, {
          status: lower,
        }),
    },
    {
      label: "POST /admin/bookings/:id/:status",
      fn: async () =>
        api.post(
          `/admin/bookings/${encodeURIComponent(id)}/${encodeURIComponent(lower)}`
        ),
    },
  ];

  let lastErr = null;
  for (const t of tries) {
    try {
      const res = await t.fn();
      return { ok: true, data: res?.data, used: t.label };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, error: lastErr };
}

export default function BookingsAdmin() {
  const nav = useNavigate();
  const { showToast: toast } = useToast();
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) {
      setTab(f);
      setPage(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchParams]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/bookings", {
        params: { status: "all", q: "", page: 1, limit: 500 },
      });

      const list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      const norm = list
        .map((b) => {
          const id = b.id || b._id || b.bookingId || b.reference || b.ref;
          if (!id) return null;

          const amount = Number(b.amountN ?? b.amount ?? b.totalAmount ?? b.total ?? 0) || 0;

          const status = normalizeStatus(b.status, b);

          const cancellationRequested =
            status === "cancel_req" ||
            b.cancellationRequested === true ||
            b.cancelRequested === true;

          const dateChangeRequested =
            status === "date_change" || b.dateChangeRequested === true;

          return {
            id,
            listing: b.listingTitle || b.listing?.title || b.listing || b.title || "-",
            listingId: b.listingId || b.listing?.id || null,

            guest: b.guestEmail || b.guest?.email || b.email || b.guest || "-",
            guestUid: b.guestId || b.guestUid || b.guest?.uid || null,

            hostUid:
              b.hostId ||
              b.ownerId ||
              b.hostUid ||
              b.partnerUid ||
              b.host?.uid ||
              null,
            hostEmail:
              b.hostEmail ||
              b.ownerEmail ||
              b.partnerEmail ||
              b.providerEmail ||
              b.host?.email ||
              b.host ||
              null,

            amount,
            status,

            gateway: b.gateway || b.paymentGateway || b.payment?.gateway || "-",
            ref: String(b.reference || b.ref || id || "-"),

            checkIn: b.checkIn || b.startDate || b.from || b.dates?.checkIn || null,
            checkOut: b.checkOut || b.endDate || b.to || b.dates?.checkOut || null,

            createdAt: b.createdAt || b.date || b.created || b.timestamp || null,

            cancellationRequested,
            dateChangeRequested,

            // optional raw fields for debugging (won’t display unless you choose to)
            _rawStatus: b.status,
            _gatewayStatus:
              b.gatewayStatus || b.paymentStatus || b.payment?.status || b.transactionStatus || null,
          };
        })
        .filter(Boolean);

      setRows(norm);
      setPage(1);

      // Helpful hint if everything is pending
      const pendingCount = norm.filter((r) => r.status === "pending").length;
      if (norm.length > 0 && pendingCount === norm.length) {
        toast &&
          toast(
            "All bookings are showing as pending. This usually means your webhook/payment confirmation is not writing booking.status (confirmed/paid) back to Firestore.",
            "info"
          );
      }
    } catch (e) {
      console.error("Bookings load failed:", e);
      toast && toast(`Failed to load bookings. ${errMsg(e)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      pending: 0,
      confirmed: 0,
      paid: 0,
      failed: 0,
      cancelled: 0,
      refunded: 0,
      cancel_req: 0,
      date_change: 0,
    };
    rows.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status] += 1;
      if (r.cancellationRequested) c.cancel_req += 1;
      if (r.dateChangeRequested) c.date_change += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;

    if (tab === "cancel_req") list = list.filter((r) => r.cancellationRequested);
    else if (tab === "date_change") list = list.filter((r) => r.dateChangeRequested);
    else if (tab !== "all") list = list.filter((r) => r.status === tab);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.listing || "").toLowerCase().includes(q) ||
          (r.guest || "").toLowerCase().includes(q) ||
          (r.ref || "").toLowerCase().includes(q) ||
          String(r.id || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, query]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const doAction = async (row, toStatus) => {
    if (!row.id) return;

    setBusyId(row.id);

    // Optimistic UI
    const prev = rows.slice();
    setRows(
      rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: toStatus,
              cancellationRequested: false,
              dateChangeRequested: false,
            }
          : r
      )
    );

    const result = await patchStatusBooking(row.id, toStatus);

    setBusyId(null);

    if (!result?.ok) {
      // rollback
      setRows(prev);
      toast && toast(`Failed to update booking. ${errMsg(result?.error)}`, "error");
      return;
    }

    toast && toast(`Updated (${toStatus}). Refreshing…`, "success");
    await load();
  };

  async function findUserUidByEmail(email) {
    if (!email) return null;
    try {
      const qSnap = await getDocs(
        fsQuery(collection(db, "users"), where("email", "==", email), fsLimit(1))
      );
      if (!qSnap.empty) return qSnap.docs[0].id;
    } catch (e) {
      console.warn("Email lookup failed:", e);
    }
    return null;
  }

  const openChatFromRow = async (row, target) => {
    const listingId = row.listingId || `admin-${row.id}`;
    const title = row.listing || "Listing";

    let partnerUid = null;
    let partnerEmail = null;

    if (target === "guest") {
      partnerUid = row.guestUid;
      partnerEmail = row.guest;
    } else {
      partnerUid = row.hostUid;
      partnerEmail = row.hostEmail;
    }

    if (partnerUid) {
      nav("/chat", {
        state: {
          partnerUid,
          listing: { id: listingId, title },
          from: "admin_bookings",
          bookingId: row.id,
        },
      });
      return;
    }

    const resolvedUid = await findUserUidByEmail(partnerEmail);
    if (resolvedUid) {
      nav("/chat", {
        state: {
          partnerUid: resolvedUid,
          listing: { id: listingId, title },
          from: "admin_bookings",
          bookingId: row.id,
        },
      });
      toast && toast("Resolved user by email and opened chat.", "success");
      return;
    }

    nav("/inbox", {
      state: {
        from: "admin_bookings",
        bookingId: row.id,
        note: `Wanted to message ${target} for booking ${row.id} (${row.listing}) but UID was missing.`,
      },
    });
    toast && toast("Couldn’t find that user in Firestore. Opened inbox instead.", "info");
  };

  const exportCsv = () => {
    const header = [
      "id",
      "listing",
      "guest",
      "status",
      "amount",
      "checkIn",
      "checkOut",
      "createdAt",
      "gateway",
      "ref",
    ];
    const lines = [header.join(",")];

    filtered.forEach((r) => {
      const line = [
        r.id,
        r.listing,
        r.guest,
        r.status,
        r.amount,
        r.checkIn ? dayjs(r.checkIn).format("YYYY-MM-DD") : "",
        r.checkOut ? dayjs(r.checkOut).format("YYYY-MM-DD") : "",
        r.createdAt ? dayjs(r.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
        r.gateway,
        r.ref,
      ]
        .map((v) => {
          const s = v == null ? "" : String(v);
          return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",");
      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nesta-bookings-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast && toast("CSV exported.", "success");
  };

  return (
    <AdminLayout title="Bookings overview" subtitle="Latest guest reservations across the platform.">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { k: "all", label: "All", count: counts.all },
            { k: "pending", label: "Pending", count: counts.pending },
            { k: "paid", label: "Paid", count: counts.paid },
            { k: "confirmed", label: "Confirmed", count: counts.confirmed },
            { k: "failed", label: "Failed", count: counts.failed },
            { k: "cancelled", label: "Cancelled", count: counts.cancelled },
            { k: "refunded", label: "Refunded", count: counts.refunded },
            { k: "cancel_req", label: "Cancel req", count: counts.cancel_req },
            { k: "date_change", label: "Date change", count: counts.date_change },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setPage(1);
              }}
              style={{
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.06)",
                background:
                  tab === t.k
                    ? "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)"
                    : "rgba(255,255,255,.02)",
                color: tab === t.k ? "#201807" : "#e2e8f0",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
              <span
                style={{
                  minWidth: 26,
                  height: 22,
                  borderRadius: 999,
                  background: tab === t.k ? "rgba(0,0,0,.16)" : "rgba(15,23,42,.35)",
                  color: tab === t.k ? "#fff" : "#e2e8f0",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            style={{
              background: "rgba(15,23,42,.25)",
              border: "1px solid rgba(255,255,255,.04)",
              borderRadius: 999,
              padding: "6px 14px",
              color: "#e2e8f0",
              fontSize: 13,
            }}
          >
            Total loaded: {rows.length}
          </span>

          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search guest, listing, ref…"
            style={{
              background: "rgba(15,23,42,.25)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 999,
              padding: "8px 14px",
              color: "#fff",
              minWidth: 210,
            }}
          />

          <button
            onClick={exportCsv}
            style={{
              background: "rgba(13,148,136,1)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "#fff",
              borderRadius: 999,
              padding: "8px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>

          <button
            onClick={load}
            style={{
              background: "linear-gradient(180deg,#6366f1,#4338ca)",
              border: "none",
              color: "#fff",
              borderRadius: 999,
              padding: "8px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.03)",
          background: "radial-gradient(circle at top, rgba(15,23,42,.65), rgba(2,6,23,1))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr .9fr .7fr .7fr .7fr",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,.03)",
            color: "rgba(226,232,240,.6)",
            fontWeight: 600,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: ".02em",
          }}
        >
          <div>Listing</div>
          <div>Dates</div>
          <div>Amount</div>
          <div>Created</div>
          <div style={{ textAlign: "right" }}>Action</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#94a3b8" }}>Loading…</div>
        ) : pageItems.length === 0 ? (
          <div style={{ padding: 18, color: "#94a3b8" }}>No bookings found.</div>
        ) : (
          pageItems.map((r) => {
            const tone = r.status;

            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr .9fr .7fr .7fr .7fr",
                  gap: 8,
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,.015)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#fff" }}>{r.listing}</div>
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,.6)", marginTop: 2 }}>
                    id: {r.id}
                    <br />
                    guest: {r.guest}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Chip
                      label={
                        r.status === "cancel_req"
                          ? "cancel req"
                          : r.status === "date_change"
                          ? "date change"
                          : r.status
                      }
                      tone={tone}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                  In: {r.checkIn ? dayjs(r.checkIn).format("YYYY-MM-DD") : "—"}
                  <br />
                  Out: {r.checkOut ? dayjs(r.checkOut).format("YYYY-MM-DD") : "—"}
                </div>

                <div style={{ fontWeight: 700, color: "#fff" }}>
                  {money(r.amount)}
                  <div style={{ fontSize: 11, color: "rgba(226,232,240,.5)", marginTop: 2 }}>
                    {r.gateway} • {String(r.ref || "-").slice(0, 14)}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "rgba(226,232,240,.6)" }}>
                  {r.createdAt ? dayjs(r.createdAt).format("DD/MM/YYYY, HH:mm") : "—"}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {(r.status === "confirmed" || r.status === "paid") ? (
                    <>
                      <ActionBtn
                        kind="cancel"
                        disabled={busyId === r.id}
                        onClick={() => doAction(r, "cancelled")}
                      >
                        Mark cancelled
                      </ActionBtn>
                      <ActionBtn
                        kind="cancel"
                        disabled={busyId === r.id}
                        onClick={() => doAction(r, "refunded")}
                      >
                        Mark refunded
                      </ActionBtn>
                    </>
                  ) : (
                    <ActionBtn
                      kind="confirm"
                      disabled={busyId === r.id}
                      onClick={() => doAction(r, "confirmed")}
                    >
                      Mark confirmed
                    </ActionBtn>
                  )}

                  <ActionBtn kind="ghost" onClick={() => openChatFromRow(r, "guest")}>
                    Msg guest
                  </ActionBtn>
                  <ActionBtn kind="ghost" onClick={() => openChatFromRow(r, "host")}>
                    Msg host
                  </ActionBtn>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 16,
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          Showing {total === 0 ? 0 : (page - 1) * perPage + 1} –{" "}
          {Math.min(page * perPage, total)} of {total} results
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.05)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 999,
              cursor: "pointer",
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
            disabled={page === 1}
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.05)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 999,
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.35 : 1,
            }}
          >
            Prev
          </button>

          <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
            {page} / {lastPage}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.05)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 999,
              cursor: page === lastPage ? "not-allowed" : "pointer",
              opacity: page === lastPage ? 0.35 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
