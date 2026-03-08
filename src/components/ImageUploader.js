// src/components/ImageUploader.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase";

/**
* ImageUploader (Nesta)
* ✅ Matches Storage rules:
*   - path: listing-images/{userId}/...
*   - write: only if request.auth.uid == {userId}
*   - max: < 10MB
*   - contentType: image/*
*
* Returns: array of URL strings
*
* ✅ Luxury upgrade:
*   - standardises image output to 1600x1000
*   - crops to a premium landscape ratio
*   - exports high-quality JPEG for cleaner consistency
*   - supports reordering so first image becomes Cover / hero image
*/

const MAX_MB = 10;
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
  return "image/jpeg";
}

function isProbablyImage(file) {
  const t = String(file?.type || "").toLowerCase();
  if (!t) return true;
  return t.startsWith("image/");
}

function appendUrl(onChange, url, fallbackArray = []) {
  if (typeof onChange !== "function") return;

  try {
    onChange((prev) => {
      const base = Array.isArray(prev) ? prev : fallbackArray;
      if (base.includes(url)) return base;
      return [...base, url];
    });
    return;
  } catch {
    // fallback below
  }

  const base = Array.isArray(fallbackArray) ? fallbackArray : [];
  if (!base.includes(url)) onChange([...base, url]);
}

/* ───────────────── image optimiser ───────────────── */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image."));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function optimiseImage(file) {
  const img = await loadImageFromFile(file);

  const TARGET_W = 1600;
  const TARGET_H = 1000;
  const QUALITY = 0.9;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported on this browser.");

  const scale = Math.max(TARGET_W / img.width, TARGET_H / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (TARGET_W - drawW) / 2;
  const dy = (TARGET_H - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error("Image optimisation failed."));
        else resolve(b);
      },
      "image/jpeg",
      QUALITY
    );
  });

  const baseName = safeName(file?.name || "photo.jpg").replace(/\.[^.]+$/, "");

  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function ImageUploader({
  value = [],
  onChange,
  userId,
  disabled = false,
  maxFiles = 20,
}) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]); // [{id,name,pct,status}]

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

  const setUrlsSafe = (next) => {
    urlsRef.current = Array.isArray(next) ? next : [];
    onChange?.(urlsRef.current);
  };

  const movePhoto = (fromIndex, toIndex) => {
    const base = [...(urlsRef.current || [])];

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= base.length ||
      toIndex >= base.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [item] = base.splice(fromIndex, 1);
    base.splice(toIndex, 0, item);
    setUrlsSafe(base);
  };

  const makeCover = (index) => {
    if (index <= 0) return;
    movePhoto(index, 0);
  };

  const removeAt = (index) => {
    const next = [...(urlsRef.current || [])];
    next.splice(index, 1);
    setUrlsSafe(next);
  };

  const uploadOne = async (file) => {
    if (!userId) throw new Error("Missing userId (must be signed in).");
    if (!isProbablyImage(file)) throw new Error("Only image files are allowed.");
    if (file.size >= MAX_BYTES) {
      throw new Error(`One file is too large. Max is ${MAX_MB}MB per image.`);
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const clean = safeName(file.name || "photo.jpg");
    const path = `listing-images/${userId}/${id}_${clean}`;
    const storageRef = ref(storage, path);

    setQueue((q) => [
      ...q,
      { id, name: file.name || clean, pct: 0, status: "uploading" },
    ]);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: guessImageContentType(file),
    });

    const url = await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setQueue((q) => q.map((it) => (it.id === id ? { ...it, pct } : it)));
        },
        (err) => {
          setQueue((q) =>
            q.map((it) => (it.id === id ? { ...it, status: "error" } : it))
          );
          reject(err);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            setQueue((q) =>
              q.map((it) =>
                it.id === id ? { ...it, pct: 100, status: "done" } : it
              )
            );
            resolve(downloadUrl);
          } catch (e) {
            setQueue((q) =>
              q.map((it) => (it.id === id ? { ...it, status: "error" } : it))
            );
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

    const latestUrls = urlsRef.current || [];
    const remaining = Math.max(0, maxFiles - latestUrls.length);
    const picked = files.slice(0, remaining);

    if (!picked.length) {
      setError(`You already have ${latestUrls.length} photos. Remove one to upload more.`);
      return;
    }

    setBusy(true);

    try {
      for (const rawFile of picked) {
        try {
          if (!isProbablyImage(rawFile)) {
            throw new Error("Only image files are allowed.");
          }

          if (rawFile.size >= MAX_BYTES) {
            throw new Error(`One file is too large. Max is ${MAX_MB}MB per image.`);
          }

          const optimisedFile = await optimiseImage(rawFile);

          if (optimisedFile.size >= MAX_BYTES) {
            throw new Error("Optimised image is still too large. Please use a smaller image.");
          }

          const downloadUrl = await uploadOne(optimisedFile);
          appendUrl(onChange, downloadUrl, urlsRef.current);

          urlsRef.current = Array.isArray(urlsRef.current)
            ? urlsRef.current.includes(downloadUrl)
              ? urlsRef.current
              : [...urlsRef.current, downloadUrl]
            : [downloadUrl];
        } catch (oneErr) {
          console.error("[ImageUploader] single upload failed:", oneErr);
          setError(
            oneErr?.message ? String(oneErr.message) : friendlyFirebaseError(oneErr)
          );
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
              <div
                key={q.id}
                className="grid grid-cols-[1fr_60px_90px] gap-2 items-center"
              >
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
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {urls.map((url, i) => {
            const isCover = i === 0;

            return (
              <div
                key={`${url}-${i}`}
                className="relative rounded-xl overflow-hidden border border-white/10 bg-black/20"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={url}
                    alt={`img-${i}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-2">
                  {isCover ? (
                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-amber-400 text-black shadow">
                      Cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeCover(i)}
                      className="px-2 py-1 rounded-full text-[11px] font-semibold bg-black/70 text-white border border-white/20 hover:bg-black/85"
                    >
                      Make Cover
                    </button>
                  )}
                </div>

                <div className="p-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => movePhoto(i, i - 1)}
                    disabled={i === 0 || disabled || busy}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Left
                  </button>

                  <button
                    type="button"
                    onClick={() => movePhoto(i, i + 1)}
                    disabled={i === urls.length - 1 || disabled || busy}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Right →
                  </button>

                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-xs px-2 py-1 rounded bg-black/60 hover:bg-black/80 ml-auto"
                    disabled={disabled || busy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-2 text-[11px] text-white/50">
        Tips: images are automatically standardised for a cleaner premium gallery. The first photo becomes the cover image across Nesta. Max {MAX_MB}MB per image. {maxFiles} photos max.
      </div>
    </div>
  );
}