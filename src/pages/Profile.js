// src/pages/Profile.js
import React, { useEffect, useState } from "react";
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
  const { user, profile, loading, logout, refreshProfile, isAdmin } = useAuth();

  // Local editable form state (mirrors Firestore users/{uid})
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    phone: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Seed the form once we have a profile
  useEffect(() => {
    if (!profile) return;
    setForm({
      email: user?.email ?? profile.email ?? "",
      displayName: profile.displayName ?? "",
      phone: profile.phone ?? "",
    });
  }, [profile, user]);

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

      // IMPORTANT: Role is READ-ONLY here. Do not update role from Profile page.
      const payload = {
        displayName: cleanDisplayName,
        phone: form.phone?.trim() || "",
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid), payload);
      await refreshProfile();

      setMessage(
        cleanDisplayName !== form.displayName
          ? "Profile updated. We removed contact info from your name to keep bookings on Nesta."
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

  const roleLabel = (profile?.role || "guest").toString();
  const rolePretty = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);

  return (
    <div className="p-6 max-w-2xl mx-auto text-slate-200">
      <h1 className="text-2xl font-semibold mb-1">My Profile</h1>
      <p className="text-sm text-slate-400 mb-6">
        Update your account details. Contact details are only revealed through Nesta
        after confirmed bookings and valid subscriptions.
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
            For security, we automatically remove phone numbers and emails from your name.
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
            Stored securely. Only surfaced in line with Nesta’s booking/subscription rules.
          </p>
        </div>

        {/* Role (READ-ONLY) */}
        <div>
          <label className="block text-sm mb-1">Role (read-only)</label>
          <div className="w-full rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2 flex items-center gap-2">
            <span className="text-slate-200 font-medium">{rolePretty}</span>
            {isAdmin && (
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200">
                Admin view
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Role changes happen only via role-selection / admin verification flows.
          </p>
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
            Current role: <strong>{roleLabel}</strong>
          </span>
        </div>
      </form>
    </div>
  );
}
