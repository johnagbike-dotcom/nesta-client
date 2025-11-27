// src/components/kyc/KYCDocumentUploader.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  arrayUnion,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase";
import { useAuth } from "../../auth/AuthContext";

/**
 * KYC document uploader
 *
 * - Stores files in Storage under  `kyc/<uid>/<timestamp>_<name>`
 * - Stores metadata in Firestore doc `kyc/<uid>`:
 *   {
 *     status: "pending" | "approved" | "rejected" | "none",
 *     files: [{ url, name, path, uploadedAt }]
 *   }
 */
export default function KYCDocumentUploader({ uid: uidProp }) {
  const { user } = useAuth();
  const uid = uidProp || user?.uid;

  const [initialLoading, setInitialLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  // Load existing KYC record
  useEffect(() => {
    if (!uid) return;

    const refDoc = doc(db, "kyc", uid);
    const unsub = onSnapshot(
      refDoc,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setFiles(Array.isArray(data.files) ? data.files : []);
        } else {
          setFiles([]);
        }
        setInitialLoading(false);
      },
      (err) => {
        console.error("[KYCDocumentUploader] listen error:", err);
        setInitialLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  async function handleUpload(fileList) {
    if (!uid || !fileList?.length) return;

    setUploading(true);
    try {
      const kycDocRef = doc(db, "kyc", uid);

      const uploaded = [];
      for (const file of Array.from(fileList)) {
        const path = `kyc/${uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);

        // Upload to Storage
        await uploadBytes(storageRef, file);

        // Get public URL
        const url = await getDownloadURL(storageRef);

        uploaded.push({
          url,
          name: file.name,
          path,
          uploadedAt: serverTimestamp(),
        });
      }

      // Merge into Firestore document
      await setDoc(
        kycDocRef,
        {
          status: "pending",
          updatedAt: serverTimestamp(),
          files: arrayUnion(...uploaded),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("[KYCDocumentUploader] upload failed:", err);
      alert("Sorry, we couldn't upload that document. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!uid) {
    // Not signed in yet – nothing to render
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload box */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="mb-2 text-sm text-white/70">
          Click to upload a clear scan or photo of your ID / address proof.
          You can upload multiple images or PDFs. Max ~20&nbsp;MB per file.
        </p>

        <label className="block w-full cursor-pointer rounded-2xl border border-dashed border-white/20 bg-black/20 py-10 text-center text-sm hover:bg-black/30">
          <div className="font-medium text-white">
            Click to upload (JPG / PNG / PDF)
          </div>
          <div className="mt-1 text-xs text-white/60">
            You can select more than one file
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>

        {uploading && (
          <div className="mt-3 text-sm text-amber-300">
            Uploading… please don’t close this tab.
          </div>
        )}
      </div>

      {/* Already uploaded section */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="mb-2 text-sm font-semibold text-white">
          Already uploaded
        </div>

        {initialLoading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : files.length === 0 ? (
          <div className="text-sm text-white/50">No files found yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {files.map((f, idx) => (
              <li
                key={f.path || f.url || idx}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-white break-all">
                    {f.name || "Document"}
                  </span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-300 hover:underline"
                  >
                    View / download
                  </a>
                </div>
                <span className="text-xs text-white/50">
                  {f.uploadedAt ? "Uploaded" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
