// src/pages/Profile.js
import React, { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

/**
 * Strip obvious emails and phone numbers from any free-text field.
 * We keep phone as a dedicated field, but we do NOT allow contact
 * details in displayName for anti-leakage / luxury policy.
 */
function stripContactInfo(raw) {
  if (!raw) return "";
  let s = String(raw);

  // Remove emails
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]");

  // Remove phone-like sequences: +234..., 080..., etc. 7+ digits with separators
  s = s.replace(/\+?\d[\d\s\-().]{6,}\d/g, "[number removed]");

  return s.trim();
}

export default function Profile() {
  const { user, profile, isAdmin, loading, logout, refreshProfile } = useAuth();

  // Local editable form state (mirrors Firestore users/{uid})
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    phone: "",
    role: "guest",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Seed the form once we have a profile
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      email: user?.email ?? profile.email ?? "",
      displayName: profile.displayName ?? "",
      phone: profile.phone ?? "",
      role: (profile.role ?? "guest").toLowerCase(),
    }));
  }, [profile, user]);

  // Permission rules:
  // - Everyone can edit displayName/phone.
  // - Guests can switch to "host".
  // - Only admins can assign "admin".
  const roleOptions = useMemo(() => {
    const base = ["guest", "host"];
    return isAdmin ? [...base, "admin"] : base;
  }, [isAdmin]);

  const canChangeRole = useMemo(() => {
    if (!profile) return false;
    if (isAdmin) return true;
    // Non-admins can only toggle between guest/host
    return ["guest", "host"].includes(profile.role?.toLowerCase() ?? "guest");
  }, [profile, isAdmin]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setMessage("");

      // Enforce luxury anti-leakage: no emails/phones in displayName
      const cleanDisplayName = stripContactInfo(form.displayName);

      // Build the update payload respecting permissions
      const payload = {
        displayName: cleanDisplayName,
        phone: form.phone?.trim() || "",
        updatedAt: serverTimestamp(),
      };

      if (canChangeRole) {
        // If non-admin, clamp role to guest/host; admins can set any option in roleOptions
        const requested = (form.role || "guest").toLowerCase();
        payload.role = isAdmin
          ? requested
          : ["guest", "host"].includes(requested)
          ? requested
          : "guest";
      }

      await updateDoc(doc(db, "users", user.uid), payload);
      await refreshProfile();
      setMessage(
        cleanDisplayName !== form.displayName
          ? "Profile updated. We’ve cleaned any contact info from your name to keep bookings on Nesta."
          : "Profile updated."
      );
    } catch (err) {
      console.error(err);
      setMessage(err?.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-slate-200">
        <div className="animate-pulse">Loading your profile…</div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="p-6 text-slate-200">
        <p>You’re not signed in.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto text-slate-200">
      <h1 className="text-2xl font-semibold mb-1">My Profile</h1>
      <p className="text-sm text-slate-400 mb-6">
        Update your account details. Contact details are only revealed to guests
        through Nesta after confirmed bookings and valid subscriptions.
      </p>

      {message && (
        <div className="mb-4 rounded-md bg-slate-800/60 border border-slate-700 px-4 py-2 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={onSave} className="space-y-5">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            value={form.email}
            readOnly
            className="w-full rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2 text-slate-200 cursor-not-allowed"
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm mb-1">Display name</label>
          <input
            name="displayName"
            value={form.displayName}
            onChange={onChange}
            placeholder="Nesta Host"
            className="w-full rounded-md bg-slate-900/60 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            For security, we automatically remove phone numbers and emails from
            your name. Guests will only see verified contacts at the right time
            in the booking journey.
          </p>
        </div>

        {/* Phone (internal contact) */}
        <div>
          <label className="block text-sm mb-1">Phone (kept private)</label>
          <input
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="+234…"
            className="w-full rounded-md bg-slate-900/60 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            This phone number is stored securely and only surfaced to verified
            guests in line with Nesta’s booking and subscription rules.
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select
            name="role"
            value={form.role}
            onChange={onChange}
            disabled={!canChangeRole}
            className={`w-full rounded-md px-3 py-2 border ${
              canChangeRole
                ? "bg-slate-900/60 border-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                : "bg-slate-800/50 border-slate-700 cursor-not-allowed opacity-70"
            }`}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          {!canChangeRole && (
            <p className="mt-1 text-xs text-slate-400">
              Only administrators can change this role.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-pink-600 hover:bg-pink-500 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm"
          >
            Log out
          </button>

          <span className="ml-auto text-xs text-slate-400">
            Current role: <strong>{profile?.role ?? "guest"}</strong>
            {isAdmin && " (admin)"}
          </span>
        </div>
      </form>
    </div>
  );
}
