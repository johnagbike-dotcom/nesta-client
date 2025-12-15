// src/pages/admin/ManageListings.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

/* ───────────────────────────── axios base ───────────────────────────── */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 15000,
});

/* ─────────────────────────── Luxe chips ─────────────────────────── */
const chip = {
  pill: (tone) => {
    const map = {
      active:   { bg: "rgba(16,185,129,.22)",  text: "#a7f3d0", ring: "rgba(16,185,129,.35)" },
      inactive: { bg: "rgba(148,163,184,.22)", text: "#e2e8f0", ring: "rgba(148,163,184,.35)" },
      review:   { bg: "rgba(245,158,11,.18)",  text: "#fde68a", ring: "rgba(245,158,11,.32)" },
      grade:    { bg: "rgba(59,130,246,.20)",  text: "#dbeafe", ring: "rgba(59,130,246,.35)" },
    };
    const c = map[tone] || map.inactive;
    return {
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
      whiteSpace: "nowrap",
    };
  },
};

/* ───────────────────────────── Modal ───────────────────────────── */
function GradeModal({ open, onClose, listing, onSave }) {
  const [grade, setGrade] = useState("Standard");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    // Admin routes default grade to "Standard" if missing
    setGrade(listing?.grade || "Standard");
    setNote(listing?.gradeNote || listing?.qualityNote || "");
  }, [open, listing]);

  if (!open) return null;

  const grades = ["Elite", "Premium", "Standard", "Needs Improvement", "Rejected"];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 92vw)",
          background: "rgba(20,20,22,.96)",
          color: "#e8eaee",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(0,0,0,.45)",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(255,255,255,.08)",
            fontWeight: 900,
          }}
        >
          Grade Listing — {listing?.title || "Listing"}
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ fontSize: 13, opacity: 0.9 }}>Grade</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)",
              color: "#eef2ff",
              padding: "0 12px",
              fontWeight: 700,
            }}
          >
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
            Grade note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="e.g., Great finish & lighting. Update bathroom photos to match."
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)",
              color: "#eef2ff",
              padding: 12,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <LuxeBtn kind="slate" onClick={onClose}>
              Cancel
            </LuxeBtn>
            <LuxeBtn kind="gold" onClick={() => onSave({ grade, note })}>
              Save Grade
            </LuxeBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── helpers ────────────────────────────── */
const money = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-NG", { style: "currency", currency: "NGN" })
    : String(n || 0);

const toArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

/* ═══════════════════════════ component ════════════════════════════ */
export default function ManageListings() {
  const navigate = useNavigate();
  const toast = useToast() || {};
  const tOk = (m) =>
    toast.show ? toast.show(m, "success") : toast.success ? toast.success(m) : alert(m);
  const tErr = (m) =>
    toast.show ? toast.show(m, "error") : toast.error ? toast.error(m) : alert(m);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Filters
  const [q, setQ] = useState("");
  const [city, setCity] = useState("Any city");
  const [status, setStatus] = useState("Any status"); // active | inactive | review
  const [grade, setGrade] = useState("Any grade"); // Elite | Premium | Standard | Needs Improvement | Rejected
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeRow, setGradeRow] = useState(null);

  /* load listings (admin endpoint, server supports filters) */
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (city !== "Any city") params.city = city;
      if (status !== "Any status") params.status = status; // active/inactive/review
      if (grade !== "Any grade") params.grade = grade;
      if (onlyFeatured) params.featured = true;

      const res = await api.get("/admin/listings", { params });
      const arr = toArray(res.data);
      setRows(arr);
    } catch (e) {
      console.error("ManageListings load failed:", e?.response?.data || e.message);
      tErr("Failed to load listings.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side fallback filtering (keeps UI responsive while typing)
  const filtered = useMemo(() => {
    let list = rows.slice();

    if (onlyFeatured) list = list.filter((r) => !!r.featured);

    if (city !== "Any city") {
      const k = city.toLowerCase();
      list = list.filter((r) => `${r.city || ""} ${r.area || ""}`.toLowerCase().includes(k));
    }

    if (status !== "Any status") {
      const want = String(status).toLowerCase();
      list = list.filter((r) => String(r.status || "active").toLowerCase() === want);
    }

    if (grade !== "Any grade") {
      list = list.filter((r) => String(r.grade || "Standard") === grade);
    }

    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) =>
        `${r.title || ""} ${r.city || ""} ${r.area || ""} ${r.hostEmail || ""} ${r.id || ""}`
          .toLowerCase()
          .includes(kw)
      );
    }

    return list;
  }, [rows, q, city, status, grade, onlyFeatured]);

  /* ───────────────────────── actions ───────────────────────── */
  const toggleFeature = async (row, makeFeatured) => {
    const id = row.id || row._id || row.publicId;
    if (!id) return;

    setBusyId(id);
    const prev = rows.slice();

    setRows(rows.map((r) => ((r.id || r._id) === id ? { ...r, featured: !!makeFeatured } : r)));

    try {
      // ✅ adminRoutes.js uses PATCH /admin/listings/:id with { featured }
      await api.patch(`/admin/listings/${id}`, { featured: !!makeFeatured });
      tOk(makeFeatured ? "Listing is now featured." : "Listing unfeatured.");
    } catch (e) {
      console.error("toggleFeature failed:", e?.response?.data || e.message);
      setRows(prev);
      tErr("Failed to update feature state.");
    } finally {
      setBusyId(null);
    }
  };

  const setStatusFn = async (row, next) => {
    const id = row.id || row._id || row.publicId;
    if (!id) return;

    setBusyId(id);
    const prev = rows.slice();

    setRows(rows.map((r) => ((r.id || r._id) === id ? { ...r, status: next } : r)));

    try {
      // ✅ adminRoutes.js uses PATCH /admin/listings/:id with { status }
      await api.patch(`/admin/listings/${id}`, { status: next });
      tOk(`Listing status updated to ${next}.`);
    } catch (e) {
      console.error("setStatusFn failed:", e?.response?.data || e.message);
      setRows(prev);
      tErr("Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const openGrade = (row) => {
    setGradeRow(row);
    setGradeOpen(true);
  };

  const closeGrade = () => {
    setGradeOpen(false);
    setGradeRow(null);
  };

  const saveGrade = async ({ grade, note }) => {
    if (!gradeRow) return;
    const id = gradeRow.id || gradeRow._id || gradeRow.publicId;
    if (!id) return;

    setBusyId(id);
    const prev = rows.slice();

    setRows(rows.map((r) => ((r.id || r._id) === id ? { ...r, grade, gradeNote: note } : r)));

    try {
      // ✅ adminRoutes.js uses PATCH /admin/listings/:id/grade with { grade, note }
      await api.patch(`/admin/listings/${id}/grade`, { grade, note });
      tOk("Grade & note updated.");
      closeGrade();
    } catch (e) {
      console.error("saveGrade failed:", e?.response?.data || e.message);
      setRows(prev);
      tErr("Failed to save grade.");
    } finally {
      setBusyId(null);
    }
  };

  const openListing = (row) => {
    const id = row.id || row._id || row.publicId;
    if (!id) return alert("Missing listing id.");
    navigate(`/listing/${id}`);
  };

  // Local CSV export (works regardless of backend)
  const exportCSV = () => {
    try {
      const header = ["id", "title", "city", "area", "pricePerNight", "status", "featured", "grade", "gradeNote", "updatedAt"];
      const body = filtered.map((r) => [
        r.id || r._id || "",
        (r.title || "").replaceAll('"', '""'),
        r.city || "",
        r.area || "",
        Number(r.pricePerNight || r.price || 0),
        r.status || "",
        r.featured ? "yes" : "no",
        r.grade || "Standard",
        (r.gradeNote || r.qualityNote || "").replaceAll('"', '""'),
        r.updatedAt ? dayjs(r.updatedAt).format("YYYY-MM-DD HH:mm") : "",
      ]);

      const lines = [header, ...body]
        .map((cols) => cols.map((c) => `"${String(c)}"`).join(","))
        .join("\n");

      const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `listings-${dayjs().format("YYYYMMDD-HHmm")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      tOk("CSV exported.");
    } catch (e) {
      console.error("exportCSV failed:", e);
      tErr("Export failed.");
    }
  };

  /* ──────────────────────────── render ─────────────────────────── */
  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="Manage Listings"
        subtitle="Review, grade, and curate premium stays."
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn kind="gold" small onClick={exportCSV} title="Export CSV">
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load} title="Refresh">
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Filters row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 150px 150px 200px 180px 120px",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, city…"
          style={{
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "#dfe3ea",
            padding: "0 12px",
          }}
        />

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,.06)",
            color: "#e6e9ef",
            border: "1px solid rgba(255,255,255,.12)",
            padding: "0 10px",
          }}
        >
          {["Any city", ...Array.from(new Set(rows.map((r) => r.city).filter(Boolean)))].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,.06)",
            color: "#e6e9ef",
            border: "1px solid rgba(255,255,255,.12)",
            padding: "0 10px",
          }}
        >
          {["Any status", "active", "inactive", "review"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={{
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,.06)",
            color: "#e6e9ef",
            border: "1px solid rgba(255,255,255,.12)",
            padding: "0 10px",
          }}
        >
          {["Any grade", "Elite", "Premium", "Standard", "Needs Improvement", "Rejected"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cfd3da", fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={onlyFeatured}
            onChange={(e) => setOnlyFeatured(e.target.checked)}
            disabled={busyId !== null}
          />
          Featured only
        </label>

        <LuxeBtn kind="cobalt" small onClick={load} disabled={loading}>
          Apply
        </LuxeBtn>
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
        <div style={{ padding: "14px 16px", fontWeight: 800, fontSize: 18, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          Listings
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["Title", "City / Area", "Type", "Nightly", "Status", "Featured", "Grade", "Updated", "Actions"].map((h) => (
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

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: "#aeb6c2" }}>
                    No results.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => {
                  const id = r.id || r._id || r.publicId;
                  const statusChip = String(r.status || "active").toLowerCase();
                  const updated = r.updatedAt ? dayjs(r.updatedAt).format("YYYY-MM-DD") : "-";
                  const rowBusy = busyId === id;

                  return (
                    <tr key={id || Math.random()}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800 }}>{r.title || "-"}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>ID: {id || "-"}</div>
                      </td>

                      <td style={{ padding: "12px 16px" }}>{(r.city || "-") + (r.area ? ` / ${r.area}` : "")}</td>

                      <td style={{ padding: "12px 16px" }}>{r.type || "-"}</td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontWeight: 800 }}>
                        {money(Number(r.pricePerNight || r.price || 0))}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span style={chip.pill(statusChip)}>{statusChip}</span>
                      </td>

                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={!!r.featured}
                          disabled={rowBusy}
                          onChange={(e) => toggleFeature(r, e.target.checked)}
                        />
                        <span style={{ marginLeft: 8, color: "#cfd3da" }}>{r.featured ? "Featured" : "—"}</span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span style={chip.pill("grade")}>{r.grade || "Standard"}</span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>{updated}</td>

                      <td
                        style={{
                          padding: "12px 16px",
                          position: "sticky",
                          right: 0,
                          background: "linear-gradient(90deg, rgba(0,0,0,.10), rgba(0,0,0,.30))",
                          backdropFilter: "blur(2px)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn kind="gold" small disabled={rowBusy} onClick={() => openGrade(r)}>
                            Grade
                          </LuxeBtn>

                          {statusChip === "active" ? (
                            <LuxeBtn kind="ruby" small disabled={rowBusy} onClick={() => setStatusFn(r, "inactive")}>
                              Deactivate
                            </LuxeBtn>
                          ) : (
                            <LuxeBtn kind="emerald" small disabled={rowBusy} onClick={() => setStatusFn(r, "active")}>
                              Activate
                            </LuxeBtn>
                          )}

                          {r.featured ? (
                            <LuxeBtn kind="slate" small disabled={rowBusy} onClick={() => toggleFeature(r, false)}>
                              Unfeature
                            </LuxeBtn>
                          ) : (
                            <LuxeBtn kind="sky" small disabled={rowBusy} onClick={() => toggleFeature(r, true)}>
                              Feature
                            </LuxeBtn>
                          )}

                          <LuxeBtn kind="slate" small onClick={() => openListing(r)}>
                            Open
                          </LuxeBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal */}
      <GradeModal open={gradeOpen} listing={gradeRow} onClose={closeGrade} onSave={saveGrade} />
    </div>
  );
}
