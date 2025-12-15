// src/pages/admin/ManageUsers.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import DateRangeBar from "../../components/DateRangeBar";
import { withRangeParams } from "../../lib/api";
import LuxeBtn from "../../components/LuxeBtn";
import AdminLayout from "../../layouts/AdminLayout";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import { getAuth } from "firebase/auth";

/* ───────────────── axios ───────────────── */
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(/\/$/, ""),
  timeout: 15000,
});

/* ✅ attach Firebase ID token to every request */
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const u = auth.currentUser;
  if (u) {
    const token = await u.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ─────────────── helpers ─────────────── */
const getArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.users)) return data.users;
  return [];
};

const pretty = (s) =>
  !s ? "—" : String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();

const Badge = ({ label, tone = "slate" }) => {
  const map = {
    green: { bg: "#0ea75a", text: "#e8fff3", ring: "#0a7e43" },
    red: { bg: "#cf2336", text: "#ffe9ec", ring: "#a51a2a" },
    amber: { bg: "#d19b00", text: "#fff7e0", ring: "#a77a00" },
    slate: { bg: "#6b7280", text: "#eef2ff", ring: "#555b66" },
    blue: { bg: "#2563eb", text: "#dbeafe", ring: "#1d4ed8" },
    purple: { bg: "#7c3aed", text: "#f3e8ff", ring: "#6d28d9" }, // super admin
  };
  const c = map[tone] || map.slate;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 96,
        height: 34,
        padding: "0 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.ring}`,
        fontWeight: 700,
        fontSize: 13,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)",
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
};

const toneForRole = (role, adminLevel) => {
  const r = String(role || "guest").toLowerCase();
  if (r === "admin" && String(adminLevel || "").toLowerCase() === "super") return "purple";
  if (r === "admin") return "red";
  if (r === "host") return "blue";
  if (r === "partner") return "amber";
  return "slate";
};

const toneForStatus = (status) => {
  const s = String(status || "active").toLowerCase();
  if (s === "active") return "green";
  if (s === "disabled" || s === "suspended") return "red";
  return "slate";
};

/* ─────────────── Action menu ─────────────── */
function ActionMenu({
  row,
  isSuperAdmin,
  busy,
  onSetRole,
  onToggleStatus,
  onMakeAdminStaff,
  onMakeSuperAdmin,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 12,
    fontWeight: 900,
    fontSize: 13,
    background: "rgba(255,255,255,.08)",
    color: "#e6e9ef",
    border: "1px solid rgba(255,255,255,.18)",
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
    transition: "filter .15s ease, transform .04s ease",
    whiteSpace: "nowrap",
  };

  const menuBtn = {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    color: "#e6e9ef",
    fontSize: 14,
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  const isRowAdmin = String(row.role || "").toLowerCase() === "admin";
  const isRowSuper = String(row.adminLevel || "").toLowerCase() === "super";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !busy && setOpen((v) => !v)}
        style={btnBase}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
      >
        Manage ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "42px",
            right: 0,
            minWidth: 220,
            borderRadius: 14,
            background: "rgba(22,22,26,.98)",
            border: "1px solid rgba(255,255,255,.10)",
            boxShadow: "0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)",
            backdropFilter: "blur(6px)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              fontSize: 11,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.55)",
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}
          >
            Set role
          </div>

          {[
            { key: "host", label: "Host" },
            { key: "partner", label: "Partner" },
            { key: "guest", label: "Guest" },
          ].map((opt) => (
            <button
              key={opt.key}
              disabled={busy || isRowAdmin} // admin locked by backend PATCH
              onClick={() => {
                onSetRole(opt.key);
                setOpen(false);
              }}
              style={menuBtn}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title={isRowAdmin ? "Admins are locked by backend PATCH" : ""}
            >
              {opt.label}
            </button>
          ))}

          <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: 8 }}>
            <button
              disabled={busy || isRowAdmin}
              onClick={() => {
                onToggleStatus();
                setOpen(false);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,.10)",
                background:
                  row.status === "active"
                    ? "linear-gradient(180deg,#ff8a8a,#ff5959)"
                    : "linear-gradient(180deg,#34d399,#10b981)",
                color: "#1a1414",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
              title={isRowAdmin ? "Admins are locked by backend PATCH" : ""}
            >
              {row.status === "active" ? "Disable" : "Enable"}
            </button>
          </div>

          {/* SUPER ADMIN ONLY */}
          {isSuperAdmin && (
            <>
              <div
                style={{
                  padding: "10px 10px",
                  fontSize: 11,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.55)",
                  borderTop: "1px solid rgba(255,255,255,.06)",
                }}
              >
                Admin controls
              </div>

              {!isRowAdmin && (
                <button
                  disabled={busy}
                  onClick={() => {
                    onMakeAdminStaff();
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    border: "none",
                    background: "transparent",
                    color: "#e6e9ef",
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Make Admin (Staff)
                </button>
              )}

              {isRowAdmin && !isRowSuper && (
                <button
                  disabled={busy}
                  onClick={() => {
                    onMakeSuperAdmin();
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    border: "none",
                    background: "transparent",
                    color: "#e6e9ef",
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Promote to Super Admin
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────── component ───────────────── */
export default function ManageUsers() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const isSuperAdmin = String(profile?.adminLevel || "").toLowerCase() === "super";

  const [range, setRange] = useState({ from: "", to: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [q, setQ] = useState("");
  const [roleTab, setRoleTab] = useState("all");
  const [statusTab, setStatusTab] = useState("any");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const normalizeUser = (u) => ({
    id: u.id || u._id || u.uid,
    email: u.email || "-",
    name: u.name || u.displayName || "-",
    role: (u.role || u.type || "guest").toLowerCase(),
    adminLevel: (u.adminLevel || "").toLowerCase(),
    status: (u.disabled ? "disabled" : "active").toLowerCase(),
    disabled: !!u.disabled,
    createdAt: u.createdAt || u.created_at || u.createdAtMillis || null,
    lastLogin: u.lastLogin || u.lastLoginAt || u.last_sign_in || null,
  });

  const load = async (forcedRange) => {
    setLoading(true);
    try {
      const r = forcedRange || range;
      // Your backend users route doesn’t support date range filtering yet,
      // but we keep this for export symmetry (safe if unused).
      const url = withRangeParams("/admin/users?status=all&role=all&page=1&limit=200", r);

      const res = await api.get(url);
      const out = getArray(res.data);
      setRows(out.map(normalizeUser));
      setPage(1);
    } catch (e) {
      console.error("ManageUsers load failed:", e);
      const code = e?.response?.status;
      if (code === 401 || code === 403) {
        window.alert("Unauthorized. Confirm your Firestore users/{uid}.role is 'admin'.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (roleTab !== "all") list = list.filter((r) => r.role === roleTab);
    if (statusTab !== "any") list = list.filter((r) => r.status === statusTab);
    const kw = q.trim().toLowerCase();
    if (kw) list = list.filter((r) => `${r.email} ${r.name} ${r.id}`.toLowerCase().includes(kw));
    return list;
  }, [rows, q, roleTab, statusTab]);

  const counts = useMemo(() => {
    const c = { all: rows.length, guest: 0, host: 0, partner: 0, admin: 0, active: 0, disabled: 0 };
    rows.forEach((r) => {
      if (c[r.role] !== undefined) c[r.role] += 1;
      if (r.status === "active") c.active++;
      else c.disabled++;
    });
    return c;
  }, [rows]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageItems = useMemo(() => {
    const s = (page - 1) * perPage;
    return filtered.slice(s, s + perPage);
  }, [filtered, page, perPage]);

  const patchUser = async (id, body) => {
    try {
      await api.patch(`/admin/users/${encodeURIComponent(id)}`, body);
      return true;
    } catch (e) {
      console.error("PATCH failed:", e?.response?.data || e.message);
      return false;
    }
  };

  const setAdminLevel = async (id, level) => {
    try {
      await api.post(`/admin/users/${encodeURIComponent(id)}/admin`, { level });
      return true;
    } catch (e) {
      console.error("PROMOTION failed:", e?.response?.data || e.message);
      return false;
    }
  };

  const setRole = async (row, role) => {
    if (!row?.id) return;

    // Admin promotion is handled by /admin endpoint only (super admin)
    if (role === "admin") {
      if (!isSuperAdmin) return;
      await promoteToAdminStaff(row);
      return;
    }

    setBusyId(row.id);
    const prev = rows.slice();

    setRows(rows.map((r) => (r.id === row.id ? { ...r, role } : r)));

    const ok = await patchUser(row.id, { role });
    if (!ok) setRows(prev);

    setBusyId(null);
  };

  const setStatus = async (row, status) => {
    if (!row?.id) return;

    setBusyId(row.id);
    const prev = rows.slice();

    const disabled = status === "disabled";
    setRows(rows.map((r) => (r.id === row.id ? { ...r, status, disabled } : r)));

    const ok = await patchUser(row.id, { disabled });
    if (!ok) setRows(prev);

    setBusyId(null);
  };

  const promoteToAdminStaff = async (row) => {
    if (!row?.id) return;
    if (!isSuperAdmin) return;

    setBusyId(row.id);
    const prev = rows.slice();

    setRows(
      rows.map((r) =>
        r.id === row.id ? { ...r, role: "admin", adminLevel: "staff" } : r
      )
    );

    const ok = await setAdminLevel(row.id, "staff");
    if (!ok) setRows(prev);

    setBusyId(null);
  };

  const promoteToSuperAdmin = async (row) => {
    if (!row?.id) return;
    if (!isSuperAdmin) return;

    setBusyId(row.id);
    const prev = rows.slice();

    setRows(
      rows.map((r) =>
        r.id === row.id ? { ...r, role: "admin", adminLevel: "super" } : r
      )
    );

    const ok = await setAdminLevel(row.id, "super");
    if (!ok) setRows(prev);

    setBusyId(null);
  };

  /* ✅ token-safe CSV export */
  const exportUsersCsv = async () => {
    try {
      const url = withRangeParams("/admin/users/export.csv", range);
      const res = await api.get(url, { responseType: "blob" });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const href = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `users-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(href);
    } catch (e) {
      console.error("CSV export failed:", e);
      window.alert("Failed to export CSV (check admin auth / backend).");
    }
  };

  const TabBtn = ({ active, label, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.12)",
        background: active ? "#413cff" : "rgba(255,255,255,.06)",
        color: active ? "#eef2ff" : "#cfd3da",
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "filter .12s ease, transform .04s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      {label}
    </button>
  );

  return (
    <AdminLayout title="Manage Users" subtitle="Assign roles, disable users, promote admins (super admin only).">
      <DateRangeBar range={range} onChange={setRange} />

      <div className="flex items-center gap-3" style={{ margin: "10px 0 14px" }}>
        <LuxeBtn kind="gold" onClick={exportUsersCsv} title="Export Users CSV">
          Export Users CSV
        </LuxeBtn>
      </div>

      {/* Tabs + search */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,auto) 1fr auto",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <TabBtn
          label={`All ${counts.all}`}
          active={roleTab === "all" && statusTab === "any"}
          onClick={() => {
            setRoleTab("all");
            setStatusTab("any");
            setPage(1);
          }}
        />
        <TabBtn
          label={`Guests ${counts.guest}`}
          active={roleTab === "guest"}
          onClick={() => {
            setRoleTab("guest");
            setStatusTab("any");
            setPage(1);
          }}
        />
        <TabBtn
          label={`Hosts ${counts.host}`}
          active={roleTab === "host"}
          onClick={() => {
            setRoleTab("host");
            setStatusTab("any");
            setPage(1);
          }}
        />
        <TabBtn
          label={`Partners ${counts.partner}`}
          active={roleTab === "partner"}
          onClick={() => {
            setRoleTab("partner");
            setStatusTab("any");
            setPage(1);
          }}
        />
        <TabBtn
          label={`Admins ${counts.admin}`}
          active={roleTab === "admin"}
          onClick={() => {
            setRoleTab("admin");
            setStatusTab("any");
            setPage(1);
          }}
        />
        <TabBtn
          label={`Active ${counts.active}`}
          active={statusTab === "active"}
          onClick={() => {
            setStatusTab("active");
            setRoleTab("all");
            setPage(1);
          }}
        />

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search email, name, id…"
          style={{
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "#dfe3ea",
            padding: "0 12px",
          }}
        />

        <LuxeBtn kind="cobalt" onClick={() => load()} title="Refresh directory">
          Refresh
        </LuxeBtn>
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 800,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Users
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 1100,
            }}
          >
            <thead>
              <tr style={{ background: "rgba(255,255,255,.02)", color: "#aeb6c2", textAlign: "left" }}>
                {["User", "Role", "Status", "Created", "Last login", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    No users.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 800 }}>{r.email}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>
                        {r.name} • <span style={{ opacity: 0.6 }}>{r.id}</span>
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <Badge
                        label={
                          r.role === "admin" && r.adminLevel === "super"
                            ? "Super Admin"
                            : pretty(r.role || "guest")
                        }
                        tone={toneForRole(r.role, r.adminLevel)}
                      />
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <Badge label={pretty(r.status || "active")} tone={toneForStatus(r.status)} />
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {r.createdAt ? dayjs(r.createdAt).format("YYYY-MM-DD") : "—"}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {r.lastLogin ? dayjs(r.lastLogin).format("YYYY-MM-DD") : "—"}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <ActionMenu
                        row={r}
                        isSuperAdmin={isSuperAdmin}
                        busy={busyId === r.id}
                        onSetRole={(role) => setRole(r, role)}
                        onToggleStatus={() =>
                          setStatus(r, r.status === "active" ? "disabled" : "active")
                        }
                        onMakeAdminStaff={() => promoteToAdminStaff(r)}
                        onMakeSuperAdmin={() => promoteToSuperAdmin(r)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ color: "#aeb6c2", fontSize: 13 }}>
            Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              style={{
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,.06)",
                color: "#e6e9ef",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                color: "#cfd3da",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              Prev
            </button>

            <div style={{ width: 90, textAlign: "center", color: "#cfd3da" }}>
              Page {page} of {lastPage}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                color: "#cfd3da",
                cursor: page >= lastPage ? "not-allowed" : "pointer",
                opacity: page >= lastPage ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
