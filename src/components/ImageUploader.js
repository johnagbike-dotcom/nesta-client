// src/components/ImageUploader.js
import React, { useMemo, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase";

/**
 * ImageUploader (reliable + admin-grade UX)
 * - Uploads to Firebase Storage
 * - Returns array of URL strings (compatible with CreateListing)
 * - Shows progress + errors (prevents "nothing happens" confusion)
 */

const MAX_MB = 15; // adjust if you want
const MAX_BYTES = MAX_MB * 1024 * 1024;

function safeName(name = "photo") {
  return String(name)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";

  if (code.includes("storage/unauthorized") || msg.toLowerCase().includes("permission")) {
    return "Upload blocked by Storage permissions. Check Firebase Storage rules (unauthorized).";
  }
  if (code.includes("storage/canceled")) return "Upload cancelled.";
  if (code.includes("storage/retry-limit-exceeded")) return "Network issue. Please retry.";
  if (code.includes("storage/unknown")) return "Unknown upload error. Please retry.";
  return msg || "Upload failed.";
}

function isImageLike(file) {
  const t = String(file?.type || "").toLowerCase();
  // allow typical images + HEIC/HEIF (often empty type on some phones)
  if (!t) return true;
  return (
    t.startsWith("image/") ||
    t === "image/heic" ||
    t === "image/heif" ||
    t === "application/octet-stream"
  );
}

export default function ImageUploader({
  value = [],
  onChange,
  folder = "listing-images",
  disabled = false,
  maxFiles = 20,
}) {
  const fileInput = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // queue: [{id,name,pct,status}]
  const [queue, setQueue] = useState([]);

  const currentCount = Array.isArray(value) ? value.length : 0;
  const canPick = !disabled && !busy && currentCount < maxFiles;

  const pickLabel = useMemo(() => {
    if (disabled) return "Uploads disabled";
    if (busy) return "Uploading…";
    if (currentCount >= maxFiles) return `Max ${maxFiles} photos reached`;
    return "Upload";
  }, [disabled, busy, currentCount, maxFiles]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setError("");

    // enforce max count
    const remaining = Math.max(0, maxFiles - currentCount);
    const picked = files.slice(0, remaining);

    if (!picked.length) {
      setError(`You already have ${currentCount} photos. Remove one to upload more.`);
      return;
    }

    setBusy(true);

    try {
      for (const file of picked) {
        if (!isImageLike(file)) {
          setError("Only image files are allowed.");
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError(`One file is too large. Max is ${MAX_MB}MB per image.`);
          continue;
        }

        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const clean = safeName(file.name || "photo.jpg");
        const path = `${folder}/${id}_${clean}`;

        setQueue((q) => [...q, { id, name: file.name || clean, pct: 0, status: "uploading" }]);

        const storageRef = ref(storage, path);

        const task = uploadBytesResumable(storageRef, file, {
          contentType: file.type || "application/octet-stream",
        });

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setQueue((q) => q.map((it) => (it.id === id ? { ...it, pct } : it)));
            },
            (err) => {
              setQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error" } : it)));
              reject(err);
            },
            async () => {
              try {
                const url = await getDownloadURL(task.snapshot.ref);
                const next = [...(Array.isArray(value) ? value : []), url];
                onChange?.(next);

                setQueue((q) => q.map((it) => (it.id === id ? { ...it, pct: 100, status: "done" } : it)));
                resolve();
              } catch (e) {
                setQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error" } : it)));
                reject(e);
              }
            }
          );
        });
      }
    } catch (err) {
      console.error("[ImageUploader] upload failed:", err);
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAt(i) {
    const next = [...(Array.isArray(value) ? value : [])];
    next.splice(i, 1);
    onChange?.(next);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        {/* Keep input visible for desktop usability */}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*"
          disabled={!canPick}
          onChange={(e) => handleFiles(e.target.files)}
          className="block w-full text-sm"
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!canPick}
          className={[
            "px-3 py-2 rounded-xl border border-white/10",
            !canPick ? "opacity-60 cursor-not-allowed" : "bg-white/10 hover:bg-white/15",
          ].join(" ")}
        >
          {pickLabel}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {queue.length > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60 mb-2">Upload activity</div>
          <div className="grid gap-2">
            {queue.map((q) => (
              <div key={q.id} className="grid grid-cols-[1fr_60px_90px] gap-2 items-center">
                <div className="text-xs text-white/70 truncate">{q.name}</div>
                <div className="text-xs text-white/70">{q.pct}%</div>
                <div
                  className={[
                    "text-xs font-semibold",
                    q.status === "done" ? "text-emerald-300" : q.status === "error" ? "text-red-300" : "text-yellow-300",
                  ].join(" ")}
                >
                  {q.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(value) && value.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="relative rounded-lg overflow-hidden border border-white/10">
              <img src={url} alt={`img-${i}`} className="w-full h-28 object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-black/60 hover:bg-black/80"
                disabled={disabled || busy}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 text-[11px] text-white/50">
        Tips: use bright photos. Max {MAX_MB}MB per image. {maxFiles} photos max.
      </div>
    </div>
  );
}
