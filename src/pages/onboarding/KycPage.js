// src/pages/onboarding/KycPage.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { db, storage } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, listAll } from "firebase/storage";

const HARD_REQUIRED = [
  { key: "governmentId", label: "Government-issued ID (required)" },
  { key: "liveSelfie", label: "Live selfie (required)" },
  { key: "proofOfAddress", label: "Proof of address (required)" },
];

const OPTIONAL = [
  { key: "rightToList", label: "Proof of right to list (optional for launch)" },
  { key: "utilityBill", label: "Utility bill (optional unless used as PoA)" },
  { key: "cac", label: "CAC registration (partners/company - optional for launch)" },
];

function isAllowedFile(file) {
  const t = file?.type || "";
  return (
    t.startsWith("image/") ||
    t === "application/pdf" ||
    t === "application/octet-stream"
  );
}

function prettyStatus(status) {
  const s = String(status || "").toUpperCase().trim();
  if (["APPROVED", "VERIFIED", "COMPLETE"].includes(s)) return "Approved";
  if (["SUBMITTED", "PENDING"].includes(s)) return "Pending";
  if (s === "MORE_INFO_REQUIRED") return "More info";
  if (s === "REJECTED") return "Rejected";
  if (s === "DRAFT") return "Draft";
  return "Not submitted";
}

function normalizeIntent(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "partner") return "partner";
  return "host";
}

function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase().trim();
  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";
  return r;
}

export default function KycPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const uid = user?.uid;

  const role = useMemo(
    () => normalizeRole(profile?.role || profile?.type),
    [profile?.role, profile?.type]
  );

  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);

  // Storage preview
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Upload state
  const [uploadingKey, setUploadingKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  // Declaration
  const [declAccepted, setDeclAccepted] = useState(false);
  const [signature, setSignature] = useState("");

  // Intent
  const [intent, setIntent] = useState(() => {
    try {
      const qpIntent = searchParams.get("intent");
      if (qpIntent) return normalizeIntent(qpIntent);

      const saved = localStorage.getItem("nesta_kyc_intent");
      return normalizeIntent(saved);
    } catch {
      return "host";
    }
  });

  useEffect(() => {
    try {
      const qpIntent = searchParams.get("intent");
      const nextIntent = qpIntent
        ? normalizeIntent(qpIntent)
        : normalizeIntent(localStorage.getItem("nesta_kyc_intent"));

      setIntent(nextIntent);
      localStorage.setItem("nesta_kyc_intent", nextIntent);
    } catch {
      setIntent("host");
    }
  }, [searchParams]);

  // ---- Load kycProfiles/{uid}
  useEffect(() => {
    if (!uid) return;
    let live = true;

    (async () => {
      setLoading(true);
      try {
        const refDoc = doc(db, "kycProfiles", uid);
        const snap = await getDoc(refDoc);

        if (!live) return;

        if (!snap.exists()) {
          await setDoc(
            refDoc,
            {
              uid,
              email: user?.email || "",
              status: "DRAFT",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              uploads: {},
              intent,
            },
            { merge: true }
          );

          const snap2 = await getDoc(refDoc);
          const next = snap2.exists() ? { id: snap2.id, ...snap2.data() } : null;
          setKyc(next);

          if (next?.declaration?.accepted) {
            setDeclAccepted(true);
            setSignature(next?.declaration?.signature || "");
          }
        } else {
          const next = { id: snap.id, ...snap.data() };
          setKyc(next);

          if (next?.declaration?.accepted) {
            setDeclAccepted(true);
            setSignature(next?.declaration?.signature || "");
          }
        }
      } catch (e) {
        console.error(e);
        if (live) setError("Could not load KYC profile.");
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [uid, user?.email, intent]);

  // ---- Refresh storage files
  const refreshFiles = useCallback(async () => {
    if (!uid) return;
    setFilesLoading(true);

    try {
      const rootRef = ref(storage, `kyc/${uid}`);
      const rootRes = await listAll(rootRef);

      const rootItems = await Promise.all(
        rootRes.items.map(async (it) => ({
          name: it.name,
          url: await getDownloadURL(it),
          fullPath: it.fullPath,
        }))
      );

      const subfolderItems = [];
      for (const prefix of rootRes.prefixes || []) {
        const subRes = await listAll(prefix);
        const subItems = await Promise.all(
          subRes.items.map(async (it) => ({
            name: it.name,
            url: await getDownloadURL(it),
            fullPath: it.fullPath,
          }))
        );
        subfolderItems.push(...subItems);
      }

      setFiles([...rootItems, ...subfolderItems]);
    } catch (e) {
      console.log(e);
    } finally {
      setFilesLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const status = useMemo(() => String(kyc?.status || ""), [kyc]);

  const isApproved = useMemo(() => {
    const s = String(status || "").toUpperCase().trim();
    return ["APPROVED", "VERIFIED", "COMPLETE"].includes(s);
  }, [status]);

  const uploadsByType = useMemo(() => {
    const u = kyc?.uploads || {};
    return u && typeof u === "object" ? u : {};
  }, [kyc]);

  const storageHasDocType = (docType) => {
    if (!Array.isArray(files) || files.length === 0) return false;
    const needle = `kyc/${uid}/${docType}/`;
    return files.some((f) => String(f.fullPath || "").includes(needle));
  };

  const hasDoc = (docType) => {
    const entry = uploadsByType?.[docType];
    if (entry?.url) return true;
    return storageHasDocType(docType);
  };

  const hardMissing = useMemo(() => {
    const missing = [];
    for (const r of HARD_REQUIRED) {
      if (!hasDoc(r.key)) missing.push(r.key);
    }
    if (!declAccepted || !String(signature || "").trim()) missing.push("declaration");
    return missing;
  }, [uploadsByType, files, declAccepted, signature]);

  const nextApprovedPath = useMemo(() => {
    if (intent === "partner") {
      if (role === "partner") return "/partner";
      return "/onboarding/partner";
    }

    if (role === "host") return "/host";
    return "/onboarding/kyc/apply";
  }, [intent, role]);

  // ---- Upload doc
  const uploadDoc = async (docType, file) => {
    if (!uid || !file) return;
    setError("");
    setBanner("");

    if (!isAllowedFile(file)) {
      setError("Only images or PDFs allowed.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Max file size is 20MB.");
      return;
    }

    try {
      setUploadingKey(docType);
      setProgress(0);

      const safeName = file.name.replace(/\s+/g, "_");
      const path = `kyc/${uid}/${docType}/${Date.now()}_${safeName}`;
      const fileRef = ref(storage, path);

      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setProgress(pct);
          },
          reject,
          resolve
        );
      });

      const url = await getDownloadURL(fileRef);

      const kycRef = doc(db, "kycProfiles", uid);
      await setDoc(
        kycRef,
        {
          uid,
          email: user?.email || "",
          status: "PENDING",
          intent,
          updatedAt: serverTimestamp(),
          [`uploads.${docType}`]: {
            docType,
            url,
            path,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            uploadedAtMs: Date.now(),
          },
        },
        { merge: true }
      );

      const nextSnap = await getDoc(kycRef);
      setKyc(nextSnap.exists() ? { id: nextSnap.id, ...nextSnap.data() } : null);

      await refreshFiles();

      setBanner(`${docType} uploaded.`);
    } catch (e) {
      console.error(e);
      setError("Upload failed. Check Storage rules + file type.");
    } finally {
      setUploadingKey("");
      setProgress(0);
    }
  };

  // ---- Submit for review
  const submitForReview = async () => {
    if (!uid) return;
    setError("");
    setBanner("");

    if (hardMissing.length) {
      setError("Please upload required docs and sign the declaration before submitting.");
      return;
    }

    try {
      const signatureValue = String(signature || "").trim();

      await setDoc(
        doc(db, "kycProfiles", uid),
        {
          uid,
          email: user?.email || "",
          intent,
          status: "SUBMITTED",
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          declaration: {
            accepted: true,
            signature: signatureValue,
            acceptedAtMs: Date.now(),
          },
          compliance: {
            hardEnforced: ["governmentId", "liveSelfie", "proofOfAddress", "declaration"],
            missingHard: [],
            launchMode: true,
          },
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "onboarding", uid),
        {
          userId: uid,
          uid,
          email: user?.email || "",
          type: intent, // ✅ host or partner
          status: "PENDING",
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", uid),
        {
          kycStatus: "submitted",
          kycIntent: intent,
          kyc: {
            status: "submitted",
            submittedAt: serverTimestamp(),
            intent,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const nextSnap = await getDoc(doc(db, "kycProfiles", uid));
      setKyc(nextSnap.exists() ? { id: nextSnap.id, ...nextSnap.data() } : null);

      setBanner("Submitted for review. Admin will verify shortly.");
    } catch (e) {
      console.error(e);
      setError("Submit failed. Check Firestore rules for onboarding/kycProfiles.");
    }
  };

  useEffect(() => {
    if (!uid || !isApproved) return;

    try {
      localStorage.setItem("nesta_kyc_last_approved_intent", intent);
    } catch {
      // ignore
    }
  }, [uid, isApproved, intent]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0d1013] text-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <p className="uppercase text-xs tracking-[0.25em] text-slate-400">
              Nesta • Identity Verification
            </p>
            <h1 className="text-4xl font-black mt-2 text-[#f5b301]">KYC Verification</h1>
            <p className="text-slate-300/80 mt-3 max-w-xl">
              Upload required documents and submit for review. For launch, we enforce ID,
              selfie, proof of address, and declaration.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Application intent: <span className="font-semibold text-white/80 capitalize">{intent}</span>
            </p>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-sm font-semibold">
            {prettyStatus(status)}
          </span>
        </div>

        {banner && (
          <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {banner}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#12171d] shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-bold">Required documents</div>
              {HARD_REQUIRED.map((d) => (
                <DocRow
                  key={d.key}
                  label={d.label}
                  docType={d.key}
                  has={hasDoc(d.key)}
                  uploading={uploadingKey === d.key}
                  progress={uploadingKey === d.key ? progress : 0}
                  onUpload={uploadDoc}
                />
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-bold text-white/80">Optional for launch</div>
              {OPTIONAL.map((d) => (
                <DocRow
                  key={d.key}
                  label={d.label}
                  docType={d.key}
                  has={hasDoc(d.key)}
                  uploading={uploadingKey === d.key}
                  progress={uploadingKey === d.key ? progress : 0}
                  onUpload={uploadDoc}
                />
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="font-bold text-sm">Declaration (required)</div>

              <label className="flex items-start gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={declAccepted}
                  onChange={(e) => setDeclAccepted(e.target.checked)}
                />
                <span>
                  I confirm I have the right to list, all information is accurate, and I agree
                  to Nesta policies.
                </span>
              </label>

              <div>
                <div className="text-xs text-white/60 mb-1">Type your full name as signature</div>
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm outline-none focus:border-amber-400/80"
                  placeholder="Full name"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={submitForReview}
                disabled={hardMissing.length > 0 || isApproved}
                className={`px-5 py-2.5 rounded-xl font-semibold ${
                  hardMissing.length > 0 || isApproved
                    ? "bg-white/10 text-white/60 cursor-not-allowed"
                    : "bg-amber-400 text-black"
                }`}
              >
                {isApproved ? "Already approved" : "Submit for review"}
              </button>

              {hardMissing.length > 0 && (
                <div className="text-xs text-white/60">Missing: {hardMissing.join(", ")}</div>
              )}

              {isApproved && (
                <Link to={nextApprovedPath} className="text-sm text-amber-300 underline font-semibold">
                  {intent === "partner"
                    ? role === "partner"
                      ? "Go to Partner Dashboard →"
                      : "Continue Partner Onboarding →"
                    : role === "host"
                    ? "Go to Host Dashboard →"
                    : "Continue Host Application →"}
                </Link>
              )}
            </div>

            <div>
              <div className="text-sm font-bold mb-2">Files in Storage</div>

              {filesLoading ? (
                <div className="text-white/60 text-sm">Loading…</div>
              ) : files.length === 0 ? (
                <div className="text-sm text-white/40">No files uploaded.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {files.map((f) => (
                    <a
                      key={f.url}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="text-xs truncate mb-2 opacity-80">{f.fullPath}</div>
                      <div className="h-24 grid place-items-center bg-black/20 rounded-lg text-white/50 text-xs">
                        Open
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {isApproved ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Your KYC is approved. Continue to the next step for your{" "}
            <span className="font-semibold capitalize">{intent}</span> journey.
            <div className="mt-2">
              <button
                onClick={() => nav(nextApprovedPath)}
                className="px-4 py-2 rounded-xl bg-amber-400 text-black font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function DocRow({ label, docType, has, uploading, progress, onUpload }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-white/60">
          {has ? "Uploaded" : "No file uploaded yet"}
          {uploading && progress > 0 ? ` • ${progress}%` : ""}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id={`file-${docType}`}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(docType, f);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={`file-${docType}`}
          className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
            uploading ? "bg-white/10 text-white/60" : "bg-white/10 hover:bg-white/15"
          }`}
        >
          {uploading ? "Uploading…" : has ? "Replace" : "Upload"}
        </label>
      </div>
    </div>
  );
}