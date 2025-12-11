// src/pages/admin/AdminFeatureRequests.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

dayjs.extend(relativeTime);

/* Spotlight plans – mirror of EditListing */
const SPOTLIGHT_PLANS = [
  { id: "spotlight", label: "Spotlight • 24 hours", price: 20000, durationDays: 1 },
  { id: "premium", label: "Premium • 7 days", price: 70000, durationDays: 7 },
  { id: "signature", label: "Signature • 30 days", price: 250000, durationDays: 30 },
];

const fx = {
  chip: (status) => {
    const s = String(status || "").toLowerCase();
    const tone =
      s === "active"
        ? { bg: "rgba(16,185,129,.22)", text: "#a7f3d0", ring: "rgba(16,185,129,.35)" }
        : s === "awaiting-payment"
        ? { bg: "rgba(245,158,11,.22)", text: "#fde68a", ring: "rgba(245,158,11,.35)" }
        : s === "rejected"
        ? { bg: "rgba(239,68,68,.20)", text: "#fecaca", ring: "rgba(239,68,68,.35)" }
        : s === "archived"
        ? { bg: "rgba(148,163,184,.20)", text: "#e2e8f0", ring: "rgba(148,163,184,.35)" }
        : { bg: "rgba(59,130,246,.20)", text: "#bfdbfe", ring: "rgba(59,130,246,.35)" }; // pending

    return {
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      textTransform: "capitalize",
      background: tone.bg,
      color: tone.text,
      border: `1px solid ${tone.ring}`,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    };
  },
};

export default function AdminFeatureRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const toast = useToast();
  const notify = (kind, msg) =>
    toast && typeof toast[kind] === "function" ? toast[kind](msg) : window.alert(msg);

  const navigate = useNavigate();

  /* ───────────────────────── load ───────────────────────── */

  const load = async () => {
    setLoading(true);
    try {
      const ref = collection(db, "featureRequests");
      const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
      const data = snap.docs.map((d) => {
        const r = d.data() || {};
        const price = r.planPrice ?? r.price ?? null;
        return {
          id: d.id,
          listingId: r.listingId || "",
          listingTitle: r.listingTitle || r.title || "-",
          title: r.listingTitle || r.title || "-",
          hostEmail: r.hostEmail || r.by || "",
          hostUid: r.hostUid || "",
          planId: r.planId || r.planKey || "custom",
          planKey: r.planKey || "custom",
          planLabel: r.planLabel || "Custom plan",
          price,
          planPrice: price,
          durationDays: r.durationDays || null,
          status: (r.status || "pending").toLowerCase(),
          archived: !!r.archived,
          primaryImageUrl: r.primaryImageUrl || null,
          description: r.description || "",
          type: r.type || "",
          createdAt: r.createdAt || null,
          updatedAt: r.updatedAt || null,
        };
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      notify("error", "Failed to load feature requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────────────── derived ───────────────────────── */

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = rows.slice();

    if (tab !== "all") {
      list = list.filter((r) =>
        tab === "archived" ? r.archived : String(r.status || "pending") === tab
      );
    }

    if (kw) {
      list = list.filter((r) =>
        `${r.listingTitle || r.title || ""} ${r.hostEmail || ""} ${r.planLabel || ""}`
          .toLowerCase()
          .includes(kw)
      );
    }

    return list;
  }, [rows, q, tab]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      pending: 0,
      "awaiting-payment": 0,
      active: 0,
      rejected: 0,
      archived: 0,
    };
    rows.forEach((r) => {
      if (r.archived) c.archived += 1;
      else {
        const s = String(r.status || "pending");
        if (c[s] != null) c[s] += 1;
      }
    });
    return c;
  }, [rows]);

  /* ───────────────────────── actions ───────────────────────── */

  const updateRequest = async (rowId, patch, successMsg) => {
    try {
      await updateDoc(doc(db, "featureRequests", rowId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      if (successMsg) notify("success", successMsg);
      await load();
    } catch (e) {
      console.error(e);
      notify("error", "Failed to update request.");
    }
  };

  const setStatus = async (row, status) => {
    const s = String(status || "").toLowerCase();
    await updateRequest(
      row.id,
      { status: s, archived: s === "archived" ? true : row.archived || false },
      `Status set to ${s}.`
    );
  };

  const toggleArchive = async (row) => {
    const newVal = !row.archived;
    await updateRequest(
      row.id,
      { archived: newVal },
      newVal ? "Archived." : "Unarchived."
    );
  };

  const activateSpotlight = async (row) => {
    if (!row.listingId) {
      notify("error", "This request does not have a listingId.");
      return;
    }

    const plan =
      SPOTLIGHT_PLANS.find((p) => p.id === row.planId) || SPOTLIGHT_PLANS[0];
    const durationDays = row.durationDays || plan.durationDays || 1;

    if (
      !window.confirm(
        `Activate spotlight for "${row.listingTitle || row.title}"?\n\nPlan: ${
          plan.label
        }\nAmount: ₦${(row.price || plan.price).toLocaleString()}\nDuration: ${
          durationDays
        } day${durationDays > 1 ? "s" : ""}`
      )
    ) {
      return;
    }

    try {
      const now = new Date();
      const until = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update listing (note: also set legacy `featured: true`)
      await updateDoc(doc(db, "listings", row.listingId), {
        sponsored: true,
        featured: true, // legacy flag so older admin tools & filters see it
        sponsoredPlanId: row.planId || plan.id,
        sponsoredPlanLabel: row.planLabel || plan.label,
        sponsoredPrice: row.price || plan.price,
        sponsoredSince: serverTimestamp(),
        sponsoredUntil: Timestamp.fromDate(until),
        updatedAt: serverTimestamp(),
        status: "active",
      });

      // Update request
      await updateDoc(doc(db, "featureRequests", row.id), {
        status: "active",
        paid: true,
        sponsoredUntil: Timestamp.fromDate(until),
        updatedAt: serverTimestamp(),
      });

      notify("success", "Spotlight activated and listing updated.");
      await load();
    } catch (e) {
      console.error(e);
      notify("error", "Failed to activate spotlight.");
    }
  };

  const exportCsv = () => {
    const header = [
      "listingTitle",
      "listingId",
      "hostEmail",
      "status",
      "plan",
      "price",
      "durationDays",
      "archived",
      "createdAt",
      "updatedAt",
    ];
    const lines = [header.join(",")];

    filtered.forEach((r) => {
      const line = [
        r.listingTitle || r.title || "",
        r.listingId || "",
        r.hostEmail || "",
        r.status || "",
        r.planLabel || r.planId || "",
        r.price || "",
        r.durationDays || "",
        r.archived ? "yes" : "no",
        r.createdAt
          ? dayjs(r.createdAt.toDate?.() || r.createdAt).format("YYYY-MM-DD HH:mm")
          : "",
        r.updatedAt
          ? dayjs(r.updatedAt.toDate?.() || r.updatedAt).format("YYYY-MM-DD HH:mm")
          : "",
      ]
        .map((v) => {
          const s = v == null ? "" : String(v);
          return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",");
      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-requests-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("success", "CSV exported.");
  };

  /* ───────────────────────── render ───────────────────────── */

  const total = filtered.length;

  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Feature Requests"
        subtitle="Track and manage spotlight / featured-carousel requests"
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

      {/* filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, auto) 1fr auto",
          gap: 10,
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "pending", label: `Pending ${counts.pending}` },
          {
            k: "awaiting-payment",
            label: `Awaiting payment ${counts["awaiting-payment"]}`,
          },
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
              fontWeight: 800,
              cursor: "pointer",
              boxShadow:
                tab === x.k
                  ? "0 10px 30px rgba(250,204,21,.20), inset 0 1px 0 rgba(255,255,255,.06)"
                  : "inset 0 1px 0 rgba(255,255,255,.04)",
            }}
          >
            {x.label}
          </button>
        ))}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search listing, host or plan…"
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
        <div />
      </div>

      {/* table container */}
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
          Feature Requests
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 1100,
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
                {["Title / Listing", "Host", "Plan", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{ padding: "14px 16px", whiteSpace: "nowrap" }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: "#aeb6c2" }}>
                    No requests yet.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => {
                  const plan =
                    SPOTLIGHT_PLANS.find((p) => p.id === r.planId) || null;
                  const price = r.price || plan?.price || null;
                  const dur = r.durationDays || plan?.durationDays || null;

                  return (
                    <tr key={r.id}>
                      <td style={{ padding: "12px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          {r.primaryImageUrl ? (
                            <div
                              style={{
                                width: 72,
                                height: 54,
                                borderRadius: 10,
                                overflow: "hidden",
                                border: "1px solid rgba(255,255,255,.15)",
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={r.primaryImageUrl}
                                alt={r.title}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 72,
                                height: 54,
                                borderRadius: 10,
                                background:
                                  "radial-gradient(circle at top left, rgba(250,204,21,.25), rgba(15,23,42,1))",
                                border: "1px solid rgba(255,255,255,.08)",
                                flexShrink: 0,
                              }}
                            />
                          )}

                          <div>
                            <div
                              style={{
                                fontWeight: 800,
                                color: "#f3f4f6",
                              }}
                            >
                              {r.title}
                            </div>
                            <div
                              style={{
                                opacity: 0.8,
                                fontSize: 12,
                                color: "#cbd5e1",
                              }}
                            >
                              Listing: {r.listingId || "—"} · Plan:{" "}
                              {r.planLabel}
                            </div>
                            {r.description && (
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 11,
                                  color: "#94a3b8",
                                }}
                              >
                                {r.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        <div style={{ color: "#e5e7eb" }}>
                          {r.hostEmail || "—"}
                        </div>
                        {r.hostUid && (
                          <div
                            style={{
                              color: "#94a3b8",
                              fontFamily: "monospace",
                              fontSize: 11,
                            }}
                          >
                            {r.hostUid}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        <div style={{ color: "#e5e7eb" }}>
                          {r.planLabel || plan?.label || "Custom plan"}
                        </div>
                        {price && (
                          <div
                            style={{
                              color: "#fbbf24",
                              fontSize: 12,
                              marginTop: 2,
                            }}
                          >
                            ₦{Number(price).toLocaleString()}
                          </div>
                        )}
                        {dur && (
                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {dur} day{dur > 1 ? "s" : ""}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={fx.chip(
                            r.archived ? "archived" : r.status
                          )}
                        >
                          {r.archived ? "archived" : r.status || "pending"}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {r.listingId && (
                            <LuxeBtn
                              small
                              kind="slate"
                              onClick={() =>
                                navigate(`/listing/${r.listingId}`)
                              }
                            >
                              View listing
                            </LuxeBtn>
                          )}

                          <LuxeBtn
                            small
                            kind="gold"
                            onClick={() => setStatus(r, "awaiting-payment")}
                          >
                            Awaiting payment
                          </LuxeBtn>
                          <LuxeBtn
                            small
                            kind="emerald"
                            onClick={() => activateSpotlight(r)}
                          >
                            Activate & mark paid
                          </LuxeBtn>
                          <LuxeBtn
                            small
                            kind="ruby"
                            onClick={() => setStatus(r, "rejected")}
                          >
                            Reject
                          </LuxeBtn>
                          <LuxeBtn
                            small
                            kind="sky"
                            onClick={() => setStatus(r, "pending")}
                          >
                            Set pending
                          </LuxeBtn>
                          <LuxeBtn
                            small
                            kind="slate"
                            onClick={() => toggleArchive(r)}
                          >
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
            Showing {total === 0 ? 0 : 1}–{total} of {total}
          </div>
        </div>
      </div>
    </div>
  );
}
