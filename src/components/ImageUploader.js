// src/components/ImageUploader.js
import React, { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase"; // ensure storage is exported

export default function ImageUploader({ value = [], onChange, folder = "listing-images" }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = [];
      for (const file of files) {
        const path = `${folder}/${Date.now()}_${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file);
        urls.push(await getDownloadURL(r));
      }
      onChange([...(value || []), ...urls]);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAt(i) {
    const next = [...value];
    next.splice(i, 1);
    onChange(next);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
          className="block w-full text-sm"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className={`px-3 py-2 rounded-xl border border-white/10 ${busy ? "opacity-60 cursor-not-allowed" : "bg-white/10 hover:bg-white/15"}`}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      {Array.isArray(value) && value.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {value.map((url, i) => (
            <div key={url} className="relative rounded-lg overflow-hidden border border-white/10">
              <img src={url} alt={`img-${i}`} className="w-full h-28 object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-black/60 hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
