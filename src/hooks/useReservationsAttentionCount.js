// src/hooks/useReservationsAttentionCount.js
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

/**
* Live count of bookings needing attention for a host/partner.
* Matches:
*  - status in ["cancel_request","cancellation_requested","refund_requested"]
*  - OR cancelRequested === true
*  - OR request.type === "cancel" && request.state in ["pending","requested"]
*/
export default function useReservationsAttentionCount(hostUid) {
  const [count, setCount] = useState(0);
  const idsRef = useRef(new Set());

  useEffect(() => {
    if (!hostUid) return;

    const ATT_STATUSES = ["cancel_request", "cancellation_requested", "refund_requested"];
    const clean = () => {
      idsRef.current = new Set();
      setCount(0);
    };

    // 1) status-based
    const q1 = query(
      collection(db, "bookings"),
      where("hostId", "==", hostUid),
      where("status", "in", ATT_STATUSES)
    );

    // 2) boolean flag
    const q2 = query(
      collection(db, "bookings"),
      where("hostId", "==", hostUid),
      where("cancelRequested", "==", true)
    );

    // 3) nested request object (can't query on nested inequality reliably; subscribe to host set and filter client-side)
    const q3 = query(collection(db, "bookings"), where("hostId", "==", hostUid));

    const unsub1 = onSnapshot(q1, (snap) => {
      const s = new Set(idsRef.current);
      snap.forEach((d) => s.add(d.id));
      idsRef.current = s;
      setCount(s.size);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const s = new Set(idsRef.current);
      snap.forEach((d) => s.add(d.id));
      idsRef.current = s;
      setCount(s.size);
    });

    const unsub3 = onSnapshot(q3, (snap) => {
      const s = new Set(idsRef.current);
      snap.forEach((d) => {
        const x = d.data() || {};
        const req = x.request || x.cancelRequest || null;
        const isReq =
          req &&
          String(req.type || req.kind || "").toLowerCase() === "cancel" &&
          ["pending", "requested"].includes(String(req.state || req.status || "").toLowerCase());
        if (isReq) s.add(d.id);
      });
      idsRef.current = s;
      setCount(s.size);
    });

    return () => {
      unsub1(); unsub2(); unsub3(); clean();
    };
  }, [hostUid]);

  return count;
} 
 