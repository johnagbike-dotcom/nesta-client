// src/pages/admin/AdminFeatureRequests.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

/* ───────────────────────── axios base ───────────────────────── */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  withCredentials: false,
  timeout: 15000,
});

/* ───────────────────────── UI helpers ───────────────────────── */
const fx = {
  chip: (c) => {
    const tone =
      c === "shipped"
        ? { bg: "rgba(16,185,129,.22)", text: "#a7f3d0", ring: "rgba(16,185,129,.35)" }
        : c === "planned"
        ? { bg: "rgba(59,130,246,.20)", text: "#bfdbfe", ring: "rgba(59,130,246,.35)" }
        : c === "rejected"
        ? { bg: "rgba(239,68,68,.20)", text: "#fecaca", ring: "rgba(239,68,68,.35)" }
        : c === "archived"
        ? { bg: "rgba(148,163,184,.20)", text: "#e2e8f0", ring: "rgba(148,163,184,.35)" }
        : { bg: "rgba(245,158,11,.22)", text: "#fde68a", ring: "rgba(245,158,11,.35)" }; // pending
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

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          borderRadius: 16,
          padding: 16,
          background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.35))",
          border: "1px solid rgba(255,255,255,.14)",
          boxShadow: "0 24px 48px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18, color: "#f8fafc" }}>{title}</h3>
          <div style={{ marginLeft: "auto" }}>
            <LuxeBtn small onClick={onClose}>Close</LuxeBtn>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Page ─────────────────────────────── */
export default function AdminFeatureRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState("all");       // all | pending | planned | shipped | rejected | archived
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const toast = useToast();
  const notify = (kind, msg) =>
    toast && typeof toast[kind] === "function" ? toast[kind](msg) : window.alert(msg);

  // note modal
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteTarget, setNoteTarget] = useState(null);

  // history modal
  const [histOpen, setHistOpen] = useState(false);
  const [histRow, setHistRow] = useState(null);

  const LIST_ENDPOINT = "/admin/feature-requests";

  const load = async () => {
    setLoading(true);
    try {
      // Let backend filter by status if it supports ?status= — still client-filter below for safety
      const res = await api.get(LIST_ENDPOINT, { params: { status: tab === "all" ? undefined : tab, q } });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(
        data.map((r) => ({
          id:
            r.id ||
            r._id ||
            r.slug ||
            `${r.title || ""}`.toLowerCase().replace(/\s+/g, "-"),
          title: r.title || "-",
          description: r.description || "",
          by: r.by || r.email || "-",
          priority: (r.priority || "medium").toLowerCase(),
          status: String(r.status || "pending").toLowerCase(),
          note: r.note || "",
          archived: !!r.archived,
          history: Array.isArray(r.history) ? r.history : [],
          updatedAt: r.updatedAt || r.createdAt || null,
          createdAt: r.createdAt || null,
        }))
      );
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
  }, [tab]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = rows;

    // Ensure tab still filters even if backend ignores it
    if (tab !== "all") {
      list = list.filter((r) =>
        tab === "archived" ? r.archived : !r.archived && r.status === tab
      );
    }

    if (kw) {
      list = list.filter((r) =>
        `${r.title} ${r.by} ${r.description}`.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [rows, q, tab]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, planned: 0, shipped: 0, rejected: 0, archived: 0 };
    rows.forEach((r) => {
      if (r.archived) c.archived += 1;
      else c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageItems = useMemo(() => {
    const s = (page - 1) * perPage;
    return filtered.slice(s, s + perPage);
  }, [filtered, page, perPage]);

  useEffect(() => {
    setPage(1);
  }, [q, perPage, tab]);

  /* ───────────────────────── actions ───────────────────────── */
  async function actPatch(rowId, payload, successMsg) {
    const prev = rows.slice();
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx === -1) return;

    const next = prev.slice();
    next[idx] = { ...next[idx], ...payload };
    if (payload.appendHistory) {
      next[idx].history = [...(next[idx].history || []), payload.appendHistory];
    }
    setRows(next);

    try {
      await api.patch(`/admin/feature-requests/${encodeURIComponent(rowId)}`, payload);
      if (successMsg) notify("success", successMsg);
    } catch (e) {
      console.error(e);
      setRows(prev);
      notify("error", "Failed to update request.");
    }
  }

  const openNote = (row, nextStatus) => {
    setNoteTarget({ row, nextStatus });
    setNoteText("");
    setNoteOpen(true);
  };

  const saveNoteAndStatus = async () => {
    if (!noteTarget) return;
    const { row, nextStatus } = noteTarget;
    const note = noteText.trim();
    setNoteOpen(false);

    await actPatch(
      row.id,
      {
        status: nextStatus,
        archived: nextStatus === "archived" ? true : row.archived,
        note,
        appendHistory: { status: nextStatus, note, at: new Date().toISOString() },
      },
      `Set to ${nextStatus}.`
    );
  };

  const toggleArchive = async (row) => {
    const makeArchived = !row.archived;
    await actPatch(
      row.id,
      {
        archived: makeArchived,
        appendHistory: {
          status: makeArchived ? "archived" : "unarchived",
          note: "",
          at: new Date().toISOString(),
        },
      },
      makeArchived ? "Archived." : "Unarchived."
    );
  };

  const changePriority = async (row, val) => {
    await actPatch(row.id, { priority: val }, "Priority updated.");
  };

  const openHistory = (row) => {
    setHistRow(row);
    setHistOpen(true);
  };

  const exportCsv = () => {
    const header = ["title", "by", "priority", "status", "archived", "updatedAt", "createdAt"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const line = [
        r.title,
        r.by,
        r.priority,
        r.status,
        r.archived ? "yes" : "no",
        r.updatedAt ? dayjs(r.updatedAt).format("YYYY-MM-DD HH:mm") : "",
        r.createdAt ? dayjs(r.createdAt).format("YYYY-MM-DD HH:mm") : "",
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
    a.download = `feature-requests-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("success", "CSV exported.");
  };

  /* ───────────────────────── render ───────────────────────── */
  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Feature Requests"
        subtitle="Track and prioritize product ideas"
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn kind="gold" small onClick={exportCsv} title="Export as CSV">
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load} title="Refresh data">
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Filters */}
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
          { k: "planned", label: `Planned ${counts.planned}` },
          { k: "shipped", label: `Shipped ${counts.shipped}` },
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
          placeholder="Search title or user…"
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
        {/* extra right space kept for layout balance */}
        <div />
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
                {["Title", "By", "Priority", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
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

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: "#aeb6c2" }}>
                    No requests yet.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 800, color: "#f3f4f6" }}>{r.title}</div>
                      <div style={{ opacity: 0.8, fontSize: 12, color: "#cbd5e1" }}>
                        {r.description}
                      </div>
                      {!!r.note && (
                        <div
                          title={r.note}
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#eab308",
                            opacity: 0.9,
                          }}
                        >
                          Last note: {r.note.length > 64 ? r.note.slice(0, 63) + "…" : r.note}
                        </div>
                      )}
                      {r.updatedAt && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
                          Updated {dayjs(r.updatedAt).fromNow?.() || r.updatedAt}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px" }}>{r.by}</td>

                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={r.priority}
                        onChange={(e) => changePriority(r, e.target.value)}
                        style={{
                          background: "rgba(255,255,255,.06)",
                          color: "#e6e9ef",
                          border: "1px solid rgba(255,255,255,.12)",
                          borderRadius: 8,
                          padding: "6px 8px",
                        }}
                      >
                        {["low", "medium", "high", "urgent"].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <span style={fx.chip(r.archived ? "archived" : r.status)}>
                        {r.archived ? "archived" : r.status}
                        <button
                          onClick={() => openHistory(r)}
                          title="View history"
                          style={{
                            marginLeft: 6,
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          🕑
                        </button>
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <LuxeBtn kind="gold" small onClick={() => openNote(r, "planned")}>
                          Planned
                        </LuxeBtn>
                        <LuxeBtn kind="emerald" small onClick={() => openNote(r, "shipped")}>
                          Shipped
                        </LuxeBtn>
                        <LuxeBtn kind="ruby" small onClick={() => openNote(r, "rejected")}>
                          Reject
                        </LuxeBtn>
                        <LuxeBtn kind="sky" small onClick={() => openNote(r, "pending")}>
                          Set Pending
                        </LuxeBtn>
                        <LuxeBtn kind="slate" small onClick={() => toggleArchive(r)}>
                          {r.archived ? "Unarchive" : "Archive"}
                        </LuxeBtn>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Notes modal */}
      <Modal
        open={noteOpen}
        title={
          noteTarget
            ? `Add admin note • set "${noteTarget.row.title}" → ${noteTarget.nextStatus}`
            : "Add admin note"
        }
        onClose={() => setNoteOpen(false)}
      >
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Why are you changing this status? (optional but recommended)"
          rows={5}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(255,255,255,.06)",
            color: "#e5e7eb",
            padding: 12,
          }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
          <LuxeBtn small onClick={() => setNoteOpen(false)}>
            Cancel
          </LuxeBtn>
          <LuxeBtn kind="gold" small onClick={saveNoteAndStatus}>
            Save & Update
          </LuxeBtn>
        </div>
      </Modal>

      {/* History modal */}
      <Modal open={histOpen} onClose={() => setHistOpen(false)} title="Status history">
        {!histRow || (Array.isArray(histRow.history) && histRow.history.length === 0) ? (
          <div style={{ color: "#aeb6c2" }}>No history yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(histRow.history || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={fx.chip(h.status)}>{h.status}</span>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {h.at ? dayjs(h.at).format("YYYY-MM-DD HH:mm") : ""}
                    </div>
                  </div>
                  {h.note && (
                    <div style={{ marginTop: 6, color: "#e5e7eb" }}>
                      <em>“{h.note}”</em>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
