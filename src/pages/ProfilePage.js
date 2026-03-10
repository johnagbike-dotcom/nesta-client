// src/pages/ProfilePage.js
import React, { useEffect, useRef, useState } from "react";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import BackButton from "../components/BackButton";

const MAX_MB = 5;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function stripContactInfo(raw) {
  if (!raw) return "";
  let s = String(raw);
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]");
  s = s.replace(/\+?\d[\d\s\-().]{6,}\d/g, "[number removed]");
  return s.trim();
}

function Avatar({ src, displayName, size = 96 }) {
  const initials = (displayName || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      flexShrink: 0, border: "2px solid rgba(201,168,76,0.35)",
      background: "rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "rgba(201,168,76,0.85)",
      letterSpacing: "0.04em",
    }}>
      {src
        ? <img src={src} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials}
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, loading, logout, refreshProfile, isAdmin } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm]                 = useState({ displayName: "", phone: "" });
  const [photoURL, setPhotoURL]         = useState("");
  const [previewURL, setPreviewURL]     = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [message, setMessage]           = useState({ text: "", type: "" });

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName ?? user?.displayName ?? "",
      phone: profile.phone ?? "",
    });
    setPhotoURL(profile.photoURL || user?.photoURL || "");
  }, [profile, user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setMessage({ text: "Please select a JPEG, PNG, or WebP image.", type: "error" });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setMessage({ text: `Image must be under ${MAX_MB}MB.`, type: "error" });
      return;
    }
    setMessage({ text: "", type: "" });
    setSelectedFile(file);
    setPreviewURL(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!selectedFile || !user) return photoURL;
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
      await uploadBytes(storageRef, selectedFile, { contentType: selectedFile.type });
      return await getDownloadURL(storageRef);
    } catch (err) {
      throw new Error("Photo upload failed: " + err.message);
    }
  }

  const onSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setMessage({ text: "", type: "" });

    if (!form.displayName.trim()) {
      setMessage({ text: "Display name cannot be empty.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const cleanName = stripContactInfo(form.displayName);
      const newPhotoURL = await uploadPhoto();

      // Sync to Firebase Auth
      await updateAuthProfile(auth.currentUser, {
        displayName: cleanName,
        ...(newPhotoURL ? { photoURL: newPhotoURL } : {}),
      });

      // Sync to Firestore users
      await updateDoc(doc(db, "users", user.uid), {
        displayName: cleanName,
        phone: form.phone?.trim() || "",
        ...(newPhotoURL ? { photoURL: newPhotoURL } : {}),
        updatedAt: serverTimestamp(),
      });

      // Sync to users_public so chat/inbox avatar updates immediately
      await setDoc(doc(db, "users_public", user.uid), {
        displayName: cleanName,
        photoURL: newPhotoURL || photoURL || "",
      }, { merge: true });

      await refreshProfile();
      setPhotoURL(newPhotoURL || photoURL);
      setPreviewURL(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setMessage({
        text: cleanName !== form.displayName
          ? "Profile updated. We removed contact info from your name to keep bookings secure."
          : "Profile updated successfully.",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      setMessage({ text: err?.message || "Could not update profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] px-4 text-white">
      <div className="max-w-2xl mx-auto p-6 text-white/50 text-sm animate-pulse">Loading your profile…</div>
    </main>
  );

  if (!user || !profile) return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] px-4 text-white">
      <div className="max-w-2xl mx-auto p-6 text-white/50 text-sm">You're not signed in.</div>
    </main>
  );

  const roleLabel   = (profile?.role || "guest").toString();
  const rolePretty  = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  const currentPhoto = previewURL || photoURL;

  const inputClass   = "w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/12 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/60 transition-colors";
  const readonlyClass = "w-full px-4 py-2.5 rounded-xl bg-black/20 border border-white/8 text-sm text-white/40 cursor-not-allowed";
  const labelClass   = "block text-[11px] uppercase tracking-wider text-white/40 mb-1.5";

  return (
    <main className="min-h-screen bg-[#05070a] pt-[calc(var(--topbar-h,88px)+24px)] pb-20 px-4 text-white">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back + Header */}
        <div>
          <BackButton fallback="/dashboard" />
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80">Account</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight">Your Profile</h1>
            <p className="mt-2 text-sm text-white/50">
              Tune your Nesta identity. Contact details are surfaced to guests only through our secure booking flow.
            </p>
          </div>
        </div>

        {/* Message banner */}
        {message.text && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${
            message.type === "error"
              ? "bg-red-900/25 border-red-500/40 text-red-300"
              : "bg-emerald-900/25 border-emerald-500/35 text-emerald-300"
          }`}>
            {message.text}
          </div>
        )}

        {/* Photo section */}
        <section className="rounded-2xl border border-white/10 bg-[#0c0f16] px-6 py-5 space-y-4">
          <p className={labelClass}>Profile Photo</p>
          <div className="flex items-center gap-5">
            <Avatar src={currentPhoto} displayName={form.displayName} size={88} />
            <div className="flex-1 space-y-2">
              <p className="text-xs text-white/40 leading-relaxed">
                JPEG, PNG or WebP · Max {MAX_MB}MB · Square crops work best
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 rounded-xl bg-white/8 border border-white/15 text-xs text-white/75 hover:bg-white/12 hover:border-amber-400/30 transition-all"
                >
                  {currentPhoto ? "Change photo" : "Upload photo"}
                </button>
                {currentPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewURL(null);
                      setPhotoURL("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="px-4 py-1.5 rounded-xl bg-white/4 border border-white/10 text-xs text-white/40 hover:text-red-400 hover:border-red-400/25 transition-all"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
          {previewURL && (
            <p className="text-xs text-amber-300/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" />
              New photo selected — click Save to apply
            </p>
          )}
        </section>

        {/* Details form */}
        <form onSubmit={onSave} className="rounded-2xl border border-white/10 bg-[#0c0f16] px-6 py-5 space-y-4">
          <p className={labelClass}>Personal Details</p>

          {/* Email — read only */}
          <div>
            <label className={labelClass}>Email Address</label>
            <input
              value={user?.email ?? profile?.email ?? ""}
              readOnly
              className={readonlyClass}
            />
            <p className="mt-1 text-[11px] text-white/30">Email address cannot be changed here.</p>
          </div>

          {/* Display name */}
          <div>
            <label className={labelClass}>Display Name</label>
            <input
              name="displayName"
              value={form.displayName}
              onChange={onChange}
              placeholder="Your full name"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-white/30">
              For security, we automatically remove phone numbers and emails from your name.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className={labelClass}>Phone (kept private)</label>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              placeholder="+234…"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-white/30">
              Stored securely. Only surfaced in line with Nesta's booking rules.
            </p>
          </div>

          {/* Role — read only */}
          <div>
            <label className={labelClass}>Account Role</label>
            <div className="w-full px-4 py-2.5 rounded-xl bg-black/20 border border-white/8 text-sm flex items-center gap-2">
              <span className="text-white/70 font-medium">{rolePretty}</span>
              {isAdmin && (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200">
                  Admin
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/30">
              Role changes happen only via onboarding or admin verification flows.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="px-5 py-2.5 rounded-xl border border-white/12 bg-white/5 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all"
            >
              Log out
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}