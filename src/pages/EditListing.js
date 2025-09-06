// src/pages/EditListing.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "../firebase"; // adjust path if different

const MAX_FILES = 20;
const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ----- form state -----
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState("Flat"); // Flat | House | Spare Room
  const [pricePerNight, setPricePerNight] = useState(0);
  const [liveInHost, setLiveInHost] = useState(false);
  const [billsIncluded, setBillsIncluded] = useState(false);
  const [status, setStatus] = useState("active"); // optional

  // Photos
  const [existingUrls, setExistingUrls] = useState([]); // strings
  const [removedUrls, setRemovedUrls] = useState(new Set()); // strings to drop
  const [files, setFiles] = useState([]); // File[]

  // cache uid to avoid eslint/useEffect dependency noise
  const uid = auth.currentUser?.uid || null;

  // ---------- load listing ----------
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const snap = await getDoc(doc(db, "listings", id));
        if (!snap.exists()) {
          setError("Listing not found.");
          setLoading(false);
          return;
        }
        const data = snap.data();

        // Owner-only client guard (server is still the source of truth via rules)
        if (!uid || (data.ownerId && data.ownerId !== uid)) {
          setError("You do not have permission to edit this listing.");
          setLoading(false);
          return;
        }

        if (!alive) return;
        setTitle(data.title || "");
        setCity(data.city || "");
        setArea(data.area || "");
        setType(data.type || "Flat");
        setPricePerNight(Number(data.pricePerNight || 0));
        setLiveInHost(Boolean(data.liveInHost));
        setBillsIncluded(Boolean(data.billsIncluded));
        setStatus(data.status || "active");
        setExistingUrls(Array.isArray(data.photoUrls) ? data.photoUrls : []);
      } catch (e) {
        setError(e.message || "Failed to load listing.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, uid]);

  // ---------- file helpers ----------
  const remainingSlots = useMemo(
    () => MAX_FILES - (existingUrls.length - removedUrls.size) - files.length,
    [existingUrls.length, removedUrls.size, files.length]
  );

  const validateFile = (f) => {
    if (!ACCEPT.includes(f.type)) return `Unsupported type: ${f.type}`;
    if (f.size > MAX_MB * 1024 * 1024)
      return `File too large (> ${MAX_MB}MB): ${f.name}`;
    return null;
  };

  const addFiles = useCallback(
    (list) => {
      const next = [];
      const existingNames = new Set(files.map((f) => `${f.name}|${f.size}`));
      for (const f of list) {
        if (next.length >= remainingSlots) break;
        const err = validateFile(f);
        if (err) {
          setError(err);
          continue;
        }
        const sig = `${f.name}|${f.size}`;
        if (existingNames.has(sig)) continue;
        next.push(f);
      }
      if (next.length) setFiles((prev) => [...prev, ...next]);
    },
    [files, remainingSlots]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setError("");
    if (remainingSlots <= 0) return;
    const list = Array.from(e.dataTransfer.files || []);
    addFiles(list);
  };

  const onPick = (e) => {
    setError("");
    const list = Array.from(e.target.files || []);
    addFiles(list);
    e.target.value = "";
  };

  const removeNewFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const toggleRemoveExisting = (url) => {
    setRemovedUrls((prev) => {
      const clone = new Set(prev);
      if (clone.has(url)) clone.delete(url);
      else clone.add(url);
      return clone;
    });
  };

  // ---------- save ----------
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // guard again on save
      const current = await getDoc(doc(db, "listings", id));
      if (!current.exists()) throw new Error("Listing not found.");
      const d = current.data();
      if (!uid || (d.ownerId && d.ownerId !== uid)) {
        throw new Error("You do not have permission to edit this listing.");
      }

      // 1) upload new files
      const uploadedUrls = [];
      for (const f of files) {
        const path = `listings/${id}/${Date.now()}_${f.name}`;
        const ref = storageRef(storage, path);
        const task = uploadBytesResumable(ref, f);
        await new Promise((res, rej) => {
          task.on(
            "state_changed",
            undefined,
            (err) => rej(err),
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploadedUrls.push(url);
              res();
            }
          );
        });
      }

      // 2) merge urls (keep those not removed + new ones)
      const keptExisting = existingUrls.filter((u) => !removedUrls.has(u));
      const photoUrls = [...keptExisting, ...uploadedUrls].slice(0, MAX_FILES);

      // 3) update doc
      await updateDoc(doc(db, "listings", id), {
        title,
        city,
        area,
        type,
        pricePerNight: Number(pricePerNight || 0),
        liveInHost,
        billsIncluded,
        status,
        photoUrls,
        updatedAt: serverTimestamp(),
      });

      // 4) (Optional) delete removed files from Storage (best-effort)
      const deletions = [];
      removedUrls.forEach((url) => {
        try {
          const delRef = storageRef(storage, url); // works with HTTPS/gs://
          deletions.push(deleteObject(delRef));
        } catch {
          // ignore non-Firebase URLs
        }
      });
      if (deletions.length) {
        Promise.allSettled(deletions);
      }

      navigate(`/listing/${id}`);
    } catch (e2) {
      setError(e2.message || "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-300">Loading listing…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400 mb-3">{error}</p>
        <Link className="underline" to="/dashboard">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <Link to="/dashboard" className="text-sm underline">
          ← Back
        </Link>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Edit listing</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm mb-1">Title</span>
            <input
              className="w-full px-3 py-2 rounded bg-[#0b0f14] border border-gray-700"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="block text-sm mb-1">City</span>
            <input
              className="w-full px-3 py-2 rounded bg-[#0b0f14] border border-gray-700"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="block text-sm mb-1">Area</span>
            <input
              className="w-full px-3 py-2 rounded bg-[#0b0f14] border border-gray-700"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="block text-sm mb-1">Type</span>
            <select
              className="w-full px-3 py-2 rounded bg-[#0b0f14] border border-gray-700"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Flat</option>
              <option>House</option>
              <option>Spare Room</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-sm mb-1">₦ per night</span>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 rounded bg-[#0b0f14] border border-gray-700"
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              required
            />
          </label>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={liveInHost}
                onChange={(e) => setLiveInHost(e.target.checked)}
              />
              <span className="text-sm">Live-in host</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={billsIncluded}
                onChange={(e) => setBillsIncluded(e.target.checked)}
              />
              <span className="text-sm">Bills included</span>
            </label>
          </div>
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Photos</h2>
            <span className="text-xs text-gray-400">
              {`You can add ${Math.max(0, remainingSlots)} more (max ${MAX_FILES})`}
            </span>
          </div>

          {/* Existing URLs */}
          {existingUrls.length > 0 && (
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {existingUrls.map((url) => {
                const removed = removedUrls.has(url);
                return (
                  <div key={url} className="relative group">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img
                      src={url}
                      className={`w-full h-28 object-cover rounded border ${
                        removed ? "opacity-40" : "opacity-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleRemoveExisting(url)}
                      className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-black/60 border border-gray-600"
                      title={removed ? "Undo remove" : "Remove"}
                    >
                      {removed ? "Keep" : "Remove"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* New files previews */}
          {files.length > 0 && (
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {files.map((f, i) => (
                <div key={`${f.name}|${f.size}`} className="relative">
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <img
                    src={URL.createObjectURL(f)}
                    className="w-full h-28 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-black/60 border border-gray-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="rounded border border-dashed border-gray-600 p-4 text-sm text-gray-300"
          >
            <p className="mb-2">Drag & drop images here, or</p>
            <label className="inline-block px-3 py-2 rounded bg-[#111827] border border-gray-600 cursor-pointer">
              Choose files
              <input
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                hidden
                onChange={onPick}
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              JPG/PNG/WEBP • up to {MAX_MB}MB each • max {MAX_FILES} total
            </p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-indigo-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link
            to={`/listing/${id}`}
            className="px-4 py-2 rounded border border-gray-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}