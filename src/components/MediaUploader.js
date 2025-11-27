// src/components/MediaUploader.js
import React, { useRef, useState } from "react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

export default function MediaUploader({ value = [], onChange, folder = "listing-photos", disabled = false }) {
  const storage = getStorage();
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]); // [{name, pct, status}]

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  async function handleFiles(files) {
    const tasks = Array.from(files || []);
    for (const file of tasks) {
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
      const storageRef = ref(storage, `${folder}/${name}`);
      const task = uploadBytesResumable(storageRef, file);

      setQueue((q) => [...q, { name: file.name, pct: 0, status: "uploading" }]);

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setQueue((q) =>
              q.map((it) => (it.name === file.name ? { ...it, pct } : it))
            );
          },
          (err) => {
            setQueue((q) =>
              q.map((it) => (it.name === file.name ? { ...it, status: "error" } : it))
            );
            reject(err);
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              const added = {
                url,
                path: task.snapshot.ref.fullPath,
                name: file.name,
                size: file.size,
              };
              onChange?.([...(value || []), added]);
              setQueue((q) =>
                q.map((it) => (it.name === file.name ? { ...it, status: "done", pct: 100 } : it))
              );
              resolve();
            } catch (e) {
              setQueue((q) =>
                q.map((it) => (it.name === file.name ? { ...it, status: "error" } : it))
              );
              reject(e);
            }
          }
        );
      });
    }
  }

  async function removeAt(idx) {
    try {
      const item = value[idx];
      if (item?.path) {
        try {
          await deleteObject(ref(storage, item.path));
        } catch {
          // might be a URL from elsewhere; ignore delete failure
        }
      }
    } finally {
      const next = [...value];
      next.splice(idx, 1);
      onChange?.(next);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <button type="button" className="btn" onClick={openPicker} disabled={disabled}>
          + Add Photos
        </button>
        <div className="muted">JPEG/PNG/WebP. Up to ~5MB each is ideal.</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Existing images */}
      {value?.length ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 12, marginBottom: 10 }}>
          {value.map((img, i) => (
            <figure key={img.url + i} className="card" style={{ padding: 6, textAlign: "center" }}>
              <img
                src={img.url}
                alt={img.name || `photo-${i}`}
                style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }}
              />
              <button
                type="button"
                className="btn danger"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => removeAt(i)}
                disabled={disabled}
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      ) : null}

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="card" style={{ padding: 10 }}>
          {queue.map((q) => (
            <div key={q.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div className="muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</div>
              <div>{q.pct}%</div>
              <div className="muted">{q.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
