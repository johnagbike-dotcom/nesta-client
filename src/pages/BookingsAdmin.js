// src/pages/BookingsAdmin.js
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000/api";

function Chip({ label, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-700 text-gray-100",
    green: "bg-green-700 text-green-100",
    red: "bg-red-700 text-red-100",
    yellow: "bg-yellow-700 text-yellow-100",
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${tones[tone] || tones.gray}`}>{label}</span>;
}

export default function BookingsAdmin() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/bookings`);
      const j = await r.json();
      setRows(j || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // auto refresh every 20s
    const t = setInterval(fetchRows, 20000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.email, r.title, r.provider, r.reference, r.status, r.gateway]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term))
    );
  }, [rows, q]);

  const exportCSV = () => {
    const headers = ["id", "email", "title", "nights", "amountN", "provider", "reference", "status", "gateway"];
    const lines = [headers.join(",")].concat(
      filtered.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifyAgain = async (r) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: r.provider, reference: r.reference }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "verify failed");
      alert(j.ok ? "Re-verified: confirmed" : "Re-verified: not confirmed");
      fetchRows();
    } catch (e) {
      console.error(e);
      alert("Verification call failed.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-semibold">Bookings</h1>
        <div className="flex gap-2">
          <button onClick={fetchRows} className="px-3 py-2 rounded bg-gray-700">Refresh</button>
          <button onClick={exportCSV} className="px-3 py-2 rounded bg-gray-700">Export CSV</button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, provider, reference, status…"
        className="w-full mb-4 px-3 py-2 rounded bg-gray-800 border border-gray-700"
      />

      <div className="overflow-x-auto rounded border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left p-2">Created (id)</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Title</th>
              <th className="text-right p-2">Nights</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Provider</th>
              <th className="text-left p-2">Reference</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Gateway</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-3" colSpan={10}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td className="p-3" colSpan={10}>No bookings.</td></tr>
            )}
            {!loading &&
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-800">
                  <td className="p-2 text-gray-400">{r.id}</td>
                  <td className="p-2">{r.email}</td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2 text-right">{r.nights}</td>
                  <td className="p-2 text-right">₦{Number(r.amountN || 0).toLocaleString()}</td>
                  <td className="p-2 uppercase">{r.provider}</td>
                  <td className="p-2">{r.reference}</td>
                  <td className="p-2">
                    {r.status === "confirmed" ? <Chip label="confirmed" tone="green" /> :
                     r.status === "cancelled" ? <Chip label="cancelled" tone="red" /> :
                     <Chip label="pending" tone="yellow" />}
                  </td>
                  <td className="p-2">
                    {r.gateway ? <Chip label={r.gateway} tone={r.gateway === "success" ? "green" : "red"} /> : <Chip label="-" />}
                  </td>
                  <td className="p-2">
                    <button onClick={() => verifyAgain(r)} className="px-2 py-1 rounded bg-gray-700">
                      Verify
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}