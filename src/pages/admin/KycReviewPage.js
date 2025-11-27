// src/pages/admin/KycReviewPage.js
import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";

const tone = {
  pending: { bg: "rgba(234,179,8,.18)", text: "#facc15" },
  reviewing: { bg: "rgba(59,130,246,.20)", text: "#93c5fd" },
  approved: { bg: "rgba(22,163,74,.20)", text: "#a7f3d0" },
  rejected: { bg: "rgba(239,68,68,.20)", text: "#fecaca" },
  none: { bg: "rgba(148,163,184,.18)", text: "#cbd5f5" },
};

function StatusPill({ value }) {
  const v = (value || "none").toLowerCase();
  const t = tone[v] || tone.none;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 90,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        textTransform: "capitalize",
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.text}33`,
      }}
    >
      {v}
    </span>
  );
}

export default function KycReviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qtext, setQtext] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const qref = query(
          collection(db, "kyc"),
          orderBy("submittedAt", "desc")
        );
        const snap = await getDocs(qref);
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        if (alive) setRows(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = qtext.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [
        r.name,
        r.email,
        r.phoneNumber,
        r.govIdType,
        r.govIdNumber,
        r.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, qtext]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 24, marginBottom: 10 }}>
        KYC review table
      </h1>

      <div style={{ marginBottom: 12 }}>
        <input
          value={qtext}
          onChange={(e) => setQtext(e.target.value)}
          placeholder="Search by name, email, phone, ID…"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 12px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,.50)",
            background: "rgba(15,23,42,.75)",
            color: "#e5e7eb",
          }}
        />
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,.50)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead
            style={{
              background: "rgba(15,23,42,.95)",
              textAlign: "left",
              color: "#9ca3af",
            }}
          >
            <tr>
              <th style={{ padding: "10px 12px" }}>Name</th>
              <th style={{ padding: "10px 12px" }}>Email</th>
              <th style={{ padding: "10px 12px" }}>Phone</th>
              <th style={{ padding: "10px 12px" }}>Gov ID</th>
              <th style={{ padding: "10px 12px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}
                >
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}
                >
                  No KYC records found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid rgba(148,163,184,.35)" }}
                >
                  <td style={{ padding: "9px 12px", color: "#e5e7eb" }}>
                    {r.name || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: "#cbd5f5" }}>
                    {r.email || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: "#cbd5f5" }}>
                    {r.phoneNumber || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: "#cbd5f5" }}>
                    {r.govIdType} {r.govIdNumber}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <StatusPill value={r.status || r.kycStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
