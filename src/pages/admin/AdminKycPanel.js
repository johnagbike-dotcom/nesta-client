// src/pages/admin/AdminKycPanel.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import { useNavigate } from "react-router-dom";

export default function AdminKycPanel() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNavigate();

  const isAdmin = !!user && (profile?.isAdmin === true || profile?.role === "admin");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) {
      nav("/", { replace: true });
      return;
    }

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const qref = query(
          collection(db, "users"),
          where("kycStatus", "!=", "approved"),
          orderBy("kycStatus", "asc")
        );
        const snap = await getDocs(qref);

        // 🔧 FIX: spread Firestore data correctly
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (alive) setRows(list);
      } catch (e) {
        console.error(e);
        if (alive) setErr("Couldn’t load KYC records.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, isAdmin, nav]);

  const approve = async (uid) => {
    try {
      await updateDoc(doc(db, "users", uid), { kycStatus: "approved" });
      setRows((prev) => prev.map((r) => (r.id === uid ? { ...r, kycStatus: "approved" } : r)));
    } catch (e) {
      console.error(e);
      alert("Could not approve KYC.");
    }
  };

  const reject = async (uid) => {
    try {
      await updateDoc(doc(db, "users", uid), { kycStatus: "rejected" });
      setRows((prev) => prev.map((r) => (r.id === uid ? { ...r, kycStatus: "rejected" } : r)));
    } catch (e) {
      console.error(e);
      alert("Could not reject KYC.");
    }
  };

  if (!user) return null;

  return (
    <main className="container mx-auto px-4 py-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">KYC Reviews</h1>
          <p className="text-white/60 text-sm">
            Review host &amp; partner identity submissions.
          </p>
        </div>
        <button
          onClick={() => nav("/admin")}
          className="rounded-full px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10"
        >
          ← Back to admin
        </button>
      </div>

      {err && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-red-100 mb-4">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-white/70">Loading KYC submissions…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/60">No pending KYC right now.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="text-sm font-semibold">
                  {r.fullName || r.displayName || r.email || "Unknown user"}
                </div>
                <div className="text-xs text-white/50">
                  {r.email} • KYC: {r.kycStatus || "none"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approve(r.id)}
                  className="px-3 py-1 rounded-lg bg-emerald-500/80 text-xs font-semibold text-black hover:bg-emerald-400"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject(r.id)}
                  className="px-3 py-1 rounded-lg bg-red-500/80 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
