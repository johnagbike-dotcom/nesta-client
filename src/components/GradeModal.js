// src/components/GradeModal.js
import React, { useEffect, useState } from "react";
import LuxeBtn from "./LuxeBtn";

const BACKDROP = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", zIndex: 60
};
const CARD = {
  width: "min(860px, 92vw)",
  background: "rgba(20,20,22,.96)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,.45)",
  color: "#e8eaee",
};

export default function GradeModal({ open, onClose, listing, onSave }) {
  const [grade, setGrade] = useState("Not graded");
  const [note, setNote]   = useState("");

  useEffect(() => {
    if (!open) return;
    setGrade(listing?.grade || "Not graded");
    setNote(listing?.qualityNote || "");
  }, [open, listing]);

  if (!open) return null;

  return (
    <div style={BACKDROP} onClick={onClose}>
      <div style={CARD} onClick={(e)=>e.stopPropagation()}>
        <div style={{ padding: 16, borderBottom:"1px solid rgba(255,255,255,.08)", fontWeight: 900 }}>
          Grade Listing — {listing?.title || "Listing"}
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ fontSize: 13, opacity: .9 }}>Grade</label>
          <select
            value={grade}
            onChange={(e)=>setGrade(e.target.value)}
            style={{
              height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)", color: "#eef2ff", padding: "0 12px", fontWeight: 700
            }}
          >
            {["Not graded","B","A","Elite"].map(g => <option key={g}>{g}</option>)}
          </select>

          <label style={{ fontSize: 13, opacity: .9, marginTop: 8 }}>Quality note</label>
          <textarea
            value={note}
            onChange={(e)=>setNote(e.target.value)}
            rows={5}
            placeholder="e.g., Great finish & lighting. Update bathroom photos to match."
            style={{
              borderRadius: 12, border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)", color: "#eef2ff", padding: 12, resize: "vertical"
            }}
          />

          <div style={{ display:"flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <LuxeBtn kind="slate" onClick={onClose}>Cancel</LuxeBtn>
            <LuxeBtn kind="gold" onClick={()=>onSave({ grade, qualityNote: note })}>Save Grade</LuxeBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
