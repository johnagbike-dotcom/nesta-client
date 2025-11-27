// src/components/LuxuryPayout.js
import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function LuxuryPayout() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const baseRef = collection(db, "payouts");

    // 1) luxury / ordered version
    const orderedQ = query(
      baseRef,
      where("hostId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    let unsub = () => {};

    try {
      unsub = onSnapshot(
        orderedQ,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRows(items);
          setLoading(false);
        },
        async (err) => {
          console.debug(
            "[LuxuryPayout] ordered query failed, falling back:",
            err?.message
          );

          try {
            // 2) fallback – no orderBy
            const fallbackQ = query(
              baseRef,
              where("hostId", "==", user.uid)
            );
            const unsub2 = onSnapshot(
              fallbackQ,
              (snap2) => {
                const items2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
                // manual sort newest first
                items2.sort((a, b) => {
                  const aa = a?.createdAt?.toMillis?.() ?? 0;
                  const bb = b?.createdAt?.toMillis?.() ?? 0;
                  return bb - aa;
                });
                setRows(items2);
                setLoading(false);
              },
              (err2) => {
                console.warn(
                  "[LuxuryPayout] fallback query failed:",
                  err2?.message
                );
                setRows([]);
                setLoading(false);
              }
            );
            unsub = unsub2;
          } catch (inner) {
            console.warn(
              "[LuxuryPayout] could not start fallback:",
              inner?.message
            );
            setRows([]);
            setLoading(false);
          }
        }
      );
    } catch (e) {
      console.warn("[LuxuryPayout] init error:", e?.message);
      setRows([]);
      setLoading(false);
    }

    return () => unsub();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#191f25] border border-white/5 p-4 text-sm text-gray-200">
        Loading payouts…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-[#191f25] border border-white/5 p-4 text-sm text-gray-200">
        No payouts yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#191f25] border border-white/5 p-4">
      <h3 className="text-sm font-semibold mb-3 text-white">
        Recent payouts
      </h3>
      <ul className="space-y-2">
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between text-sm text-gray-100"
          >
            <span>{p.reference || "Payout"}</span>
            <span className="font-semibold">
              ₦{Number(p.amount || 0).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
