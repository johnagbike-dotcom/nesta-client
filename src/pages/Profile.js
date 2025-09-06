// src/pages/Profile.js
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";

import { auth, db, storage, onAuth, ensureUserProfile } from "../firebase";

export default function Profile() {
  const [user, setUser] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState("");

  // Load current user + profile doc
  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u);
      if (!u) return;

      // make sure a users/{uid} doc exists
      await ensureUserProfile(u.uid);

      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.exists() ? snap.data() : {};

      setDisplayName(data.displayName || u.displayName || "");
      setPhoneNumber(data.phoneNumber || "");
    });

    return () => unsub && unsub();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");
    toast.success("Profile updated successfully!");

    try {
      let photoURL = user.photoURL || null;

      // If a new avatar was chosen, upload and get URL
      if (avatarFile) {
        const fileRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(fileRef, avatarFile);
        photoURL = await getDownloadURL(fileRef);
      }

      // Update Firestore profile
      const uref = doc(db, "users", user.uid);
      await setDoc(
        uref,
        {
          displayName: displayName || null,
          phoneNumber: phoneNumber || null,
          photoURL: photoURL || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update Firebase Auth profile so header/avatar refreshes immediately
      await updateProfile(auth.currentUser, {
        displayName: displayName || null,
        photoURL: photoURL || null,
      });

      // Tiny success toast
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
      setAvatarFile(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p>Please sign in to edit your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>

      <div className="bg-gray-900/40 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-amber-500 text-gray-900 font-bold text-xl flex items-center justify-center overflow-hidden">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{(displayName || user.email || "N").charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="text-gray-300">
            <div className="font-semibold">
              {displayName || "Unnamed"}
            </div>
            <div className="text-sm opacity-80">{user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Phone number</label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 outline-none"
              placeholder="+234..."
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Profile photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-amber-500 text-gray-900 font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      {/* Tiny Saved toast */}
      {savedToast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 text-gray-100 px-3 py-2 rounded-lg shadow-lg">
          Saved
        </div>
      )}
    </div>
  );
}