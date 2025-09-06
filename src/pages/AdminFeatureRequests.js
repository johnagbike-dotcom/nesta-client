// src/pages/AdminFeatureRequests.js
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminFeatureRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const q = query(
          collection(db, "featureRequests"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setErr("Failed to load feature requests.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const approve = async (row) => {
    try {
      setBusyId(row.id);
      const batch = writeBatch(db);

      // 1) mark listing as featured
      batch.update(doc(db, "listings", row.listingId), {
        isFeatured: true,
        updatedAt: serverTimestamp(),
      });

      // 2) remove the request (or you could mark as approved)
      batch.delete(doc(db, "featureRequests", row.id));

      await batch.commit();
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      console.error(e);
      alert("Could not approve. Check console.");
    } finally {
      setBusyId(null);
    }
  };

  const deny = async (row) => {
    try {
      setBusyId(row.id);
      await writeBatch(db)
        .delete(doc(db, "featureRequests", row.id))
        .commit();
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      console.error(e);
      alert("Could not deny. Check console.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold mb-6">Feature Requests</h1>

        {loading && <p className="text-white/70">Loading…</p>}
        {!loading && err && <p className="text-red-400">{err}</p>}
        {!loading && !err && rows.length === 0 && (
          <p className="text-white/70">No pending requests.</p>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-4">
            {rows.map((r) => (
              <article
                key={r.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-white/70">
                      Request ID: <span className="text-white">{r.id}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-white/70">Listing:</span>{" "}
                      <a
                        href={`/listing/${r.listingId}`}
                        className="text-amber-300 underline"
                      >
                        {r.listingId}
                      </a>
                    </div>
                    {r.hostUid && (
                      <div className="text-sm text-white/80">
                        Host UID: <span className="text-white">{r.hostUid}</span>
                      </div>
                    )}
                    {r.message && (
                      <div className="text-sm text-white/80">
                        Note: {r.message}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => approve(r)}
                      className="rounded-lg px-4 py-2 bg-amber-400 text-black font-semibold disabled:opacity-60"
                    >
                      {busyId === r.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => deny(r)}
                      className="rounded-lg px-4 py-2 border border-white/20 text-white hover:bg-white/10 disabled:opacity-60"
                    >
                      {busyId === r.id ? "Removing…" : "Deny"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}