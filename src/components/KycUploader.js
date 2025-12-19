import React, { useCallback, useMemo, useRef, useState } from "react";
import { storage, db } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";

/**
 * Launch KYC: SOFT enforcement with HARD minimum.
 *
 * HARD ENFORCED (must have to submit):
 *  - governmentId
 *  - liveSelfie
 *  - proofOfAddress (utility bill)
 *  - declaration (checkbox + signature)
 *
 * SOFT (recommended now, admin discretion):
 *  - rightToList (deed OR tenancy+consent OR letterOfAuthority+ownerId)
 *  - CAC/letterhead/authority docs for partners
 *  - bank details + BVN (store now, enforce later at withdrawals stage)
 *
 * Storage layout:
 *  kyc/{uid}/{docType}/{timestamp}_{safeName}
 *
 * Firestore writes:
 *  - kycProfiles/{uid}.documents[docType] = [{name,url,path,uploadedAt,size,mime}]
 *  - users/{uid}.kyc.status = "submitted"
 *  - onboarding/{uid} for admin queue + compliance summary
 */

const MAX_MB_PER_FILE = 15;
const MAX_FILES_TOTAL = 20;

const DOC_TYPES = [
  // HARD
  {
    key: "governmentId",
    label: "Government ID (Passport / NIN / Driver’s Licence)",
    accept: "image/*,application/pdf",
    hardRequired: true,
    softRequired: true,
  },
  {
    key: "liveSelfie",
    label: "Live Selfie (Face match)",
    accept: "image/*",
    hardRequired: true,
    softRequired: true,
  },
  {
    key: "proofOfAddress",
    label: "Proof of Address (Utility bill / bank statement)",
    accept: "image/*,application/pdf",
    hardRequired: true,
    softRequired: true,
  },

  // SOFT (launch discretion)
  {
    key: "rightToList",
    label: "Proof of Right to List (recommended at launch)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: true,
    help:
      "Owned: deed/assignment. Rented: tenancy + consent to sublet OR signed letter of authority + owner ID.",
  },
  {
    key: "tenancyAgreement",
    label: "Tenancy Agreement (if rented)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
  {
    key: "deedOfAssignment",
    label: "Deed of Assignment (if owned)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
  {
    key: "letterOfAuthority",
    label: "Letter of Authority to Sublet/List (signed)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
  {
    key: "ownerId",
    label: "Owner ID (if letter of authority is used)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },

  // Partner/company extras (soft now)
  {
    key: "cacRegistration",
    label: "CAC Registration (company partners)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
  {
    key: "partnerLetterhead",
    label: "Professional Letterhead (company partners)",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
  {
    key: "authorityToList",
    label: "Authority to List Multiple Properties / Portfolio Proof",
    accept: "image/*,application/pdf",
    hardRequired: false,
    softRequired: false,
  },
];

function bytesToSize(b) {
  if (!b && b !== 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

export default function KycUploader({ userType = "host" /* host | partner */ }) {
  const { user, profile } = useAuth();

  const [files, setFiles] = useState([]); // {id, file, docType, progress, status, url?, storagePath?}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Declaration (HARD)
  const [declAccepted, setDeclAccepted] = useState(false);
  const [declSignature, setDeclSignature] = useState("");

  // Bank + BVN (SOFT NOW, enforce later)
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState(""); // store, but do not require
  const [bvn, setBvn] = useState(""); // store, but do not require until withdrawals

  const inputRefs = useRef({});

  const totalCount = files.length;

  const totalProgress = useMemo(() => {
    if (totalCount === 0) return 0;
    const sum = files.reduce((acc, f) => acc + (f.progress || 0), 0);
    return Math.round(sum / totalCount);
  }, [files, totalCount]);

  const uploadedByType = useMemo(() => {
    const map = {};
    for (const t of DOC_TYPES) map[t.key] = 0;
    for (const f of files) {
      map[f.docType] = (map[f.docType] || 0) + 1;
    }
    return map;
  }, [files]);

  const hardMissing = useMemo(() => {
    const missing = [];
    for (const t of DOC_TYPES) {
      if (t.hardRequired && !files.some((f) => f.docType === t.key)) {
        missing.push(t.key);
      }
    }
    if (!declAccepted || !declSignature.trim()) missing.push("declaration");
    return missing;
  }, [files, declAccepted, declSignature]);

  const softMissing = useMemo(() => {
    const missing = [];
    for (const t of DOC_TYPES) {
      if (t.softRequired && !files.some((f) => f.docType === t.key)) {
        missing.push(t.key);
      }
    }
    // bank/bvn are intentionally soft for launch
    return missing;
  }, [files]);

  const canSubmit = useMemo(() => {
    if (!user || busy) return false;
    if (hardMissing.length) return false;
    return true;
  }, [user, busy, hardMissing]);

  const pickFiles = (docType) => inputRefs.current[docType]?.click();

  const addFiles = (docType, list) => {
    setError("");
    setMsg("");

    const next = [];
    for (const f of list) {
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
        id: `${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        docType,
        progress: 0,
        status: "queued", // queued | uploading | done | failed
      });
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const onDocTypeChange = (docType, e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    addFiles(docType, list);
    e.target.value = "";
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Drag & drop goes into Government ID by default
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const list = Array.from(e.dataTransfer.files || []);
      if (!list.length) return;
      addFiles("governmentId", list);
    },
    [files]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  async function upsertKycProfileDocuments(uid, docsMap, meta) {
    const refDoc = doc(db, "kycProfiles", uid);
    const snap = await getDoc(refDoc);
    const existing = snap.exists() ? snap.data() : {};
    const existingDocs = existing.documents || {};

    // merge arrays per docType
    const merged = { ...existingDocs };
    for (const [k, arr] of Object.entries(docsMap)) {
      const prevArr = Array.isArray(merged[k]) ? merged[k] : [];
      merged[k] = [...prevArr, ...(Array.isArray(arr) ? arr : [])];
    }

    await setDoc(
      refDoc,
      {
        uid,
        role: userType,
        status: "SUBMITTED", // internal KYC status
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        documents: merged,
        declaration: meta.declaration,
        bank: meta.bank, // stored now, enforced later
        compliance: meta.compliance,
      },
      { merge: true }
    );
  }

  const submitForReview = async () => {
    if (!user) return;

    setBusy(true);
    setError("");
    setMsg("");

    try {
      // Validate HARD minimum one last time
      if (hardMissing.length) {
        setError("Please complete the required documents before submitting.");
        setBusy(false);
        return;
      }

      // 1) Upload each queued file
      const uploadedEntries = []; // {docType, name, url, path, size, mime}
      for (let i = 0; i < files.length; i++) {
        const item = files[i];

        if (item.status === "done" && item.url && item.storagePath) {
          uploadedEntries.push({
            docType: item.docType,
            name: item.file.name,
            url: item.url,
            path: item.storagePath,
            size: item.file.size,
            mime: item.file.type || "application/octet-stream",
            uploadedAt: new Date(),
          });
          continue;
        }

        const safeName = item.file.name.replace(/\s+/g, "_");
        const objectRef = ref(
          storage,
          `kyc/${user.uid}/${item.docType}/${Date.now()}_${safeName}`
        );

        const task = uploadBytesResumable(objectRef, item.file, {
          contentType: item.file.type || "application/octet-stream",
        });

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = snap.totalBytes
                ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                : 0;
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id ? { ...f, progress: pct, status: "uploading" } : f
                )
              );
            },
            (err) => reject(err),
            () => resolve()
          );
        });

        const url = await getDownloadURL(objectRef);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  progress: 100,
                  status: "done",
                  url,
                  storagePath: objectRef.fullPath,
                }
              : f
          )
        );

        uploadedEntries.push({
          docType: item.docType,
          name: item.file.name,
          url,
          path: objectRef.fullPath,
          size: item.file.size,
          mime: item.file.type || "application/octet-stream",
          uploadedAt: new Date(),
        });
      }

      // 2) Build docsMap for kycProfiles
      const docsMap = {};
      for (const e of uploadedEntries) {
        if (!docsMap[e.docType]) docsMap[e.docType] = [];
        docsMap[e.docType].push({
          name: e.name,
          url: e.url,
          path: e.path,
          size: e.size,
          mime: e.mime,
          uploadedAt: serverTimestamp(),
        });
      }

      // 3) Compliance summary
      const meta = {
        declaration: {
          accepted: true,
          signature: declSignature.trim(),
          acceptedAt: serverTimestamp(),
          // optional audit-friendly fields
          email: user.email || "",
          displayName: user.displayName || "",
        },
        bank: {
          // stored now, enforce later at withdrawals stage
          stage: "collect_later_for_withdrawals",
          bankName: bankName.trim() || null,
          accountName: accountName.trim() || null,
          accountNumberLast4: accountNumber ? String(accountNumber).slice(-4) : null,
          bvn: bvn ? String(bvn).trim() : null,
          updatedAt: serverTimestamp(),
        },
        compliance: {
          hardEnforced: ["governmentId", "liveSelfie", "proofOfAddress", "declaration"],
          hardMissing: [],
          softRecommended: softMissing,
          softMissing: softMissing,
          userType,
          updatedAt: serverTimestamp(),
        },
      };

      // 4) Upsert kycProfiles registry (ADMIN can reliably see docs)
      await upsertKycProfileDocuments(user.uid, docsMap, meta);

      // 5) Update users/{uid} (status for gating)
      const userRef = doc(db, "users", user.uid);

      // Keep a compact, admin-friendly map
      const kycFilesCompact = {};
      for (const t of DOC_TYPES) kycFilesCompact[t.key] = [];
      for (const e of uploadedEntries) {
        kycFilesCompact[e.docType] = kycFilesCompact[e.docType] || [];
        kycFilesCompact[e.docType].push({
          url: e.url,
          name: e.name,
          path: e.path,
          size: e.size,
          type: e.mime,
        });
      }

      await updateDoc(userRef, {
        kycFiles: kycFilesCompact,
        kyc: {
          status: "submitted", // submitted | approved | rejected
          submittedAt: serverTimestamp(),
          reviewedAt: null,
          reviewedBy: null,
          reason: null,
          // launch-phase: bank/bvn collected but not required
          bankStage: "later",
        },
        updatedAt: serverTimestamp(),
      });

      // 6) Ensure onboarding/{uid} exists for admin queue
      const onboardingRef = doc(db, "onboarding", user.uid);
      await setDoc(
        onboardingRef,
        {
          type: userType === "partner" ? "partner" : "host",
          status: "PENDING",
          submittedAt: serverTimestamp(),
          userId: user.uid,
          email: user.email || "",
          compliance: {
            hardComplete: true,
            missingSoft: softMissing,
            // admins can approve discretionarily at launch
            launchMode: true,
          },
        },
        { merge: true }
      );

      setMsg("✅ Documents submitted. An admin will review your KYC shortly.");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const titleFor = (key) => DOC_TYPES.find((x) => x.key === key)?.label || key;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-[#0f1216] text-white/90 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-300/40 grid place-items-center text-amber-200 font-black">
            N
          </div>
          <div>
            <h2 className="text-lg font-extrabold leading-tight">
              Upload verification documents
            </h2>
            <p className="text-white/50 text-sm">
              Minimum required at launch: ID, selfie, proof of address + declaration.
            </p>
          </div>
          <div className="ml-auto text-sm opacity-80">{totalProgress}%</div>
        </div>

        {/* Drag & drop */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="mx-6 my-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center"
        >
          <div className="text-white/80 font-semibold">Drag & drop files here</div>
          <div className="text-white/50 text-sm">
            Default bucket: Government ID • Max {MAX_FILES_TOTAL} files • {MAX_MB_PER_FILE}MB each
          </div>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-4">
          {DOC_TYPES.map((g) => {
            const count = uploadedByType[g.key] || 0;
            const isHard = g.hardRequired;
            const badge = isHard ? "Required" : "Recommended";
            const badgeCls = isHard
              ? "bg-amber-400/20 text-amber-200 border-amber-300/30"
              : "bg-white/5 text-white/60 border-white/10";

            return (
              <div key={g.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{g.label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeCls}`}>
                        {badge}
                      </span>
                      {count > 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-200 border-emerald-400/25">
                          ✅ Uploaded ({count})
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/35">No file yet</span>
                      )}
                    </div>
                    {g.help ? <div className="mt-2 text-xs text-white/45">{g.help}</div> : null}
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
                  onChange={(e) => onDocTypeChange(g.key, e)}
                />

                {/* File chips */}
                <div className="mt-3 space-y-2">
                  {files
                    .filter((f) => f.docType === g.key)
                    .map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/10 px-3 py-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              f.status === "done"
                                ? "#34d399"
                                : f.status === "uploading"
                                ? "#fbbf24"
                                : "#94a3b8",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{f.file.name}</div>
                          <div className="text-[11px] text-white/40">
                            {bytesToSize(f.file.size)} • {f.file.type || "unknown"}
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded mt-1 overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${f.progress}%` }} />
                          </div>
                        </div>

                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline opacity-80"
                          >
                            View
                          </a>
                        ) : null}

                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                          disabled={busy && f.status === "uploading"}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Declaration (HARD) */}
        <div className="px-6 pb-4 border-t border-white/10 pt-4">
          <div className="text-sm font-extrabold mb-2">Digital declaration (Required)</div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={declAccepted}
              onChange={(e) => setDeclAccepted(e.target.checked)}
              disabled={busy}
            />
            <span className="text-white/80">
              I confirm I have the right to list these properties, that all information and pricing I provide are accurate,
              that I take responsibility for guest safety and compliance, and I agree to Nesta policies.
            </span>
          </label>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/50 mb-1">Type your full name as signature</div>
              <input
                value={declSignature}
                onChange={(e) => setDeclSignature(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
                disabled={busy}
              />
            </div>
            <div className="text-xs text-white/45 flex items-center">
              This is logged with your account email for audit. (Launch minimum enforced)
            </div>
          </div>
        </div>

        {/* Bank + BVN (SOFT now) */}
        <div className="px-6 pb-6 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">BVN & bank details (Later-stage)</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white/5 text-white/60 border-white/10">
              Not required for launch
            </span>
          </div>
          <p className="text-xs text-white/45 mt-1">
            You can provide these now, but they will be enforced later when withdrawals are requested.
          </p>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name (optional)"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
              disabled={busy}
            />
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name (optional)"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
              disabled={busy}
            />
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 20))}
              placeholder="Account number (optional)"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
              disabled={busy}
              inputMode="numeric"
            />
            <input
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="BVN (11 digits, optional for now)"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none"
              disabled={busy}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-5 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="text-xs text-white/50">
            Required to submit: ID, selfie, proof of address + declaration.
            {hardMissing.length ? (
              <div className="mt-1 text-amber-200">
                Missing:{" "}
                {hardMissing
                  .map((k) => (k === "declaration" ? "Declaration" : titleFor(k)))
                  .join(", ")}
              </div>
            ) : null}
          </div>

          <button
            onClick={submitForReview}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-xl font-semibold ${
              canSubmit
                ? "bg-amber-400 text-black hover:bg-amber-300"
                : "bg-white/10 text-white/50 cursor-not-allowed"
            }`}
          >
            {busy ? "Submitting…" : "Submit for review"}
          </button>
        </div>

        {(msg || error) && (
          <div
            className={`mx-6 mb-6 rounded-xl px-4 py-3 text-sm ${
              error
                ? "bg-red-500/10 border border-red-500/30 text-red-200"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
            }`}
          >
            {error || msg}
          </div>
        )}
      </div>
    </div>
  );
}
