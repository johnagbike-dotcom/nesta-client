// src/pages/DevBackfillOwner.js
import React, { useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function DevBackfillOwner() {
  const { user } = useAuth();
  const [log, setLog] = useState([]);

  const push = (m) => setLog((l) => [...l, m]);

  const run = async () => {
    if (!user) return push("❌ Sign in first.");
    const snap = await getDocs(collection(db, "listings"));
    let count = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.ownerId) {
        await updateDoc(doc(db, "listings", d.id), { ownerId: user.uid });
        count++;
      }
    }
    push(`✅ Backfilled ${count} listings with ownerId=${user.uid}`);
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <h1>Backfill ownerId (dev)</h1>
        <button className="btn" onClick={run}>Run Backfill</button>
        <ul style={{ marginTop: 12 }}>
          {log.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
    </main>
  );
}