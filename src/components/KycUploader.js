import React, { useCallback, useMemo, useRef, useState } from "react";
import { storage, db } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";

/**
 * KycUploader.jsx (JavaScript)
 * Luxury, multi-upload flow with drag & drop, per-file progress, validation,
 * and Firestore onboarding record creation.
 *
 * Storage layout: kyc/{uid}/{docType}/{filename}
 * Writes BOTH:
 *   - users/{uid}  (kyc.status -> "submitted", kycFiles map of arrays)
 *   - onboarding/{uid} (type, status -> "PENDING", submittedAt, email, userId)
 */

const MAX_MB_PER_FILE = 15;
const MAX_FILES_TOTAL = 10;

const DOC_GROUPS = [
  {
    key: "governmentId",
    label: "Government ID (Passport / NIN / Driver's License)",
    accept: "image/*,application/pdf",
    required: true,
  },
  {
    key: "selfie",
    label: "Selfie (face match)",
    accept: "image/*",
    required: true,
  },
  {
    key: "addressProof",
    label: "Address Proof (utility bill, bank statement)",
    accept: "image/*,application/pdf",
    required: true,
  },
  {
    key: "businessProof",
    label: "Business Proof (optional: CAC doc, certificate)",
    accept: "image/*,application/pdf",
    required: false,
  },
];

function bytesToSize(b) {
  if (!b && b !== 0) return "—";
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export default function KycUploader({ userType = "host" /* or "partner" */ }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]); // {id, file, group, progress, status, url?, storagePath?}
  const [consent, setConsent] = useState(false);
  const [bvnLast4, setBvnLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const inputRefs = useRef({});
  const dropRef = useRef(null);

  const totalCount = files.length;
  const totalProgress = useMemo(() => {
    if (totalCount === 0) return 0;
    const sum = files.reduce((acc, f) => acc + (f.progress || 0), 0);
    return Math.round(sum / totalCount);
  }, [files, totalCount]);

  const canSubmit = useMemo(() => {
    if (!user || !consent || busy || files.length === 0) return false;
    // required groups must have at least one file queued
    for (const g of DOC_GROUPS) {
      if (g.required && !files.some((f) => f.group === g.key)) return false;
    }
    // BVN optional but if present must be 4 digits
    if (bvnLast4 && !/^\d{4}$/.test(bvnLast4)) return false;
    return true;
  }, [user, consent, busy, files, bvnLast4]);

  const pickFiles = (group) => inputRefs.current[group]?.click();

  const onGroupFileChange = (group, e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    addFiles(group, list);
    // reset input so same file can be chosen again
    e.target.value = "";
  };

  const addFiles = (group, list) => {
    setError("");
    setMsg("");

    const next = [];
    for (const f of list) {
      // validations
      const perFileMax = MAX_MB_PER_FILE * 1024 * 1024;
      if (f.size > perFileMax) {
        setError(`“${f.name}” is too large (max ${MAX_MB_PER_FILE}MB).`);
        continue;
      }
      if (files.length + next.length >= MAX_FILES_TOTAL) {
        setError(`Limit is ${MAX_FILES_TOTAL} files total.`);
        break;
      }

      next.push({
        id: `${group}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        group,
        progress: 0,
        status: "queued",
      });
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = async (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    const list = Array.from(dt.files || []);
    if (!list.length) return;
    // default dropped files go to governmentId bucket unless the user clicks specific pickers
    addFiles("governmentId", list);
  }, [addFiles]);

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const startUpload = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    setMsg("");

    const uploaded = [];

    try {
      // 1) Upload each file under kyc/{uid}/{group}/{safeName}
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item.status === "done") { uploaded.push(item); continue; }

        const safeName = `${item.file.name.replace(/\s+/g, "_")}`;
        const objectRef = ref(storage, `kyc/${user.uid}/${item.group}/${Date.now()}_${safeName}`);
        const task = uploadBytesResumable(objectRef, item.file, {
          contentType: item.file.type || "application/octet-stream",
        });

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              if (!snap.total) return;
              const pct = Math.round((snap.bytesTransferred / snap.total) * 100);
              setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress: pct, status: "uploading" } : f)));
            },
            (err) => reject(err),
            () => resolve()
          );
        });

        const url = await getDownloadURL(objectRef);
        setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress: 100, status: "done", url, storagePath: objectRef.fullPath } : f)));
        uploaded.push({ ...item, url, storagePath: objectRef.fullPath, progress: 100, status: "done" });
      }

      // 2) Build maps per group for users/{uid}.kycFiles
      const groupMap = {};
      for (const g of DOC_GROUPS) groupMap[g.key] = [];
      for (const f of uploaded) {
        const entry = { url: f.url, name: f.file.name, size: f.file.size, type: f.file.type, path: f.storagePath };
        if (!groupMap[f.group]) groupMap[f.group] = [];
        groupMap[f.group].push(entry);
      }
      if (bvnLast4 && /^\d{4}$/.test(bvnLast4)) groupMap.bvnLast4 = bvnLast4;

      // 3) Update users/{uid}
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        kycFiles: groupMap,
        kyc: {
          status: "submitted",
          submittedAt: serverTimestamp(),
          reviewedAt: null,
          reviewedBy: null,
          reason: null,
        },
        updatedAt: serverTimestamp(),
      });

      // 4) Ensure onboarding/{uid}
      const onboardingRef = doc(db, "onboarding", user.uid);
      await setDoc(onboardingRef, {
        type: userType === "partner" ? "partner" : "host",
        status: "PENDING",
        submittedAt: serverTimestamp(),
        userId: user.uid,
        email: user.email || "",
      }, { merge: true });

      setMsg("Documents uploaded. Your verification has been submitted for review.");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-[#0f1216] text-white/90 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-300/40 grid place-items-center text-amber-200 font-black">N</div>
          <div>
            <h2 className="text-lg font-extrabold leading-tight">Upload verification documents</h2>
            <p className="text-white/50 text-sm">Luxury-grade safety: ID, selfie and address proof are required.</p>
          </div>
          <div className="ml-auto text-sm opacity-80">{totalProgress}%</div>
        </div>

        {/* Drag & drop */}
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="mx-6 my-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center"
        >
          <div className="text-white/80 font-semibold">Drag & drop files here</div>
          <div className="text-white/50 text-sm">or use the pickers below • Max {MAX_FILES_TOTAL} files • {MAX_MB_PER_FILE}MB each</div>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-4">
          {DOC_GROUPS.map((g) => (
            <div key={g.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold">{g.label}</div>
                  <div className="text-xs text-white/50">{g.required ? "Required" : "Optional"}</div>
                </div>
                <button
                  onClick={() => pickFiles(g.key)}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300"
                  disabled={busy}
                >
                  Add file
                </button>
              </div>
              <input
                type="file"
                accept={g.accept}
                multiple
                ref={(el) => (inputRefs.current[g.key] = el)}
                style={{ display: "none" }}
                onChange={(e) => onGroupFileChange(g.key, e)}
              />
              {/* Group file chips */}
              <div className="mt-3 space-y-2">
                {files.filter((f) => f.group === g.key).length === 0 ? (
                  <div className="text-xs text-white/40">No files yet.</div>
                ) : (
                  files
                    .filter((f) => f.group === g.key)
                    .map((f) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/10 px-3 py-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: f.status === "done" ? "#34d399" : f.status === "uploading" ? "#fbbf24" : "#94a3b8" }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{f.file.name}</div>
                          <div className="text-[11px] text-white/40">{bytesToSize(f.file.size)} • {f.file.type || "unknown"}</div>
                          <div className="h-1.5 w-full bg-white/10 rounded mt-1 overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${f.progress}%` }} />
                          </div>
                        </div>
                        {f.url ? (
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-xs underline opacity-80">View</a>
                        ) : null}
                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                          disabled={busy && f.status === "uploading"}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* BVN + consent */}
        <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">BVN last 4 (optional)</label>
            <input
              value={bvnLast4}
              onChange={(e) => setBvnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              inputMode="numeric"
              placeholder="1234"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
              disabled={busy}
            />
            <p className="text-xs text-white/40 mt-1">Used only to match identity. Never shared publicly.</p>
          </div>
          <label className="flex items-start gap-3 text-sm mt-1">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
            <span>I consent to submit these documents for verification and confirm they are accurate.</span>
          </label>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-5 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-white/50">We accept JPG, PNG, and PDF. Max {MAX_MB_PER_FILE}MB per file.</div>
          <div className="flex items-center gap-2">
            <button
              onClick={startUpload}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-xl font-semibold ${canSubmit ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-white/10 text-white/50 cursor-not-allowed"}`}
            >
              {busy ? "Uploading…" : "Submit for review"}
            </button>
          </div>
        </div>

        {(msg || error) && (
          <div className={`mx-6 mb-6 rounded-xl px-4 py-3 text-sm ${error ? "bg-red-500/10 border border-red-500/30 text-red-200" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"}`}>
            {error || msg}
          </div>
        )}
      </div>
    </div>
  );
}
