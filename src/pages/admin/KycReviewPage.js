// src/pages/admin/KycReviewPage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import axios from "axios";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, storage } from "../../firebase"; // ✅ storage added

import { ref as sRef, listAll, getDownloadURL } from "firebase/storage"; // ✅ storage helpers

import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../components/Toast";

/* ------------------------------ axios base ------------------------------ */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 20000,
});

// Attach Firebase ID token automatically
api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ------------------------------ helpers ------------------------------ */
const safeLower = (v) => String(v || "").trim().toLowerCase();

function safeDateLoose(v) {
  if (!v) return null;

  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }

  if (typeof v === "object" && typeof v.seconds === "number") {
    const ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const tone = {
  pending: { bg: "rgba(234,179,8,.18)", text: "#facc15", ring: "rgba(250,204,21,.35)" },
  approved: { bg: "rgba(22,163,74,.20)", text: "#a7f3d0", ring: "rgba(34,197,94,.35)" },
  rejected: { bg: "rgba(239,68,68,.20)", text: "#fecaca", ring: "rgba(248,113,113,.35)" },
};

function StatusPill({ value }) {
  const v = safeLower(value || "pending");
  const t = tone[v] || tone.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 104,
        height: 34,
        padding: "0 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
      }}
    >
      {v}
    </span>
  );
}

/* ------------------------------ CSV download ------------------------------ */
function pickFilename(disposition, fallback) {
  try {
    if (!disposition) return fallback;
    const m = /filename\*?=(?:UTF-8'')?"?([^"]+)"?/i.exec(disposition);
    if (!m?.[1]) return fallback;
    return decodeURIComponent(m[1]).replace(/[/\\]/g, "_");
  } catch {
    return fallback;
  }
}

async function downloadCsv(href, fallbackName) {
  const res = await api.get(href, { responseType: "blob" });
  const disposition = res.headers?.["content-disposition"] || res.headers?.["Content-Disposition"];
  const filename = pickFilename(disposition, fallbackName);

  const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  window.URL.revokeObjectURL(url);
}

/* ------------------------------ Docs extraction ------------------------------ */
/**
 * Preferred: your admin API returns kycProfiles rows with:
 *  - uploads: { docType: { url, name, ... } }
 *  - documents: { docType: [ { url, name }, ... ] }
 */
function docsFromApiRow(row) {
  const out = [];

  const uploads = row?.uploads && typeof row.uploads === "object" ? row.uploads : null;
  if (uploads) {
    Object.entries(uploads).forEach(([docType, entry]) => {
      if (entry?.url) {
        out.push({
          name: `${docType}: ${entry?.name || "file"}`,
          url: entry.url,
          source: "api_uploads",
        });
      }
    });
  }

  const documents = row?.documents && typeof row.documents === "object" ? row.documents : null;
  if (documents) {
    Object.entries(documents).forEach(([docType, arr]) => {
      const list = Array.isArray(arr) ? arr : [];
      list.forEach((x, idx) => {
        if (x?.url) {
          out.push({
            name: `${docType}: ${x?.name || `file_${idx + 1}`}`,
            url: x.url,
            source: "api_documents",
          });
        }
      });
    });
  }

  // Deduplicate by url
  const seen = new Set();
  return out.filter((d) => {
    if (!d.url) return false;
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

/**
 * Firestore fallback: kycProfiles/{uid}.documents
 * documents: { docType: [{name,url,...}, ...] }
 */
function docsFromKycProfilesDoc(data) {
  const out = [];
  const documents = data?.documents && typeof data.documents === "object" ? data.documents : null;
  if (!documents) return out;

  Object.entries(documents).forEach(([docType, arr]) => {
    const list = Array.isArray(arr) ? arr : [];
    list.forEach((x, idx) => {
      if (x?.url) {
        out.push({
          name: `${docType}: ${x?.name || `file_${idx + 1}`}`,
          url: x.url,
          source: "firestore_kycProfiles",
        });
      }
    });
  });

  const seen = new Set();
  return out.filter((d) => {
    if (!d.url) return false;
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

/**
 * Legacy Firestore fallback: kyc/{uid}.files
 * files: [{name,url,path,uploadedAt}, ...]
 */
function docsFromLegacyKycDoc(data) {
  const out = [];
  const files = Array.isArray(data?.files) ? data.files : [];
  files.forEach((f, idx) => {
    if (f?.url) {
      out.push({
        name: `document: ${f?.name || `file_${idx + 1}`}`,
        url: f.url,
        source: "firestore_legacy_kyc",
      });
    }
  });

  const seen = new Set();
  return out.filter((d) => {
    if (!d.url) return false;
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

/* ------------------------------ Storage fallback (NEW) ------------------------------ */
async function listAllFilesRecursively(folderRef) {
  const res = await listAll(folderRef);
  let files = [...res.items];
  for (const subfolder of res.prefixes) {
    const subFiles = await listAllFilesRecursively(subfolder);
    files = files.concat(subFiles);
  }
  return files;
}

function niceDocNameFromPath(fullPath) {
  // fullPath: kyc/{uid}/governmentId/filename.png
  const parts = String(fullPath || "").split("/").filter(Boolean);
  const label = parts.length >= 2 ? parts[parts.length - 2] : "document";
  const file = parts.length ? parts[parts.length - 1] : "file";
  return `${label}: ${file}`;
}

/* ------------------------------ Modal ------------------------------ */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.78)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "grid",
        placeItems: "center",
        zIndex: 80,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1040px, 94vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.14)",
          background: "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
          boxShadow: "0 28px 70px rgba(0,0,0,.70)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ fontWeight: 900 }}>{title}</div>
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

/* ------------------------------ Page ------------------------------ */
export default function KycReviewPage() {
  const toast = useToast();
  const notify = (msg, type = "success") => {
    if (toast?.show) return toast.show(msg, type);
    if (type === "error" && toast?.error) return toast.error(msg);
    if (type === "success" && toast?.success) return toast.success(msg);
    alert(msg);
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all|pending|approved|rejected

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // modal
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [docs, setDocs] = useState([]);
  const [docsNote, setDocsNote] = useState("");
  const [docsLoading, setDocsLoading] = useState(false);

  const lastPage = Math.max(1, Math.ceil((total || 0) / perPage));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: perPage };
      if (tab !== "all") params.status = tab;
      if (q.trim()) params.q = q.trim();

      const res = await api.get("/admin/kyc", { params });
      const arr = Array.isArray(res.data?.data) ? res.data.data : [];
      const t = Number(res.data?.total ?? arr.length ?? 0);

      setRows(arr);
      setTotal(Number.isFinite(t) ? t : 0);
    } catch (e) {
      console.error("KYC load failed:", e?.response?.data || e.message);
      notify("Failed to load KYC requests.", "error");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, tab, q]); // eslint-disable-line

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const counts = useMemo(() => {
    const c = { all: total || 0, pending: 0, approved: 0, rejected: 0 };
    rows.forEach((r) => {
      const s = safeLower(r.status || "pending");
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [rows, total]);

  const closeReview = () => {
    setOpen(false);
    setSel(null);
    setDocs([]);
    setDocsNote("");
    setDocsLoading(false);
  };

  const resolveUidFromRow = (row) => row?.userId || row?.uid || row?.id || null;

  const openReview = useCallback(async (row) => {
    setSel(row);
    setOpen(true);
    setDocs([]);
    setDocsNote("");
    setDocsLoading(true);

    try {
      // 1) Prefer API docs (fast)
      const fromApi = docsFromApiRow(row);
      if (fromApi.length) {
        setDocs(fromApi);
        setDocsLoading(false);
        return;
      }

      const uid = resolveUidFromRow(row);
      if (!uid) {
        setDocsNote("Missing userId on this record — cannot resolve document location.");
        setDocsLoading(false);
        return;
      }

      // 2) Firestore fallback: kycProfiles/{uid}
      try {
        const snap = await getDoc(doc(db, "kycProfiles", uid));
        if (snap.exists()) {
          const fromProfiles = docsFromKycProfilesDoc(snap.data());
          if (fromProfiles.length) {
            setDocs(fromProfiles);
            setDocsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("[KycReviewPage] kycProfiles read failed:", e?.message || e);
      }

      // 3) Legacy Firestore fallback: kyc/{uid}
      try {
        const snap2 = await getDoc(doc(db, "kyc", uid));
        if (snap2.exists()) {
          const fromLegacy = docsFromLegacyKycDoc(snap2.data());
          if (fromLegacy.length) {
            setDocs(fromLegacy);
            setDocsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("[KycReviewPage] legacy kyc read failed:", e?.message || e);
      }

      // 4) ✅ Storage fallback: list under kyc/{uid}/** (recursive)
      try {
        const folder = sRef(storage, `kyc/${uid}`);
        const allRefs = await listAllFilesRecursively(folder);

        if (allRefs.length) {
          const storageDocs = await Promise.all(
            allRefs.map(async (fileRef) => ({
              name: niceDocNameFromPath(fileRef.fullPath),
              url: await getDownloadURL(fileRef),
              source: "storage_kyc",
            }))
          );

          // stable sort
          storageDocs.sort((a, b) => a.name.localeCompare(b.name));
          setDocs(storageDocs);
          setDocsLoading(false);
          return;
        }
      } catch (e) {
        console.warn("[KycReviewPage] storage kyc read failed:", e?.message || e);
      }

      setDocsNote(
        `No documents found for this KYC.\n\nChecked:\n• API row.uploads / row.documents\n• Firestore: kycProfiles/${uid}.documents\n• Firestore: kyc/${uid}.files\n• Storage: kyc/${uid}/**\n\nIf Storage has files but this still fails, your admin user may be missing the custom claim (admin=true) and Storage rules will block access.`
      );
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const setStatus = async (row, nextStatus) => {
    const id = row?.id;
    if (!id) return notify("Missing KYC record ID.", "error");

    setBusyId(id);
    try {
      await api.patch(`/admin/kyc/${id}/status`, { status: nextStatus });

      // optimistic update
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, status: nextStatus } : x)));

      notify(`KYC marked as ${nextStatus}.`, "success");
    } catch (e) {
      console.error("KYC patch failed:", e?.response?.data || e.message);
      notify("Failed to update KYC status.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (q.trim()) params.set("q", q.trim());

      const href = `/admin/kyc/export.csv?${params.toString()}`;
      await downloadCsv(href, `kyc-${Date.now()}.csv`);
      notify("KYC CSV exported.", "success");
    } catch (e) {
      console.error("KYC export failed:", e?.response?.data || e.message);
      notify("KYC export failed.", "error");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <AdminHeader
        back
        title="KYC Reviews"
        subtitle="Review and approve identity submissions (admin-only)."
        rightActions={
          <div style={{ display: "flex", gap: 8 }}>
            <LuxeBtn small kind="gold" onClick={exportCsv} disabled={loading}>
              Export CSV
            </LuxeBtn>
            <LuxeBtn small onClick={load}>
              {loading ? "Loading…" : "Refresh"}
            </LuxeBtn>
          </div>
        }
      />

      {/* Tabs + search */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto auto auto 1fr",
          gap: 10,
          alignItems: "center",
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "pending", label: `Pending (page) ${counts.pending}` },
          { k: "approved", label: `Approved (page) ${counts.approved}` },
          { k: "rejected", label: `Rejected (page) ${counts.rejected}` },
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
              background: tab === t.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: tab === t.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, userId…"
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
          KYC requests
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["Submitted", "Name", "Email", "User ID", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    No KYC records.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const submitted = safeDateLoose(r.submittedAt || r.createdAt || r.created_at || r.updatedAt);
                  const uid = r.userId || r.uid || r.id || "—";
                  const status = safeLower(r.status || "pending");

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "#cbd5e1" }}>
                        {submitted ? dayjs(submitted).format("YYYY-MM-DD HH:mm") : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#f8fafc", fontWeight: 700 }}>
                        {r.name || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                        {r.email || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                        {uid}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusPill value={status} />
                      </td>
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <LuxeBtn small onClick={() => openReview(r)}>
                            Review
                          </LuxeBtn>
                          <LuxeBtn
                            small
                            kind="emerald"
                            disabled={busyId === r.id}
                            onClick={() => setStatus(r, "approved")}
                          >
                            Approve
                          </LuxeBtn>
                          <LuxeBtn small kind="ruby" disabled={busyId === r.id} onClick={() => setStatus(r, "rejected")}>
                            Reject
                          </LuxeBtn>
                          <LuxeBtn small disabled={busyId === r.id} onClick={() => setStatus(r, "pending")}>
                            Reset
                          </LuxeBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,.08)",
            color: "#aeb6c2",
            fontSize: 13,
          }}
        >
          <div>
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

      {/* Review modal */}
      <Modal open={open} onClose={closeReview} title="KYC review">
        {!sel ? null : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 10 }}>
              <div style={{ color: "#94a3b8", fontWeight: 700 }}>Type</div>
              <div style={{ color: "#e5e7eb", fontWeight: 800 }}>{sel.type || "—"}</div>

              <div style={{ color: "#94a3b8", fontWeight: 700 }}>Email</div>
              <div style={{ color: "#e5e7eb" }}>{sel.email || "—"}</div>

              <div style={{ color: "#94a3b8", fontWeight: 700 }}>User ID</div>
              <div style={{ color: "#e5e7eb" }}>{sel.userId || sel.uid || sel.id || "—"}</div>

              <div style={{ color: "#94a3b8", fontWeight: 700 }}>Status</div>
              <div>
                <StatusPill value={sel.status || "pending"} />
              </div>

              <div style={{ color: "#94a3b8", fontWeight: 700 }}>Submitted</div>
              <div style={{ color: "#e5e7eb" }}>
                {(() => {
                  const d = safeDateLoose(sel.submittedAt || sel.createdAt || sel.created_at);
                  return d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "—";
                })()}
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8, color: "#f8fafc" }}>Documents</div>

              {docsLoading ? (
                <div style={{ color: "#94a3b8" }}>Loading documents…</div>
              ) : docs.length === 0 ? (
                <div style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>
                  {docsNote || "No documents attached to this record."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                  {docs.map((a) => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.04)",
                        padding: 12,
                        color: "#e5e7eb",
                        textDecoration: "none",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.85,
                          marginBottom: 8,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontWeight: 800,
                        }}
                      >
                        {a.name}
                      </div>
                      <div
                        style={{
                          height: 120,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(0,0,0,.22)",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,.08)",
                        }}
                      >
                        <span style={{ fontSize: 12, opacity: 0.75 }}>Open</span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>source: {a.source}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <LuxeBtn onClick={closeReview}>Close</LuxeBtn>
              <LuxeBtn kind="emerald" onClick={() => setStatus(sel, "approved")}>
                Approve
              </LuxeBtn>
              <LuxeBtn kind="ruby" onClick={() => setStatus(sel, "rejected")}>
                Reject
              </LuxeBtn>
              <LuxeBtn onClick={() => setStatus(sel, "pending")}>Reset</LuxeBtn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
