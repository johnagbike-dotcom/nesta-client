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
  const [grade, setGrade] = useState("Not graded");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setGrade(listing?.grade || "Not graded");
    setNote(listing?.qualityNote || "");
  }, [open, listing]);

  if (!open) return null;

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
            {["Not graded", "B", "A", "Elite"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>

          <label style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
            Quality note
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

          <div
            style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}
          >
            <LuxeBtn kind="slate" onClick={onClose}>
              Cancel
            </LuxeBtn>
            <LuxeBtn
              kind="gold"
              onClick={() => onSave({ grade, qualityNote: note })}
            >
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

  const [q, setQ] = useState("");
  const [city, setCity] = useState("Any city");
  const [status, setStatus] = useState("Any status"); // active | inactive
  const [grade, setGrade] = useState("Any grade"); // Not graded | B | A | Elite
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeRow, setGradeRow] = useState(null);

  /* load listings (resilient endpoints) */
  const load = async () => {
    setLoading(true);
    try {
      const candidates = ["/admin/listings", "/listings", "/host/listings"];
      let out = [];
      for (const ep of candidates) {
        try {
          const res = await api.get(ep);
          const arr = toArray(res.data);
          if (Array.isArray(res.data) && res.data.length === 0) {
            out = [];
            break;
          }
          if (arr.length || Array.isArray(res.data)) {
            out = arr.length ? arr : res.data;
            break;
          }
        } catch {
          /* try next */
        }
      }
      setRows(Array.isArray(out) ? out : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* computed filters (client side) */
  const filtered = useMemo(() => {
    let list = rows.slice();

    if (onlyFeatured) list = list.filter((r) => !!r.featured);

    if (city !== "Any city") {
      const k = city.toLowerCase();
      list = list.filter((r) =>
        `${r.city || ""} ${r.area || ""}`.toLowerCase().includes(k)
      );
    }

    if (status !== "Any status") {
      const want = status === "active" ? "active" : "inactive";
      list = list.filter(
        (r) => String(r.status || "active").toLowerCase() === want
      );
    }

    if (grade !== "Any grade") {
      list = list.filter((r) => String(r.grade || "Not graded") === grade);
    }

    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) =>
        `${r.title || ""} ${r.city || ""} ${r.area || ""} ${r.hostEmail || ""} ${
          r.id || ""
        }`
          .toLowerCase()
          .includes(kw)
      );
    }

    return list;
  }, [rows, q, city, status, grade, onlyFeatured]);

  /* ───────────────────────── actions ───────────────────────── */
  const toggleFeature = async (row, makeFeatured) => {
    const id = row.id || row._id || row.publicId;
    const prev = rows.slice();
    setRows(
      rows.map((r) =>
        (r.id || r._id) === id ? { ...r, featured: !!makeFeatured } : r
      )
    );

    const candidates = [
      (x) => `/admin/listings/${x}/feature`,
      (x) => `/listings/${x}/feature`,
      (x) => `/admin/listings/${x}`,
    ];

    let ok = false;
    for (const f of candidates) {
      try {
        const url = f(id);
        await api.patch(url, { featured: !!makeFeatured });
        ok = true;
        break;
      } catch {}
    }

    if (!ok) {
      setRows(prev);
      tErr("Failed to update feature state.");
    } else {
      tOk(makeFeatured ? "Listing is now featured." : "Listing unfeatured.");
    }
  };

  const setStatusFn = async (row, next) => {
    const id = row.id || row._id || row.publicId;
    const prev = rows.slice();
    setRows(
      rows.map((r) => ((r.id || r._id) === id ? { ...r, status: next } : r))
    );

    const candidates = [
      (x) => `/admin/listings/${x}/status`,
      (x) => `/listings/${x}/status`,
      (x) => `/admin/listings/${x}`,
    ];
    let ok = false;
    for (const f of candidates) {
      try {
        const url = f(id);
        await api.patch(url, { status: next });
        ok = true;
        break;
      } catch {}
    }

    if (!ok) {
      setRows(prev);
      tErr("Failed to update status.");
    } else {
      tOk(`Listing status updated to ${next}.`);
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

  const saveGrade = async ({ grade, qualityNote }) => {
    if (!gradeRow) return;
    const id = gradeRow.id || gradeRow._id || gradeRow.publicId;

    const prev = rows.slice();
    setRows(
      rows.map((r) =>
        (r.id || r._id) === id ? { ...r, grade, qualityNote } : r
      )
    );

    const endpoints = [
      (x) => `/admin/listings/${x}/quality`,
      (x) => `/listings/${x}/quality`,
      (x) => `/admin/listings/${x}`,
    ];
    let ok = false;
    for (const fn of endpoints) {
      try {
        const url = fn(id);
        await api.patch(url, { grade, qualityNote });
        ok = true;
        break;
      } catch {}
    }

    if (!ok) {
      setRows(prev);
      tErr("Failed to save grade.");
    } else {
      tOk("Grade & quality note updated.");
    }
    closeGrade();
  };

  const openListing = (row) => {
    const id = row.id || row._id || row.publicId;
    if (!id) return alert("Missing listing id.");
    navigate(`/listing/${id}`);
  };

  const exportCSV = () => {
    try {
      const header = [
        "id",
        "title",
        "city",
        "area",
        "price",
        "status",
        "featured",
        "grade",
        "updatedAt",
      ];
      const body = filtered.map((r) => [
        r.id || r._id || "",
        (r.title || "").replaceAll('"', '""'),
        r.city || "",
        r.area || "",
        r.pricePerNight || r.price || 0,
        r.status || "",
        r.featured ? "yes" : "no",
        r.grade || "Not graded",
        r.updatedAt ? dayjs(r.updatedAt).format("YYYY-MM-DD HH:mm") : "",
      ]);
      const lines = [header, ...body]
        .map((cols) => cols.map((c) => `"${String(c)}"`).join(","))
        .join("\n");
      const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listings.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      tOk("CSV exported.");
    } catch {
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
          gridTemplateColumns: "1fr 150px 150px 150px 180px 120px",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, city, host email…"
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
          {[
            "Any city",
            ...Array.from(new Set(rows.map((r) => r.city).filter(Boolean))),
          ].map((c) => (
            <option key={c}>{c}</option>
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
          {["Any status", "active", "inactive"].map((s) => (
            <option key={s}>{s}</option>
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
          {["Any grade", "Not graded", "B", "A", "Elite"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#cfd3da",
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={onlyFeatured}
            onChange={(e) => setOnlyFeatured(e.target.checked)}
          />
          Featured only
        </label>

        <div />{/* spacer to keep grid tidy */}
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
          Listings
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
                {[
                  "Title",
                  "City / Area",
                  "Type",
                  "Nightly",
                  "Status",
                  "Featured",
                  "Grade",
                  "Updated",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{ padding: "14px 16px", whiteSpace: "nowrap" }}
                  >
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
                  const updated = r.updatedAt
                    ? dayjs(r.updatedAt).format("YYYY-MM-DD")
                    : "-";
                  return (
                    <tr key={id || Math.random()}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800 }}>{r.title || "-"}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          ID: {id || "-"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {(r.city || "-") + (r.area ? ` / ${r.area}` : "")}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{r.type || "-"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {money(r.pricePerNight || r.price || 0)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={chip.pill(statusChip)}>{statusChip}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <input
                          type="checkbox"
                          checked={!!r.featured}
                          onChange={(e) => toggleFeature(r, e.target.checked)}
                        />
                        <span style={{ marginLeft: 8, color: "#cfd3da" }}>
                          {r.featured ? "Featured" : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={chip.pill("grade")}>
                          {r.grade || "Not graded"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>{updated}</td>
                      <td
                        style={{
                          padding: "12px 16px",
                          position: "sticky",
                          right: 0,
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,.10), rgba(0,0,0,.30))",
                          backdropFilter: "blur(2px)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <LuxeBtn kind="gold" small onClick={() => openGrade(r)}>
                            Grade
                          </LuxeBtn>

                          {statusChip === "active" ? (
                            <LuxeBtn
                              kind="ruby"
                              small
                              onClick={() => setStatusFn(r, "inactive")}
                            >
                              Deactivate
                            </LuxeBtn>
                          ) : (
                            <LuxeBtn
                              kind="emerald"
                              small
                              onClick={() => setStatusFn(r, "active")}
                            >
                              Activate
                            </LuxeBtn>
                          )}

                          {r.featured ? (
                            <LuxeBtn
                              kind="slate"
                              small
                              onClick={() => toggleFeature(r, false)}
                            >
                              Unfeature
                            </LuxeBtn>
                          ) : (
                            <LuxeBtn
                              kind="sky"
                              small
                              onClick={() => toggleFeature(r, true)}
                            >
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
      <GradeModal
        open={gradeOpen}
        listing={gradeRow}
        onClose={closeGrade}
        onSave={saveGrade}
      />
    </div>
  );
}
