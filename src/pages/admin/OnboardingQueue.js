// src/pages/admin/OnboardingQueue.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import AdminHeader from "../../components/AdminHeader";
import { db, storage } from "../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";

/* ─────────────────── Luxury mini button ─────────────────── */
function LuxeBtn({
  kind = "slate",
  small = false,
  onClick,
  children,
  title,
  disabled,
}) {
  const tones = {
    gold: {
      bg: "linear-gradient(180deg,#ffd74a,#ffb31e 60%,#ffad0c)",
      text: "#1b1608",
      ring: "rgba(255,210,64,.75)",
    },
    emerald: {
      bg: "#16a34a",
      text: "#ecfdf5",
      ring: "rgba(34,197,94,.55)",
    },
    ruby: {
      bg: "#dc2626",
      text: "#fff1f2",
      ring: "rgba(248,113,113,.55)",
    },
    slate: {
      bg: "rgba(255,255,255,.08)",
      text: "#e6e9ef",
      ring: "rgba(255,255,255,.18)",
    },
  };
  const t = tones[kind] || tones.slate;
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 999,
        padding: small ? "8px 14px" : "12px 18px",
        fontWeight: 900,
        fontSize: small ? 13 : 14,
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        transition: "filter .15s ease, transform .04s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      onMouseEnter={(e) =>
        !disabled && (e.currentTarget.style.filter = "brightness(1.04)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      {children}
    </button>
  );
}

/* ───────────────────── Status chip ───────────────────── */
const chipTone = (s) => {
  const k = String(s || "PENDING").toUpperCase();
  const map = {
    APPROVED: {
      bg: "rgba(16,185,129,.18)",
      text: "#a7f3d0",
      ring: "rgba(16,185,129,.32)",
    },
    REJECTED: {
      bg: "rgba(239,68,68,.18)",
      text: "#fecaca",
      ring: "rgba(239,68,68,.32)",
    },
    PENDING: {
      bg: "rgba(245,158,11,.18)",
      text: "#fde68a",
      ring: "rgba(245,158,11,.32)",
    },
    MORE_INFO_REQUIRED: {
      bg: "rgba(59,130,246,.18)",
      text: "#bfdbfe",
      ring: "rgba(59,130,246,.32)",
    },
  };
  return map[k] || map.PENDING;
};

function StatusPill({ value }) {
  const t = chipTone(value);
  const labelMap = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING: "PENDING",
    MORE_INFO_REQUIRED: "MORE INFO",
  };
  const raw = String(value || "PENDING").toUpperCase();
  const label = labelMap[raw] || raw;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        padding: "0 14px",
        minWidth: 110,
        borderRadius: 999,
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </span>
  );
}

/* ───────────────────── Simple Modal ───────────────────── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px,92vw)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.14)",
          background:
            "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
          boxShadow: "0 24px 48px rgba(0,0,0,.65)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: 14,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 900 }}>{title}</h3>
          <div style={{ marginLeft: "auto" }}>
            <LuxeBtn small onClick={onClose}>
              Close
            </LuxeBtn>
          </div>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════ Onboarding Queue (admin) ═══════════════════ */
export default function OnboardingQueue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState("");
  const [tab, setTab] = useState("all"); // all|PENDING|APPROVED|REJECTED|MORE_INFO_REQUIRED
  const [typeTab, setTypeTab] = useState("all"); // all|host|partner
  const [q, setQ] = useState("");

  // review modal
  const [revOpen, setRevOpen] = useState(false);
  const [revRow, setRevRow] = useState(null);

  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [storagePathUsed, setStoragePathUsed] = useState("");

  const load = async () => {
    setLoading(true);
    setBlockedMsg("");
    try {
      const base = collection(db, "onboarding");
      const snap = await getDocs(base);

      const list = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        list.push({
          id: d.id,
          userId: x.userId || x.uid || d.id, // 🔧 include uid fallback
          uid: x.uid || x.userId || null,
          email: x.email || "",
          type: x.type || "host",
          status: x.status || "PENDING",
          submittedAt: x.submittedAt?.toDate?.() || null,
          reviewedAt: x.reviewedAt?.toDate?.() || null,
          adminNote: x.adminNote || "",
          requiredDocuments: Array.isArray(x.requiredDocuments)
            ? x.requiredDocuments
            : [],
          // optional debug fields
          _raw: x,
        });
      });

      list.sort(
        (a, b) =>
          (b.submittedAt ? +b.submittedAt : 0) -
          (a.submittedAt ? +a.submittedAt : 0)
      );

      setRows(list);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Missing or insufficient permissions/i.test(msg)) {
        setBlockedMsg(
          "Firestore read blocked by security rules. Ensure your admin claim is set (request.auth.token.admin == true)."
        );
      } else {
        setBlockedMsg("Onboarding load error: " + msg);
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (typeTab !== "all") list = list.filter((r) => r.type === typeTab);
    if (tab !== "all") {
      list = list.filter(
        (r) => String(r.status || "PENDING").toUpperCase() === tab.toUpperCase()
      );
    }
    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) =>
        `${r.email} ${r.userId} ${r.uid || ""} ${r.status} ${r.type}`
          .toLowerCase()
          .includes(kw)
      );
    }
    return list;
  }, [rows, tab, typeTab, q]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      MORE_INFO_REQUIRED: 0,
      host: 0,
      partner: 0,
    };
    rows.forEach((r) => {
      const s = String(r.status || "PENDING").toUpperCase();
      if (c[s] != null) c[s] = (c[s] || 0) + 1;
      c[r.type] = (c[r.type] || 0) + 1;
    });
    return c;
  }, [rows]);

  /* -------------------- Storage docs loader (FIXED) -------------------- */
  async function listDocsForPossibleKeys(possibleKeys = []) {
    const tried = [];
    for (const key of possibleKeys) {
      const k = String(key || "").trim();
      if (!k) continue;
      const p = `kyc/${k}`;
      tried.push(p);

      const baseRef = ref(storage, p);

      // listAll returns { items: [] } even if folder empty
      const res = await listAll(baseRef);

      if (res?.items?.length) {
        const items = await Promise.all(
          res.items.map(async (it) => ({
            name: it.name,
            url: await getDownloadURL(it),
          }))
        );
        return { items, path: p, tried };
      }
    }
    return { items: [], path: "", tried };
  }

  const openReview = async (r) => {
    setRevRow(r);
    setRevOpen(true);

    setDocs([]);
    setDocsError("");
    setStoragePathUsed("");
    setDocsLoading(true);

    try {
      // 🔧 IMPORTANT: try multiple keys because your Storage UID != onboarding userId sometimes
      const possibleKeys = [
        r.userId,
        r.uid,
        r.id, // onboarding doc id sometimes equals uid
        r._raw?.firebaseUid,
        r._raw?.userUID,
      ].filter(Boolean);

      const { items, path, tried } = await listDocsForPossibleKeys(possibleKeys);

      if (items.length) {
        setDocs(items);
        setStoragePathUsed(path);
      } else {
        setDocs([]);
        setStoragePathUsed(tried?.length ? tried.join("  •  ") : "");
        setDocsError("No files found in Storage for the expected KYC folder.");
      }
    } catch (e) {
      const msg = String(e?.message || e);
      // Permission error is common with Storage rules
      if (/storage\/unauthorized|permission|unauthorized/i.test(msg)) {
        setDocsError(
          "Storage access denied by rules. Allow admins to read the kyc/* path, or use a Cloud Function to proxy access."
        );
      } else {
        setDocsError("Could not load Storage documents: " + msg);
      }
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const closeReview = () => {
    setRevOpen(false);
    setRevRow(null);
    setDocs([]);
    setDocsError("");
    setStoragePathUsed("");
  };

  // core writer – APPROVE / REJECT / MORE_INFO_REQUIRED
  const setStatus = async (row, next, reason = "", requiredDocs = []) => {
    if (!row?.userId || !row?.id) return;

    try {
      const refDoc = doc(db, "onboarding", row.id);

      await updateDoc(refDoc, {
        status: next,
        reviewedAt: serverTimestamp(),
        adminNote: reason || null,
        requiredDocuments: requiredDocs.length ? requiredDocs : null,
      });

      await addDoc(collection(db, "onboarding", row.id, "audits"), {
        action: next,
        reason: reason || null,
        requiredDocuments: requiredDocs.length ? requiredDocs : null,
        reviewedAt: serverTimestamp(),
      });

      // mirror into users/{uid}
      try {
        // Prefer uid if present; fallback to userId
        const userKey = row.uid || row.userId;
        await updateDoc(doc(db, "users", userKey), {
          kycStatus: next.toLowerCase(),
          kyc: {
            status: next.toLowerCase(),
            reviewedAt: serverTimestamp(),
            reason: reason || null,
            requiredDocuments: requiredDocs.length ? requiredDocs : null,
          },
        });
      } catch {
        // ignore if user doc missing
      }

      setRows((prev) =>
        prev.map((x) =>
          x.id === row.id
            ? {
                ...x,
                status: next,
                adminNote: reason || x.adminNote,
                requiredDocuments: requiredDocs.length
                  ? requiredDocs
                  : x.requiredDocuments,
              }
            : x
        )
      );
      closeReview();
    } catch (e) {
      alert("Could not update status: " + (e?.message || e));
    }
  };

  const handleMoreInfo = async (row) => {
    if (!row) return;
    const note = window.prompt(
      "Message to the host/partner (this will be shown on their KYC page):",
      "Please upload the remaining KYC documents."
    );
    if (note === null) return;

    const docsLine = window.prompt(
      "List the required documents (comma-separated, e.g. passport, utility_bill):",
      "passport, utility_bill"
    );
    const requiredDocs = docsLine
      ? docsLine
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    await setStatus(row, "MORE_INFO_REQUIRED", note, requiredDocs);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 28, margin: "6px 0 18px" }}>
        Admin
      </h1>

      <AdminHeader
        back
        title="Onboarding queue"
        subtitle="Host & partner KYC, waiting list and approvals."
      />

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,auto) 1fr repeat(3,auto)",
          gap: 10,
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "PENDING", label: `Pending ${counts.PENDING}` },
          { k: "APPROVED", label: `Approved ${counts.APPROVED}` },
          { k: "REJECTED", label: `Rejected ${counts.REJECTED}` },
          { k: "MORE_INFO_REQUIRED", label: `More info ${counts.MORE_INFO_REQUIRED}` },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: tab === x.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: tab === x.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {x.label}
          </button>
        ))}

        <span />

        {[
          { k: "all", label: "All types" },
          { k: "host", label: `Host ${counts.host || 0}` },
          { k: "partner", label: `Partner ${counts.partner || 0}` },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTypeTab(x.k)}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: typeTab === x.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: typeTab === x.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {x.label}
          </button>
        ))}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email / userid / status…"
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

        <LuxeBtn kind="gold" onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </LuxeBtn>
      </div>

      {blockedMsg ? (
        <div
          style={{
            margin: "10px 0 12px",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(253,224,71,.45)",
            background: "rgba(253,224,71,.10)",
            color: "#fde68a",
            fontWeight: 700,
          }}
        >
          {blockedMsg}
        </div>
      ) : null}

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
            fontWeight: 800,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Onboarding
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
                {["Type", "Email", "User", "Status", "Submitted", "Actions"].map(
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
                    No onboarding records.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                      {r.type}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{r.email || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{r.userId || r.uid || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusPill value={(r.status || "PENDING").toUpperCase()} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {r.submittedAt ? dayjs(r.submittedAt).format("YYYY-MM-DD HH:mm") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {String(r.status).toUpperCase() !== "APPROVED" && (
                          <LuxeBtn kind="emerald" small onClick={() => setStatus(r, "APPROVED")}>
                            Approve
                          </LuxeBtn>
                        )}
                        {String(r.status).toUpperCase() !== "REJECTED" && (
                          <LuxeBtn kind="ruby" small onClick={() => setStatus(r, "REJECTED")}>
                            Reject
                          </LuxeBtn>
                        )}
                        <LuxeBtn kind="gold" small onClick={() => openReview(r)}>
                          Review
                        </LuxeBtn>
                        {String(r.status).toUpperCase() !== "APPROVED" && (
                          <LuxeBtn kind="slate" small onClick={() => handleMoreInfo(r)}>
                            More info
                          </LuxeBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review modal */}
      <Modal open={revOpen} onClose={closeReview} title="KYC review">
        {!revRow ? null : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div className="muted">Type</div>
              <div style={{ textTransform: "capitalize" }}>{revRow.type}</div>

              <div className="muted">Email</div>
              <div>{revRow.email || "—"}</div>

              <div className="muted">User ID</div>
              <div>{revRow.userId || revRow.uid || "—"}</div>

              <div className="muted">Status</div>
              <div style={{ textTransform: "capitalize" }}>{revRow.status}</div>

              <div className="muted">Submitted</div>
              <div>
                {revRow.submittedAt ? dayjs(revRow.submittedAt).format("YYYY-MM-DD HH:mm") : "—"}
              </div>

              {revRow.adminNote ? (
                <>
                  <div className="muted">Admin note</div>
                  <div>{revRow.adminNote}</div>
                </>
              ) : null}

              {Array.isArray(revRow.requiredDocuments) && revRow.requiredDocuments.length ? (
                <>
                  <div className="muted">Requested docs</div>
                  <div>{revRow.requiredDocuments.join(", ")}</div>
                </>
              ) : null}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Documents</div>

              {docsLoading ? (
                <div className="muted">Loading documents from Storage…</div>
              ) : docsError ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(253,224,71,.35)",
                    background: "rgba(253,224,71,.08)",
                    color: "#fde68a",
                    fontWeight: 700,
                  }}
                >
                  {docsError}
                  {storagePathUsed ? (
                    <div style={{ marginTop: 8, fontWeight: 600, opacity: 0.85 }}>
                      Paths tried: <code style={{ opacity: 0.95 }}>{storagePathUsed}</code>
                    </div>
                  ) : null}
                </div>
              ) : docs.length === 0 ? (
                <div className="muted">
                  No files found. (If you can see files in Firebase Console, it’s almost always a UID/path mismatch.)
                  {storagePathUsed ? (
                    <>
                      <div style={{ marginTop: 8 }}>
                        Path used: <code> {storagePathUsed} </code>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 10, opacity: 0.8 }}>
                    Storage path: <code>{storagePathUsed}</code>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                      gap: 10,
                    }}
                  >
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
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.85,
                            marginBottom: 6,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
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
                            borderRadius: 10,
                          }}
                        >
                          <span style={{ fontSize: 12, opacity: 0.7 }}>Open</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <LuxeBtn onClick={closeReview}>Close</LuxeBtn>
              <LuxeBtn kind="emerald" onClick={() => setStatus(revRow, "APPROVED")}>
                Approve
              </LuxeBtn>
              <LuxeBtn kind="ruby" onClick={() => setStatus(revRow, "REJECTED")}>
                Reject
              </LuxeBtn>
              <LuxeBtn kind="slate" onClick={() => handleMoreInfo(revRow)}>
                More info
              </LuxeBtn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
