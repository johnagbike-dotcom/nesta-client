// src/components/admin/kyc/KYCReviewModal.tsx
import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { listAll, ref, getDownloadURL } from "firebase/storage";

function KYCReviewModal({ open, onClose, userId, db, storage, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(null);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      try {
        // Load onboarding record
        const snap = await getDoc(doc(db, "onboarding", userId));
        if (snap.exists()) {
          setOnboarding(snap.data());
        } else {
          setOnboarding(null);
        }

        // Load uploaded files from Storage
        const folder = ref(storage, `kyc/${userId}`);
        const res = await listAll(folder);
        const urls = await Promise.all(res.items.map((i) => getDownloadURL(i)));
        setFiles(urls);
      } catch (e) {
        console.error("KYC review load error:", e);
      }
      setLoading(false);
    })();
  }, [open, userId, db, storage]);

  const doUpdate = async (status) => {
    if (!userId) return;
    try {
      // Update onboarding status
      await updateDoc(doc(db, "onboarding", userId), {
        status,
        reviewedAt: serverTimestamp(),
      });

      // Audit log
      await addDoc(collection(db, "onboarding", userId, "audits"), {
        status,
        notes,
        timestamp: serverTimestamp(),
      });

      if (onChanged) onChanged();
      onClose();
    } catch (e) {
      console.error("Approval error:", e);
      alert("Error updating status. Check console.");
    }
  };

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
          width: "min(900px,94vw)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.14)",
          background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.40))",
          backdropFilter: "blur(14px)",
          boxShadow: "0 24px 48px rgba(0,0,0,.45)",
          padding: 18,
        }}
      >
        <h2 style={{ margin: "0 0 14px", fontWeight: 900 }}>KYC Review</h2>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#bbb" }}>
            Loading…
          </div>
        ) : !onboarding ? (
          <div style={{ padding: 30, textAlign: "center", color: "#bbb" }}>
            No onboarding record found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div className="muted">User ID</div>
              <div>{onboarding.userId || userId}</div>

              <div className="muted">Email</div>
              <div>{onboarding.email || "—"}</div>

              <div className="muted">Type</div>
              <div style={{ textTransform: "capitalize" }}>{onboarding.type}</div>

              <div className="muted">Status</div>
              <div style={{ textTransform: "capitalize" }}>{onboarding.status}</div>

              <div className="muted">Submitted</div>
              <div>
                {onboarding.submittedAt
                  ? new Date(onboarding.submittedAt.seconds * 1000).toLocaleString()
                  : "—"}
              </div>
            </div>

            <hr style={{ opacity: 0.2 }} />

            <h3 style={{ fontWeight: 800 }}>Uploaded Documents</h3>
            {files.length === 0 && <div style={{ color: "#aaa" }}>No documents uploaded.</div>}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
                gap: 12,
              }}
            >
              {files.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  <img
                    src={url}
                    alt="KYC file"
                    style={{ width: "100%", height: 120, objectFit: "cover" }}
                  />
                </a>
              ))}
            </div>

            <hr style={{ opacity: 0.2 }} />

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 700 }}>Reviewer Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes for audit trail..."
                style={{
                  minHeight: 90,
                  borderRadius: 8,
                  padding: 10,
                  border: "1px solid rgba(255,255,255,.20)",
                  background: "rgba(255,255,255,.05)",
                  color: "#e7ebf2",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <button onClick={onClose} style={btn("slate")}>Close</button>
              <button onClick={() => doUpdate("rejected")} style={btn("ruby")}>Reject</button>
              <button onClick={() => doUpdate("approved")} style={btn("emerald")}>Approve</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function btn(type) {
  const colors = {
    emerald: "#16a34a",
    ruby: "#dc2626",
    slate: "#444",
  };
  return {
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 800,
    border: "none",
    cursor: "pointer",
    background: colors[type],
    color: "#fff",
  };
}

export default KYCReviewModal;
