// src/pages/admin/AdminFeatureRequests.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

dayjs.extend(relativeTime);

/* ───────────────────────── Luxury plans (single source) ───────────────────────── */
const FEATURE_PLANS = [
  { id: "spotlight", label: "Spotlight • 24 hours", price: 20000, durationDays: 1 },
  { id: "premium", label: "Premium • 7 days", price: 70000, durationDays: 7 },
  { id: "signature", label: "Signature • 30 days", price: 250000, durationDays: 30 },
];

/* ───────────────────────── Helpers ───────────────────────── */
function asDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(+d) ? null : d;
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}

function clip(s, n = 24) {
  if (!s) return "";
  const x = String(s);
  return x.length > n ? `${x.slice(0, n - 1)}…` : x;
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
}

const tone = (status, archived) => {
  const s = String(status || "pending").toLowerCase();
  if (archived)
    return { bg: "rgba(148,163,184,.16)", text: "#e2e8f0", ring: "rgba(148,163,184,.30)" };

  if (s === "active")
    return { bg: "rgba(16,185,129,.18)", text: "#a7f3d0", ring: "rgba(16,185,129,.32)" };
  if (s === "awaiting-payment")
    return { bg: "rgba(245,158,11,.18)", text: "#fde68a", ring: "rgba(245,158,11,.32)" };
  if (s === "paid")
    return { bg: "rgba(59,130,246,.18)", text: "#bfdbfe", ring: "rgba(59,130,246,.32)" };
  if (s === "rejected")
    return { bg: "rgba(239,68,68,.18)", text: "#fecaca", ring: "rgba(239,68,68,.32)" };

  return { bg: "rgba(99,102,241,.18)", text: "#c7d2fe", ring: "rgba(99,102,241,.30)" };
};

const Pill = ({ status, archived }) => {
  const t = tone(status, archived);
  const label = archived ? "archived" : String(status || "pending");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        textTransform: "capitalize",
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.70)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "grid",
        placeItems: "center",
        zIndex: 80,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1000px, 94vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.14)",
          background: "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.90))",
          boxShadow: "0 24px 70px rgba(0,0,0,.65)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ fontWeight: 950, color: "#f8fafc" }}>{title}</div>
          <div style={{ marginLeft: "auto" }}>
            <LuxeBtn small onClick={onClose}>
              Close
            </LuxeBtn>
          </div>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Component ───────────────────────── */
export default function AdminFeatureRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  // Review modal
  const [open, setOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  // approval lock controls
  const [planId, setPlanId] = useState("spotlight");
  const [price, setPrice] = useState(20000);
  const [durationDays, setDurationDays] = useState(1);

  // listing preview
  const [listingPreview, setListingPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // payment reference input (luxury: reconciliation tool)
  const [paymentRefInput, setPaymentRefInput] = useState("");

  const nav = useNavigate();
  const toast = useToast();

  const notify = (msg, type = "success") => {
    if (toast?.show) return toast.show(msg, type);
    if (type === "error" && toast?.error) return toast.error(msg);
    if (type === "success" && toast?.success) return toast.success(msg);
    window.alert(msg);
  };

  const normalize = (d) => {
    const r = d.data() || {};
    const createdAt = r.createdAt || r.submittedAt || null;

    // locked terms should live on the request AFTER approval
    const plan = FEATURE_PLANS.find((p) => p.id === (r.planId || r.planKey)) || null;
    const lockedPrice = r.price ?? r.planPrice ?? plan?.price ?? null;
    const lockedDuration = r.durationDays ?? plan?.durationDays ?? null;

    return {
      id: d.id,
      listingId: r.listingId || "",
      listingTitle: r.listingTitle || r.title || "-",
      hostEmail: r.hostEmail || r.by || r.email || "",
      hostUid: r.hostUid || r.userId || r.requestedBy || "",
      status: String(r.status || "pending").toLowerCase(),
      archived: !!r.archived,

      // locked commercial terms
      planId: r.planId || r.planKey || plan?.id || "custom",
      planLabel: r.planLabel || plan?.label || "Custom plan",
      price: lockedPrice,
      durationDays: lockedDuration,

      // payment fields
      paid: !!r.paid,
      paymentRef: r.paymentRef || r.reference || r.paystackRef || r.flwRef || "",
      paidAt: r.paidAt || null,

      sponsoredUntil: r.sponsoredUntil || null,
      primaryImageUrl: r.primaryImageUrl || null,
      description: r.description || "",
      adminNote: r.adminNote || "",
      createdAt,
      updatedAt: r.updatedAt || null,
    };
  };

  /* ───────────────────────── Load ───────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const ref = collection(db, "featureRequests");
      const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
      setRows(snap.docs.map(normalize));
    } catch (e) {
      console.error(e);
      notify("Failed to load feature requests.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────────────── Derived ───────────────────────── */
  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, "awaiting-payment": 0, paid: 0, active: 0, rejected: 0, archived: 0 };
    rows.forEach((r) => {
      c.all += 1;
      if (r.archived) c.archived += 1;
      else if (r.status in c) c[r.status] += 1;
      else c.pending += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = rows.slice();

    if (tab !== "all") {
      if (tab === "archived") list = list.filter((r) => r.archived);
      else list = list.filter((r) => !r.archived && String(r.status || "pending") === tab);
    }

    if (kw) {
      list = list.filter((r) => {
        const hay = `${r.listingTitle} ${r.listingId} ${r.hostEmail} ${r.planLabel} ${r.status} ${r.paymentRef}`.toLowerCase();
        return hay.includes(kw);
      });
    }
    return list;
  }, [rows, tab, q]);

  /* ───────────────────────── Actions ───────────────────────── */
  const patch = async (id, data) => {
    await updateDoc(doc(db, "featureRequests", id), { ...data, updatedAt: serverTimestamp() });
  };

  // Approve = lock plan + move to awaiting-payment (luxury gate)
  const approveToAwaitingPayment = async (row) => {
    try {
      setBusyId(row.id);

      const plan = FEATURE_PLANS.find((p) => p.id === planId) || FEATURE_PLANS[0];
      const locked = {
        status: "awaiting-payment",
        planId: planId,
        planLabel: plan?.label || row.planLabel || "Custom plan",
        price: Number(price || 0),
        durationDays: Number(durationDays || 1),
        approvedAt: serverTimestamp(),
        rejectedAt: null,
        adminNote: "",
        // IMPORTANT: never set paid here
        paid: false,
        paidAt: null,
      };

      await patch(row.id, locked);
      notify("Approved. Now awaiting payment.", "success");
      await load();
      setOpen(false);
    } catch (e) {
      console.error(e);
      notify("Failed to approve.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (row) => {
    if (!window.confirm("Reject this request?")) return;
    try {
      setBusyId(row.id);
      await patch(row.id, { status: "rejected", rejectedAt: serverTimestamp() });
      notify("Rejected.", "success");
      await load();
      setOpen(false);
    } catch (e) {
      console.error(e);
      notify("Failed to reject.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async (row) => {
    try {
      setBusyId(row.id);
      await patch(row.id, { archived: !row.archived });
      notify(row.archived ? "Unarchived." : "Archived.", "success");
      await load();
    } catch (e) {
      console.error(e);
      notify("Failed to archive.", "error");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ “Mark paid” is still available but framed as reconciliation override
  const markPaidOverride = async (row) => {
    if (!window.confirm("Mark as PAID manually?\n\nUse only for bank transfer / reconciliation.")) return;
    try {
      setBusyId(row.id);
      await patch(row.id, {
        paid: true,
        paidAt: serverTimestamp(),
        status: "paid",
        paymentRef: row.paymentRef || "manual-override",
      });
      notify("Marked as paid (override).", "success");
      await load();
    } catch (e) {
      console.error(e);
      notify("Failed to mark paid.", "error");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ Luxury governance: Deactivate (kill-switch)
  const deactivateFeaturedNow = async (row) => {
    if (!row.listingId) return notify("Missing listingId.", "error");
    if (!window.confirm("End this featured placement now?\n\nThis removes it from the homepage carousel immediately.")) return;

    try {
      setBusyId(row.id);

      const batch = writeBatch(db);

      batch.update(doc(db, "listings", row.listingId), {
        sponsored: false,
        featured: false,
        sponsoredUntil: null,
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, "featureRequests", row.id), {
        status: "paid", // stays paid but no longer active
        deactivatedAt: serverTimestamp(),
        sponsoredUntil: null,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      notify("Deactivated. Listing removed from carousel.", "success");
      await load();
      setOpen(false);
    } catch (e) {
      console.error(e);
      notify("Failed to deactivate.", "error");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ Activate featured (atomic request + listing update)
  const activateFeatured = async (row) => {
    if (!row.listingId) return notify("Missing listingId for this request.", "error");
    if (!row.paid) return notify("This request is not marked paid yet.", "error");

    const dur = Number(row.durationDays || 1);
    if (!window.confirm(`Activate featured placement for ${dur} day(s)?`)) return;

    try {
      setBusyId(row.id);

      const now = new Date();
      const until = new Date(now.getTime() + dur * 24 * 60 * 60 * 1000);

      // Atomic update (luxury-grade: prevent partial states)
      const batch = writeBatch(db);

      batch.update(doc(db, "listings", row.listingId), {
        sponsored: true,
        featured: true,
        sponsoredPlanId: row.planId || "custom",
        sponsoredPlanLabel: row.planLabel || "Custom plan",
        sponsoredPrice: Number(row.price || 0),
        sponsoredSince: serverTimestamp(),
        sponsoredUntil: Timestamp.fromDate(until),
        status: "active",
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, "featureRequests", row.id), {
        status: "active",
        sponsoredUntil: Timestamp.fromDate(until),
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      notify("Activated. Listing is now eligible for homepage carousel.", "success");
      await load();
      setOpen(false);
    } catch (e) {
      console.error(e);
      notify("Failed to activate.", "error");
    } finally {
      setBusyId(null);
    }
  };

  /* ───────────────────────── Review modal loader ───────────────────────── */
  const openReview = async (row) => {
    setActiveRow(row);
    setOpen(true);
    setListingPreview(null);
    setPaymentRefInput(row.paymentRef || "");

    const fallbackPlan = FEATURE_PLANS.find((p) => p.id === row.planId) || FEATURE_PLANS[0];
    const pId = row.planId && row.planId !== "custom" ? row.planId : fallbackPlan.id;
    setPlanId(pId);
    setPrice(Number(row.price ?? fallbackPlan.price));
    setDurationDays(Number(row.durationDays ?? fallbackPlan.durationDays));

    try {
      if (!row.listingId) return;
      const snap = await getDoc(doc(db, "listings", row.listingId));
      if (snap.exists()) setListingPreview({ id: snap.id, ...snap.data() });
    } catch (e) {
      console.warn("Could not load listing preview:", e);
    }
  };

  const closeReview = () => {
    setOpen(false);
    setActiveRow(null);
    setListingPreview(null);
    setPaymentRefInput("");
  };

  // Small helper: save paymentRef on request (for reconciliation)
  const savePaymentRef = async () => {
    if (!activeRow) return;
    try {
      setBusyId(activeRow.id);
      await patch(activeRow.id, { paymentRef: String(paymentRefInput || "").trim() });
      notify("Payment reference saved.", "success");
      await load();
    } catch (e) {
      console.error(e);
      notify("Could not save payment reference.", "error");
    } finally {
      setBusyId(null);
    }
  };

  /* ───────────────────────── CSV export ───────────────────────── */
  const exportCsv = () => {
    const header = [
      "id",
      "listingTitle",
      "listingId",
      "hostEmail",
      "status",
      "paid",
      "paymentRef",
      "planId",
      "planLabel",
      "price",
      "durationDays",
      "archived",
      "createdAt",
      "paidAt",
      "sponsoredUntil",
    ];
    const lines = [header.join(",")];

    filtered.forEach((r) => {
      const line = [
        r.id,
        r.listingTitle || "",
        r.listingId || "",
        r.hostEmail || "",
        r.archived ? "archived" : r.status || "pending",
        r.paid ? "yes" : "no",
        r.paymentRef || "",
        r.planId || "",
        r.planLabel || "",
        r.price ?? "",
        r.durationDays ?? "",
        r.archived ? "yes" : "no",
        r.createdAt ? dayjs(asDate(r.createdAt)).format("YYYY-MM-DD HH:mm") : "",
        r.paidAt ? dayjs(asDate(r.paidAt)).format("YYYY-MM-DD HH:mm") : "",
        r.sponsoredUntil ? dayjs(asDate(r.sponsoredUntil)).format("YYYY-MM-DD HH:mm") : "",
      ]
        .map((v) => {
          const s = v == null ? "" : String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",");
      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-requests-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("CSV exported.", "success");
  };

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Featured Requests"
        subtitle="Luxury-grade workflow: review → approve → pay → activate → carousel"
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn kind="gold" small onClick={exportCsv}>
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load}>
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, auto) 1fr",
          gap: 10,
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "pending", label: `Pending ${counts.pending}` },
          { k: "awaiting-payment", label: `Awaiting payment ${counts["awaiting-payment"]}` },
          { k: "paid", label: `Paid ${counts.paid}` },
          { k: "active", label: `Active ${counts.active}` },
          { k: "rejected", label: `Rejected ${counts.rejected}` },
          { k: "archived", label: `Archived ${counts.archived}` },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background:
                tab === x.k
                  ? "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)"
                  : "rgba(255,255,255,.06)",
              color: tab === x.k ? "#201807" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow:
                tab === x.k
                  ? "0 10px 30px rgba(250,204,21,.18), inset 0 1px 0 rgba(255,255,255,.06)"
                  : "inset 0 1px 0 rgba(255,255,255,.04)",
            }}
          >
            {x.label}
          </button>
        ))}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search listing, host, plan, ref…"
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
          background:
            "radial-gradient(1200px 600px at 0% -10%, rgba(250,204,21,.04), transparent 40%), rgba(0,0,0,.25)",
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
          Requests
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1180 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["Listing", "Host", "Plan", "Payment", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 18, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 18, color: "#aeb6c2" }}>
                    No requests found.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => {
                  const tCreated = asDate(r.createdAt);
                  const createdLabel = tCreated ? dayjs(tCreated).format("YYYY-MM-DD HH:mm") : "—";

                  const paidLabel = r.paid ? "Paid ✅" : r.status === "awaiting-payment" ? "Awaiting payment" : "Not paid";
                  const paidAt = r.paidAt ? asDate(r.paidAt) : null;

                  const busy = busyId === r.id;

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 900, color: "#f3f4f6" }}>{clip(r.listingTitle, 36)}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                          ID: <span style={{ fontFamily: "monospace" }}>{clip(r.listingId || r.id, 20)}</span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "#e5e7eb" }}>{clip(r.hostEmail || "—", 30)}</div>
                        {r.hostUid ? (
                          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                            {clip(r.hostUid, 22)}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "#e5e7eb", fontWeight: 800 }}>{clip(r.planLabel, 26)}</div>
                        <div style={{ color: "#fbbf24", fontSize: 12, marginTop: 2 }}>
                          {money(r.price)} • {Number(r.durationDays || 0)} day{Number(r.durationDays || 0) === 1 ? "" : "s"}
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "#e5e7eb", fontWeight: 800 }}>{paidLabel}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          Ref: {r.paymentRef ? clip(r.paymentRef, 18) : "—"}
                          {paidAt ? ` • ${dayjs(paidAt).fromNow()}` : ""}
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <Pill status={r.status} archived={r.archived} />
                      </td>

                      <td style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>{createdLabel}</td>

                      <td
                        style={{
                          padding: "10px 12px",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          right: 0,
                          background: "rgba(0,0,0,.25)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {r.listingId ? (
                            <LuxeBtn small kind="slate" disabled={busy} onClick={() => nav(`/listing/${r.listingId}`)}>
                              View
                            </LuxeBtn>
                          ) : null}

                          <LuxeBtn small kind="gold" disabled={busy} onClick={() => openReview(r)}>
                            Review
                          </LuxeBtn>

                          {!r.archived && r.status !== "rejected" ? (
                            <LuxeBtn small kind="ruby" disabled={busy} onClick={() => reject(r)}>
                              Reject
                            </LuxeBtn>
                          ) : null}

                          {!r.paid && (r.status === "awaiting-payment" || r.status === "pending") ? (
                            <LuxeBtn small kind="slate" disabled={busy} onClick={() => markPaidOverride(r)}>
                              Mark paid (override)
                            </LuxeBtn>
                          ) : null}

                          {r.paid && !r.archived && r.status !== "active" ? (
                            <LuxeBtn small kind="emerald" disabled={busy} onClick={() => activateFeatured(r)}>
                              Activate
                            </LuxeBtn>
                          ) : null}

                          {r.status === "active" && !r.archived ? (
                            <LuxeBtn small kind="ruby" disabled={busy} onClick={() => deactivateFeaturedNow(r)}>
                              Deactivate
                            </LuxeBtn>
                          ) : null}

                          <LuxeBtn small kind="slate" disabled={busy} onClick={() => toggleArchive(r)}>
                            {r.archived ? "Unarchive" : "Archive"}
                          </LuxeBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,.08)", color: "#aeb6c2" }}>
          Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </div>
      </div>

      {/* Review Modal */}
      <Modal open={open} title="Review & approve featured request" onClose={closeReview}>
        {!activeRow ? null : (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: 8,
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <div style={{ color: "#94a3b8" }}>Listing</div>
              <div style={{ color: "#f8fafc", fontWeight: 900 }}>{activeRow.listingTitle}</div>

              <div style={{ color: "#94a3b8" }}>Host</div>
              <div style={{ color: "#e5e7eb" }}>{activeRow.hostEmail || "—"}</div>

              <div style={{ color: "#94a3b8" }}>Status</div>
              <div>
                <Pill status={activeRow.status} archived={activeRow.archived} />
              </div>

              <div style={{ color: "#94a3b8" }}>Paid</div>
              <div style={{ color: "#e5e7eb", fontWeight: 800 }}>
                {activeRow.paid ? "Yes ✅" : "No"}
                {activeRow.paymentRef ? ` • Ref: ${clip(activeRow.paymentRef, 24)}` : ""}
              </div>
            </div>

            {/* Payment ref tool (reconciliation) */}
            <div
              style={{
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,.04)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, color: "#f8fafc" }}>Payment reference (optional)</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                Luxury best-practice: store a transaction reference for audit/reconciliation (Paystack/Flutterwave).
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  placeholder="e.g. paystack_ref / flw_ref / bank_txn_ref"
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.06)",
                    color: "#dfe3ea",
                    padding: "0 12px",
                    minWidth: 360,
                  }}
                />
                <LuxeBtn small kind="slate" disabled={busyId === activeRow.id} onClick={savePaymentRef}>
                  Save ref
                </LuxeBtn>
              </div>
            </div>

            {/* Approval lock */}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,.08)",
                paddingTop: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, color: "#f8fafc" }}>Approval terms (locked)</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                Luxury standard: approve → lock price & duration → await payment → activate.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={planId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setPlanId(pid);
                    const p = FEATURE_PLANS.find((x) => x.id === pid) || FEATURE_PLANS[0];
                    setPrice(p.price);
                    setDurationDays(p.durationDays);
                  }}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.06)",
                    color: "#e5e7eb",
                    padding: "0 12px",
                    minWidth: 280,
                  }}
                >
                  {FEATURE_PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} • {money(p.price)}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Price</div>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min={0}
                    style={{
                      height: 44,
                      width: 160,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "rgba(255,255,255,.06)",
                      color: "#e5e7eb",
                      padding: "0 12px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Days</div>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    min={1}
                    style={{
                      height: 44,
                      width: 120,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "rgba(255,255,255,.06)",
                      color: "#e5e7eb",
                      padding: "0 12px",
                    }}
                  />
                </div>
              </div>

              {/* actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <LuxeBtn small onClick={closeReview}>
                  Close
                </LuxeBtn>

                {!activeRow.archived && activeRow.status !== "rejected" ? (
                  <LuxeBtn
                    small
                    kind="gold"
                    disabled={busyId === activeRow.id}
                    onClick={() => approveToAwaitingPayment(activeRow)}
                    title="Approve after photo review"
                  >
                    Approve → Awaiting payment
                  </LuxeBtn>
                ) : null}

                {!activeRow.archived && activeRow.paid && activeRow.status !== "active" ? (
                  <LuxeBtn small kind="emerald" disabled={busyId === activeRow.id} onClick={() => activateFeatured(activeRow)}>
                    Activate
                  </LuxeBtn>
                ) : null}

                {activeRow.status === "active" && !activeRow.archived ? (
                  <LuxeBtn small kind="ruby" disabled={busyId === activeRow.id} onClick={() => deactivateFeaturedNow(activeRow)}>
                    Deactivate now
                  </LuxeBtn>
                ) : null}

                {!activeRow.archived && activeRow.status !== "rejected" ? (
                  <LuxeBtn small kind="ruby" disabled={busyId === activeRow.id} onClick={() => reject(activeRow)}>
                    Reject
                  </LuxeBtn>
                ) : null}

                <LuxeBtn small kind="slate" disabled={busyId === activeRow.id} onClick={() => toggleArchive(activeRow)}>
                  {activeRow.archived ? "Unarchive" : "Archive"}
                </LuxeBtn>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
