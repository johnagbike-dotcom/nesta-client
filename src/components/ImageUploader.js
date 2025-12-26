// src/components/ImageUploader.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase";

/**
 * ImageUploader (Nesta)
 * ✅ Matches your Storage rules:
 *   - path: listing-images/{userId}/...
 *   - write: only if request.auth.uid == {userId}
 *   - max: < 10MB
 *   - contentType: image/*
 *
 * Returns: array of URL strings
 */

const MAX_MB = 10; // MUST match Storage rules underMax10MB()
const MAX_BYTES = MAX_MB * 1024 * 1024;

function safeName(name = "photo.jpg") {
  return String(name)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  const msg = String(err?.message || "");

  if (code.includes("storage/unauthorized") || msg.toLowerCase().includes("permission")) {
    return "Upload blocked by Storage permissions (unauthorized). Make sure you are signed in and your Storage rules allow this path.";
  }
  if (code.includes("storage/canceled")) return "Upload cancelled.";
  if (code.includes("storage/retry-limit-exceeded")) return "Network issue. Please retry.";
  if (code.includes("storage/quota-exceeded")) return "Storage quota exceeded. Please contact support.";
  return msg || "Upload failed.";
}

/**
 * Your rules require request.resource.contentType matches image/.*
 * So we MUST ensure the upload metadata contentType is image/* (never octet-stream).
 */
function guessImageContentType(file) {
  const t = String(file?.type || "").toLowerCase();
  if (t.startsWith("image/")) return t;

  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".bmp")) return "image/bmp";
  // default for jpg/jpeg or unknown image extension
  return "image/jpeg";
}

function isProbablyImage(file) {
  // Some phones send empty type. We'll allow it and rely on extension + contentType we set.
  const t = String(file?.type || "").toLowerCase();
  if (!t) return true;
  return t.startsWith("image/");
}

/**
 * Append helper:
 * - If parent passed setState (e.g. setImages), it supports functional updates.
 * - If parent passed a normal function expecting an array, we still support it.
 */
function appendUrl(onChange, url, fallbackArray = []) {
  if (typeof onChange !== "function") return;

  // Try functional update (works with React setState)
  try {
    onChange((prev) => {
      const base = Array.isArray(prev) ? prev : fallbackArray;
      // Avoid accidental duplicates
      if (base.includes(url)) return base;
      return [...base, url];
    });
    return;
  } catch {
    // Fallback: direct array update
  }

  const base = Array.isArray(fallbackArray) ? fallbackArray : [];
  if (!base.includes(url)) onChange([...base, url]);
}

export default function ImageUploader({
  value = [],
  onChange,
  userId, // ✅ REQUIRED for rules match: listing-images/{userId}/...
  disabled = false,
  maxFiles = 20,
}) {
  const fileInput = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]); // [{id,name,pct,status}]

  // Keep latest urls in a ref to avoid stale-closure issues
  const urls = Array.isArray(value) ? value : [];
  const urlsRef = useRef(urls);
  useEffect(() => {
    urlsRef.current = Array.isArray(value) ? value : [];
  }, [value]);

  const currentCount = urls.length;
  const canPick = !disabled && !busy && currentCount < maxFiles && !!userId;

  const pickLabel = useMemo(() => {
    if (!userId) return "Sign in to upload";
    if (disabled) return "Uploads disabled";
    if (busy) return "Uploading…";
    if (currentCount >= maxFiles) return `Max ${maxFiles} photos reached`;
    return "Upload";
  }, [userId, disabled, busy, currentCount, maxFiles]);

  // Upload ONE file (moved out of the loop logic so ESLint no-loop-func is gone)
  const uploadOne = async (file) => {
    if (!userId) throw new Error("Missing userId (must be signed in).");

    if (!isProbablyImage(file)) {
      throw new Error("Only image files are allowed.");
    }

    if (file.size >= MAX_BYTES) {
      throw new Error(`One file is too large. Max is ${MAX_MB}MB per image (per Storage rules).`);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const clean = safeName(file.name || "photo.jpg");

    // ✅ MUST match rules:
    // match /listing-images/{userId}/{allPaths=**}
    const path = `listing-images/${userId}/${id}_${clean}`;
    const storageRef = ref(storage, path);

    setQueue((q) => [...q, { id, name: file.name || clean, pct: 0, status: "uploading" }]);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: guessImageContentType(file), // ✅ Force image/* contentType
    });

    const url = await new Promise((resolve, reject) => {
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
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            setQueue((q) => q.map((it) => (it.id === id ? { ...it, pct: 100, status: "done" } : it)));
            resolve(downloadUrl);
          } catch (e) {
            setQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error" } : it)));
            reject(e);
          }
        }
      );
    });

    return url;
  };

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setError("");

    if (!userId) {
      setError("You must be signed in to upload photos.");
      return;
    }

    // enforce max count
    const latestUrls = urlsRef.current || [];
    const remaining = Math.max(0, maxFiles - latestUrls.length);
    const picked = files.slice(0, remaining);

    if (!picked.length) {
      setError(`You already have ${latestUrls.length} photos. Remove one to upload more.`);
      return;
    }

    setBusy(true);

    try {
      for (const file of picked) {
        try {
          const downloadUrl = await uploadOne(file);

          // ✅ Always append against the latest value (prevents stale closure issues)
          appendUrl(onChange, downloadUrl, urlsRef.current);

          // update ref immediately so next upload sees latest array even before parent rerender
          urlsRef.current = Array.isArray(urlsRef.current)
            ? (urlsRef.current.includes(downloadUrl) ? urlsRef.current : [...urlsRef.current, downloadUrl])
            : [downloadUrl];
        } catch (oneErr) {
          console.error("[ImageUploader] single upload failed:", oneErr);
          setError(oneErr?.message ? String(oneErr.message) : friendlyFirebaseError(oneErr));
        }
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
    const next = [...(urlsRef.current || [])];
    next.splice(i, 1);
    urlsRef.current = next;
    onChange?.(next);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
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
                    q.status === "done"
                      ? "text-emerald-300"
                      : q.status === "error"
                      ? "text-red-300"
                      : "text-yellow-300",
                  ].join(" ")}
                >
                  {q.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {urls.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {urls.map((url, i) => (
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
