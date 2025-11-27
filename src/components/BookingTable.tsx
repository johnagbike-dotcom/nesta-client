// src/components/BookingTable.tsx
import { useCallback, useEffect, useState } from "react";
import {
  listBookings,
  verifyBooking,
  setBookingStatus,
  deleteBooking,
  exportCsvUrl,
} from "../api/bookings"; // adjust path if needed

type Booking = {
  id: string;
  createdAt: string;
  email: string;
  title: string;
  nights: number;
  totalNaira: number;
  provider: string;
  reference: string;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  gateway?: string | null;
};

export default function BookingTable() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Stable refresh that depends on the current query
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listBookings(q);
      // listBookings returns the parsed JSON; normalize to array if backend wraps it
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setRows(data as Booking[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onVerify = async (id: string) => {
    await verifyBooking(id);
    refresh();
  };
  const onConfirm = async (id: string) => {
    await setBookingStatus(id, "confirmed");
    refresh();
  };
  const onCancel = async (id: string) => {
    await setBookingStatus(id, "cancelled");
    refresh();
  };
  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this booking?")) return;
    await deleteBooking(id);
    refresh();
  };

  const csvHref = exportCsvUrl();

  return (
    <div style={{ padding: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button onClick={refresh}>Refresh</button>
        <a href={csvHref} target="_blank" rel="noopener noreferrer">
          <button>Export CSV</button>
        </a>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search id, email, title, provider"
          style={{ flex: 1 }}
        />
        <button onClick={refresh}>Search</button>
      </div>

      {loading && <div>Loading…</div>}
      {err && (
        <div style={{ color: "#ffb4b4", marginBottom: 8 }}>
          {err}
        </div>
      )}

      {/* Table */}
      <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              "ID",
              "Created",
              "Email",
              "Title",
              "Nights",
              "Total (₦)",
              "Provider",
              "Reference",
              "Status",
              "Gateway",
              "Actions",
            ].map((h) => (
              <th
                key={h}
                style={{ borderBottom: "1px solid #444", textAlign: "left", padding: 8 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td style={{ padding: 8 }}>{b.id}</td>
              <td style={{ padding: 8 }}>
                {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
              </td>
              <td style={{ padding: 8 }}>{b.email}</td>
              <td style={{ padding: 8 }}>{b.title}</td>
              <td style={{ padding: 8 }}>{b.nights}</td>
              <td style={{ padding: 8 }}>{Number(b.totalNaira || 0).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{b.provider}</td>
              <td style={{ padding: 8 }}>{b.reference}</td>
              <td style={{ padding: 8, textTransform: "capitalize" }}>{b.status}</td>
              <td style={{ padding: 8 }}>{b.gateway ?? "—"}</td>
              <td style={{ padding: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => onVerify(b.id)}>Verify</button>
                  <button onClick={() => onConfirm(b.id)}>Confirm</button>
                  <button onClick={() => onCancel(b.id)}>Cancel</button>
                  <button onClick={() => onDelete(b.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && !err && (
            <tr>
              <td colSpan={11} style={{ padding: 16, opacity: 0.8 }}>
                No bookings found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
} 