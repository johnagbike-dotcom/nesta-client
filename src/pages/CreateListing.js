// src/pages/CreateListing.js
import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebase";

const MAX_FILES = 20;
const MAX_MB = 8; // per file
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function CreateListing() {
  const navigate = useNavigate();

  // form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Flat");
  const [pricePerNight, setPricePerNight] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [liveInHost, setLiveInHost] = useState(false);
  const [billsIncluded, setBillsIncluded] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [about, setAbout] = useState("");

  // files & upload
  const [files, setFiles] = useState([]); // File[]
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const inputRef = useRef(null);

  // ---------- File Helpers ----------

  // Add files (dedupe + size/type checks). Wrapped in useCallback (fixes ESLint).
  const addFiles = useCallback(
    (list) => {
      if (!list || !list.length) return;

      const prev = files;
      const existing = new Set(prev.map((f) => `${f.name}|${f.size}`));
      const next = [];
      const newErrors = [];

      Array.from(list).forEach((file) => {
        const key = `${file.name}|${file.size}`;

        if (existing.has(key)) return;

        if (!ACCEPTED.includes(file.type)) {
          newErrors.push(`Unsupported type: ${file.name}`);
          return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          newErrors.push(`Too large (> ${MAX_MB}MB): ${file.name}`);
          return;
        }
        next.push(file);
      });

      const merged = [...prev, ...next].slice(0, MAX_FILES);
      if (newErrors.length) setErrors((e) => [...e, ...newErrors]);
      setFiles(merged);
    },
    [files]
  );

  const onPick = (e) => addFiles(e.target.files);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const onDragOver = (e) => e.preventDefault();

  const removeAt = (idx) =>
    setFiles((arr) => arr.filter((_, i) => i !== idx));

  const clearAll = () => setFiles([]);

  const fileCountText = useMemo(
    () => `${files.length}/${MAX_FILES} selected`,
    [files.length]
  );

  // ---------- Submit ----------

  const handleCreate = async (e) => {
    e.preventDefault();
    setErrors([]);
    if (!auth.currentUser) {
      setErrors(["You must be logged in to post a listing."]);
      return;
    }

    if (!title.trim() || !city.trim() || !area.trim() || !pricePerNight) {
      setErrors(["Please fill title, price, city and area."]);
      return;
    }

    try {
      setBusy(true);
      setProgress(0);

      // 1) Upload images (if any)
      const ownerId = auth.currentUser.uid;
      const uploadedUrls = [];

      if (files.length) {
        // upload sequentially for simple progress
        for (let i = 0; i < files.length; i += 1) {
          const f = files[i];
          const path = `listings/${ownerId}/${Date.now()}_${i}_${f.name}`;
          const ref = storageRef(storage, path);
          const task = uploadBytesResumable(ref, f, {
            contentType: f.type,
          });

          // Promise wrapper for progress + completion
          const url = await new Promise((resolve, reject) => {
            task.on(
              "state_changed",
              (snap) => {
                const pct = Math.round(
                  (snap.bytesTransferred / snap.totalBytes) * 100
                );
                // overall progress: average of completed + current
                const overall =
                  Math.round(((i + pct / 100) / files.length) * 100);
                setProgress(overall);
              },
              (err) => reject(err),
              async () => {
                const u = await getDownloadURL(task.snapshot.ref);
                resolve(u);
              }
            );
          });

          uploadedUrls.push(url);
        }
      }

      // 2) Create Firestore doc
      const docRef = await addDoc(collection(db, "listings"), {
        title: title.trim(),
        type,
        pricePerNight: Number(pricePerNight),
        city: city.trim(),
        area: area.trim(),
        liveInHost,
        billsIncluded,
        isFeatured,
        about: about.trim(),
        ownerId,
        photos: uploadedUrls, // array of storage URLs
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3) Done
      setBusy(false);
      setProgress(100);
      navigate(`/listing/${docRef.id}`);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setErrors([
        "Failed to create listing. Please check your connection and try again.",
      ]);
    }
  };

  // ---------- UI ----------

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button className="text-violet-300 mb-3" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1 className="text-3xl font-bold mb-4">Post a new listing</h1>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 rounded bg-red-900/30 border border-red-500 p-3 text-sm">
          <ul className="list-disc ml-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Basic fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm">Title</span>
            <input
              className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Modern Apartment in Lagos"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Type</span>
            <select
              className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Flat</option>
              <option>House</option>
              <option>Spare Room</option>
              <option>Studio</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm">Price per night (₦)</span>
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              placeholder="35000"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">City</span>
            <input
              className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lagos"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Area / Landmark</span>
            <input
              className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Victoria Island"
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

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span className="text-sm">Featured</span>
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-sm">About this stay</span>
          <textarea
            rows={4}
            className="mt-1 w-full rounded bg-[#0b0f14] border border-gray-700 p-2"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Describe the apartment, amenities, nearby landmarks, house rules, etc."
          />
        </label>

        {/* Images */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Photos</h2>
            <span className="text-xs text-gray-400">{fileCountText}</span>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded border-2 border-dashed border-gray-700 p-6 text-center bg-[#0b0f14]/60"
          >
            <p className="mb-3 text-sm">
              Drag & drop images here, or{" "}
              <button
                type="button"
                className="underline text-violet-300"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-400">
              JPEG / PNG / WEBP • up to {MAX_MB}MB each • max {MAX_FILES} files
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              className="hidden"
              onChange={onPick}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {files.map((f, i) => {
                const url = URL.createObjectURL(f);
                return (
                  <div
                    key={`${f.name}-${i}`}
                    className="relative rounded overflow-hidden border border-gray-700"
                  >
                    <img
                      src={url}
                      alt={f.name}
                      className="h-28 w-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="absolute top-1 right-1 text-xs bg-black/70 px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs underline text-gray-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        {busy && (
          <div className="flex items-center gap-3">
            <div className="relative w-full h-2 bg-gray-800 rounded">
              <div
                className="absolute left-0 top-0 h-2 bg-violet-500 rounded"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs">{progress}%</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create listing"}
          </button>
        </div>
      </form>
    </div>
  );
}