// src/pages/onboarding/KycPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useUserProfile from "../../hooks/useUserProfile";
import {
  loadKycProfile,
  saveKycProfile,
  OK_STATUSES,
} from "../../api/kycProfile";
import { storage } from "../../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
} from "firebase/storage";

/* --------------------------------------------- */
/* STATUS PILL --------------------------------- */
/* --------------------------------------------- */

function StatusPill({ value }) {
  const s = String(value || "").toUpperCase();

  const tone = OK_STATUSES.includes(s)
    ? {
        label: "Approved",
        bg: "rgba(16,185,129,.10)",
        bd: "rgba(16,185,129,.35)",
        fg: "#b7f7df",
        dot: "#34d399",
      }
    : s === "PENDING"
    ? {
        label: "Pending",
        bg: "rgba(245,158,11,.10)",
        bd: "rgba(245,158,11,.35)",
        fg: "#ffe8b5",
        dot: "#fbbf24",
      }
    : {
        label: "Not submitted",
        bg: "rgba(148,163,184,.10)",
        bd: "rgba(148,163,184,.35)",
        fg: "#e6ebf4",
        dot: "#cbd5e1",
      };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: tone.bg,
        border: `1px solid ${tone.bd}`,
        color: tone.fg,
        fontWeight: 800,
        letterSpacing: 0.3,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: tone.dot,
        }}
      />
      {tone.label}
    </span>
  );
}

/* --------------------------------------------- */
/* MAIN PAGE ----------------------------------- */
/* --------------------------------------------- */

export default function KycPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const uid = user?.uid;

  const [kyc, setKyc] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [uploadFile, setUploadFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  const status = useMemo(
    () => String(kyc?.status || "").toUpperCase(),
    [kyc]
  );

  const isApproved = OK_STATUSES.includes(status);

  /* --------------------------------------------- */
  /* LOAD PROFILE -------------------------------- */
  /* --------------------------------------------- */

  useEffect(() => {
    if (!uid) return;

    async function run() {
      setLoadingProfile(true);
      try {
        const data = await loadKycProfile(uid);
        setKyc(data);
      } catch (e) {
        console.error("Failed to load KYC profile", e);
      } finally {
        setLoadingProfile(false);
      }
    }

    run();
  }, [uid]);

  /* --------------------------------------------- */
  /* LOAD FILES ---------------------------------- */
  /* --------------------------------------------- */

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    async function loadFiles() {
      setFilesLoading(true);
      try {
        const base = ref(storage, `kyc/${uid}`);
        const res = await listAll(base);

        const items = await Promise.all(
          res.items.map(async (it) => ({
            name: it.name,
            url: await getDownloadURL(it),
          }))
        );

        if (!cancelled) setFiles(items);
      } catch (e) {
        console.log(e);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    }

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  /* --------------------------------------------- */
  /* PICK FILE ----------------------------------- */
  /* --------------------------------------------- */

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!["image/", "application/pdf"].some((t) => f.type.startsWith(t))) {
      setError("Only images or PDF allowed.");
      return;
    }

    if (f.size > 20 * 1024 * 1024) {
      setError("Max file size is 20MB.");
      return;
    }

    setUploadFile(f);
    setError("");
    setBanner("");
    setProgress(0);
  };

  /* --------------------------------------------- */
  /* UPLOAD FILE --------------------------------- */
  /* --------------------------------------------- */

  async function upload() {
    if (!uploadFile || !uid) return;
    try {
      setUploading(true);
      const safeName = uploadFile.name.replace(/\s+/g, "_");

      const fileRef = ref(storage, `kyc/${uid}/${Date.now()}_${safeName}`);

      const task = uploadBytesResumable(fileRef, uploadFile);
      task.on("state_changed", (snap) => {
        const pct = Math.round(
          (snap.bytesTransferred / snap.totalBytes) * 100
        );
        setProgress(pct);
      });

      await task;

      const url = await getDownloadURL(fileRef);

      await saveKycProfile(uid, {
        status: "PENDING",
        lastUploadedUrl: url,
      });

      // 💡 Instant local update so the status pill changes immediately
      setKyc((prev) => ({
        ...(prev || {}),
        status: "PENDING",
        lastUploadedUrl: url,
      }));

      setBanner("Document uploaded. Pending review.");
      setUploadFile(null);

      // Reload file list
      const base = ref(storage, `kyc/${uid}`);
      const res = await listAll(base);
      const all = await Promise.all(
        res.items.map(async (it) => ({
          name: it.name,
          url: await getDownloadURL(it),
        }))
      );
      setFiles(all);
    } catch (e) {
      console.error(e);
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /* --------------------------------------------- */
  /* UI ------------------------------------------ */
  /* --------------------------------------------- */

  return (
    <main className="min-h-screen bg-[#0d1013] text-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="uppercase text-xs tracking-[0.25em] text-slate-400">
              Nesta • Identity Verification
            </p>
            <h1 className="text-4xl font-black mt-2 text-[#f5b301]">
              KYC Verification
            </h1>
            <p className="text-slate-300/80 mt-3 max-w-xl">
              Upload your government ID and proof of address to verify your
              identity for hosting or partner privileges.
            </p>
          </div>

          <StatusPill value={status} />
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

        {/* Card */}
        <section className="rounded-2xl border border-white/10 bg-[#12171d] shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Upload area */}
            {!isApproved && (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center">
                <input
                  id="kyc-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onPick}
                  className="hidden"
                />
                <label htmlFor="kyc-file" className="cursor-pointer block">
                  <div className="text-sm font-semibold text-white/80">
                    Click to upload ID / Proof of Address
                  </div>
                  <div className="text-xs mt-1 text-white/50">
                    JPG / PNG / PDF — Max 20MB
                  </div>
                </label>

                {uploadFile && (
                  <div className="mt-3 text-xs text-white/70">
                    Selected:{" "}
                    <span className="font-semibold">{uploadFile.name}</span>
                    {progress > 0 && <span> • {progress}%</span>}
                  </div>
                )}

                <button
                  onClick={upload}
                  disabled={uploading}
                  className={`mt-5 px-5 py-2.5 rounded-xl font-semibold ${
                    uploading
                      ? "bg-white/10 text-white/60"
                      : "bg-amber-400 text-black"
                  }`}
                >
                  {uploading ? "Uploading…" : "Submit document"}
                </button>
              </div>
            )}

            {/* Files */}
            <div>
              <div className="text-sm font-bold mb-2">Documents on file</div>

              {filesLoading ? (
                <div className="text-white/60 text-sm">Loading…</div>
              ) : files.length === 0 ? (
                <div className="text-sm text-white/40">
                  No documents uploaded.
                </div>
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
                      <div className="text-xs truncate mb-2 opacity-80">
                        {f.name}
                      </div>
                      <div className="h-24 grid place-items-center bg-black/20 rounded-lg text-white/50 text-xs">
                        Preview
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {isApproved && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-300/30 px-4 py-3 text-sm text-emerald-200">
                You are fully verified.
                <Link
                  to="/host"
                  className="font-bold text-amber-400 underline ml-2"
                >
                  Go to Host Dashboard →
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
