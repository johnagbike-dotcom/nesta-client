import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

const ngn = (n) => `₦${Number(n || 0).toLocaleString()}`;

// status helpers
const isConfirmed = (s) => ["confirmed", "paid"].includes(String(s||"").toLowerCase());
const isCancelled = (s) => String(s||"").toLowerCase() === "cancelled";
const isRefunded  = (s) => String(s||"").toLowerCase() === "refunded";

export default function ReservationsSummary({ hostUid, commissionRate = 0.10 }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!hostUid) return;
    const qRef = query(collection(db, "bookings"), where("hostId", "==", hostUid));
    const unsub = onSnapshot(qRef, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [hostUid]);

  const kpi = useMemo(() => {
    const needs = rows.filter((r) => r.cancellationRequested === true).length;
    const confirmed = rows.filter((r) => isConfirmed(r.status)).length;
    const cancelled = rows.filter((r) => isCancelled(r.status)).length;
    const refunded  = rows.filter((r) => isRefunded(r.status)).length;
    const grossN    = rows
      .filter((r) => isConfirmed(r.status))
      .reduce((sum, r) => sum + Number(r.amountN || r.total || 0), 0);
    const commissionN = Math.floor(grossN * commissionRate);
    return { needs, confirmed, cancelled, refunded, grossN, commissionN };
  }, [rows, commissionRate]);

  const Tile = ({ label, value, tone="slate" }) => {
    const tones = {
      amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
      green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
      red:   "border-red-400/30 bg-red-500/10 text-red-200",
      slate: "border-white/15 bg-white/5 text-white/80",
    };
    return (
      <div className={`rounded-xl border p-3 ${tones[tone]}`}>
        <div className="text-xs opacity-90">{label}</div>
        <div className="text-2xl font-extrabold mt-1">{value}</div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Tile label="Needs attention" value={kpi.needs} tone="amber" />
      <Tile label="Confirmed" value={kpi.confirmed} tone="green" />
      <Tile label="Cancelled" value={kpi.cancelled} />
      <Tile label="Refunded" value={kpi.refunded} />
      <Tile label="Gross Revenue" value={ngn(kpi.grossN)} />
      <Tile label="Commission (est.)" value={ngn(kpi.commissionN)} />
    </div>
  );
}
