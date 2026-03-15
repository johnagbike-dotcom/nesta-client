import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import AdminHeader from "../../components/AdminHeader";
import LuxeBtn from "../../components/LuxeBtn";
import { useToast } from "../../context/ToastContext";
import { db, storage } from "../../firebase";
import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  setDoc,
} from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";

/* ─────────────────── helpers ─────────────────── */
const safeStr = (v) => String(v ?? "").trim();
const safeLower = (v) => safeStr(v).toLowerCase();
const safeUpper = (v) => safeStr(v).toUpperCase();

function normalizeType(v) {
  const t = safeLower(v);
  if (t === "partner" || t === "verified_partner") return "partner";
  return "host";
}

function normalizeStatus(v) {
  const s = safeUpper(v || "PENDING");
  if (["APPROVED", "REJECTED", "PENDING", "MORE_INFO_REQUIRED"].includes(s)) return s;
  return "PENDING";
}

function userKeyFromRow(row) {
  return row?.uid || row?.userId || row?.id || "";
}

function toJsDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function displayDate(v) {
  const d = toJsDate(v);
  return d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "—";
}

/* ───────────────────── Status chip ───────────────────── */
const chipTone = (s) => {
  const k = normalizeStatus(s);
  const map = {
    APPROVED: {
      bg: "rgba(16,185,129,.18)",
      text: "#a7f3d0",
      ring: "rgba(16,185,129,.32)",
    },
    REJECTED: {
      bg: "rgba(239,68,68,.18)",
      text: "#fecaca",
      ring: "rgba(239,68,68,.32)",
    },
    PENDING: {
      bg: "rgba(245,158,11,.18)",
      text: "#fde68a",
      ring: "rgba(245,158,11,.32)",
    },
    MORE_INFO_REQUIRED: {
      bg: "rgba(59,130,246,.18)",
      text: "#bfdbfe",
      ring: "rgba(59,130,246,.32)",
    },
  };
  return map[k] || map.PENDING;
};

function StatusPill({ value }) {
  const t = chipTone(value);
  const raw = normalizeStatus(value);

  const labelMap = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING: "PENDING",
    MORE_INFO_REQUIRED: "MORE INFO",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        padding: "0 14px",
        minWidth: 110,
        borderRadius: 999,
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {labelMap[raw] || raw}
    </span>
  );
}

function SmallBadge({ label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.14)",
        color: "#e6e9ef",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

/* ───────────────────── Simple Modal ───────────────────── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px,92vw)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.14)",
          background:
            "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
          boxShadow: "0 24px 48px rgba(0,0,0,.65)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: 14,
            borderBottom: "1px solid rgba(255,255,255,.08)",
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
            zIndex: 2,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 900 }}>{title}</h3>
          <div style={{ marginLeft: "auto" }}>
            <LuxeBtn small onClick={onClose}>
              Close
            </LuxeBtn>
          </div>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/* -------------------- Storage docs loader (RECURSIVE) -------------------- */
async function listAllFilesRecursively(folderRef) {
  const res = await listAll(folderRef);
  let files = [...(res.items || [])];

  for (const sub of res.prefixes || []) {
    const nested = await listAllFilesRecursively(sub);
    files = files.concat(nested);
  }

  return files;
}

function prettyNameFromFullPath(fullPath) {
  const parts = String(fullPath || "").split("/").filter(Boolean);
  const file = parts.length ? parts[parts.length - 1] : "file";
  return file;
}

async function listDocsForPossibleKeys(storageInstance, possibleKeys = []) {
  const tried = [];

  for (const key of possibleKeys) {
    const k = safeStr(key);
    if (!k) continue;

    const p = `kyc/${k}`;
    tried.push(p);

    const baseRef = ref(storageInstance, p);
    const fileRefs = await listAllFilesRecursively(baseRef);

    if (fileRefs?.length) {
      const items = await Promise.all(
        fileRefs.map(async (it) => ({
          name: prettyNameFromFullPath(it.fullPath),
          url: await getDownloadURL(it),
          fullPath: it.fullPath,
          source: "storage",
        }))
      );

      items.sort((a, b) => String(a.fullPath).localeCompare(String(b.fullPath)));

      return { items, path: p, tried };
    }
  }

  return { items: [], path: "", tried };
}

function normalizeKycFiles(files = []) {
  if (!Array.isArray(files)) return [];
  return files
    .map((f, idx) => ({
      id: f.path || f.url || `kyc-file-${idx}`,
      name: safeStr(f.name || "").trim() || "Document",
      url: safeStr(f.url || ""),
      path: safeStr(f.path || ""),
      uploadedAt: f.uploadedAt || null,
      source: "firestore",
    }))
    .filter((f) => f.url);
}

/* ═══════════════════ Onboarding Queue (admin) ═══════════════════ */
export default function OnboardingQueue() {
  const { showToast } = useToast();
  const notify = useCallback(
    (msg, type = "success") => {
      try {
        showToast?.(msg, type);
      } catch {
        /* no-op */
      }
    },
    [showToast]
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState("");

  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [moreInfoRow, setMoreInfoRow] = useState(null);
  const [moreInfoNote, setMoreInfoNote] = useState("Please upload the remaining KYC documents.");
  const [moreInfoDocs, setMoreInfoDocs] = useState("passport, utility_bill");
  const [moreInfoBusy, setMoreInfoBusy] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyRow, setVerifyRow] = useState(null);
  const [verifyNote, setVerifyNote] = useState(
    "Verified after physical inspection / documentation review."
  );
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [unverifyOpen, setUnverifyOpen] = useState(false);
  const [unverifyRow, setUnverifyRow] = useState(null);
  const [unverifyNote, setUnverifyNote] = useState("Verification removed.");
  const [unverifyBusy, setUnverifyBusy] = useState(false);

  const [tab, setTab] = useState("all");
  const [typeTab, setTypeTab] = useState("all");
  const [q, setQ] = useState("");

  const [revOpen, setRevOpen] = useState(false);
  const [revRow, setRevRow] = useState(null);

  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [storagePathUsed, setStoragePathUsed] = useState("");

  const [revUser, setRevUser] = useState(null);
  const [revUserLoading, setRevUserLoading] = useState(false);
  const [revUserError, setRevUserError] = useState("");

  const [revKyc, setRevKyc] = useState(null);
  const [revKycLoading, setRevKycLoading] = useState(false);
  const [revKycError, setRevKycError] = useState("");

  const [revUploads, setRevUploads] = useState(null);
  const [revUploadsLoading, setRevUploadsLoading] = useState(false);
  const [revUploadsError, setRevUploadsError] = useState("");
  const [revUploadsNotice, setRevUploadsNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setBlockedMsg("");

    try {
      const snap = await getDocs(collection(db, "onboarding"));

      const list = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        const type = normalizeType(
          x.type || x.intent || x.applicationType || x.role || "host"
        );
        const status = normalizeStatus(x.status || "PENDING");

        list.push({
          id: d.id,
          onboardingId: d.id,
          source: "onboarding",
          userId: x.userId || x.uid || d.id,
          uid: x.uid || x.userId || null,
          email: x.email || "",
          type,
          status,
          submittedAt: x.submittedAt?.toDate?.() || null,
          reviewedAt: x.reviewedAt?.toDate?.() || null,
          adminNote: x.adminNote || "",
          requiredDocuments: Array.isArray(x.requiredDocuments) ? x.requiredDocuments : [],
          _raw: x,
        });
      });

      list.sort(
        (a, b) =>
          (b.submittedAt ? +b.submittedAt : 0) - (a.submittedAt ? +a.submittedAt : 0)
      );

      setRows(list);
    } catch (e) {
      const msg = String(e?.message || e);

      if (/Missing or insufficient permissions/i.test(msg)) {
        setBlockedMsg(
          "Firestore read blocked by security rules. Ensure your admin claim is set (request.auth.token.admin == true)."
        );
      } else {
        setBlockedMsg("Onboarding load error: " + msg);
      }

      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();

    if (typeTab !== "all") {
      list = list.filter((r) => r.type === typeTab);
    }

    if (tab !== "all") {
      list = list.filter((r) => normalizeStatus(r.status) === normalizeStatus(tab));
    }

    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) =>
        `${r.email} ${r.userId} ${r.uid || ""} ${r.status} ${r.type}`
          .toLowerCase()
          .includes(kw)
      );
    }

    return list;
  }, [rows, tab, typeTab, q]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      MORE_INFO_REQUIRED: 0,
      host: 0,
      partner: 0,
    };

    rows.forEach((r) => {
      const s = normalizeStatus(r.status);
      if (c[s] != null) c[s] += 1;
      c[r.type] = (c[r.type] || 0) + 1;
    });

    return c;
  }, [rows]);

  const fetchUserProfile = async (row) => {
    const userKey = userKeyFromRow(row);
    if (!userKey) {
      setRevUser(null);
      setRevUserError("Missing user key (uid/userId).");
      return;
    }

    setRevUserLoading(true);
    setRevUserError("");

    try {
      const snap = await getDoc(doc(db, "users", userKey));
      setRevUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      if (!snap.exists()) setRevUserError("No users/{uid} profile found.");
    } catch (e) {
      setRevUser(null);
      setRevUserError("Could not load users/{uid}: " + (e?.message || e));
    } finally {
      setRevUserLoading(false);
    }
  };

  const fetchKycProfile = async (row) => {
    const userKey = userKeyFromRow(row);
    if (!userKey) {
      setRevKyc(null);
      setRevKycError("Missing user key (uid/userId).");
      return;
    }

    setRevKycLoading(true);
    setRevKycError("");

    try {
      const snap = await getDoc(doc(db, "kycProfiles", userKey));
      setRevKyc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      if (!snap.exists()) setRevKycError("No kycProfiles/{uid} record found.");
    } catch (e) {
      setRevKyc(null);
      setRevKycError("Could not load kycProfiles/{uid}: " + (e?.message || e));
    } finally {
      setRevKycLoading(false);
    }
  };

  const fetchKycUploads = async (row) => {
    const userKey = userKeyFromRow(row);
    if (!userKey) {
      return {
        record: null,
        files: [],
        error: "Missing user key (uid/userId).",
      };
    }

    try {
      const snap = await getDoc(doc(db, "kyc", userKey));
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;

      if (!snap.exists()) {
        return {
          record: null,
          files: [],
          error: "No kyc/{uid} upload record found.",
        };
      }

      return {
        record: data,
        files: normalizeKycFiles(data?.files || []),
        error: "",
      };
    } catch (e) {
      return {
        record: null,
        files: [],
        error: "Could not load kyc/{uid}: " + (e?.message || e),
      };
    }
  };

  const openReview = async (r) => {
    setRevRow(r);
    setRevOpen(true);

    setRevUser(null);
    setRevUserError("");
    fetchUserProfile(r);

    setRevKyc(null);
    setRevKycError("");
    fetchKycProfile(r);

    setRevUploads(null);
    setRevUploadsError("");
    setRevUploadsNotice("");

    setDocs([]);
    setDocsError("");
    setStoragePathUsed("");
    setDocsLoading(true);
    setRevUploadsLoading(true);

    try {
      const uploadResult = await fetchKycUploads(r);
      setRevUploads(uploadResult.record);
      setRevUploadsError(uploadResult.error || "");

      if (uploadResult.files.length) {
        setDocs(uploadResult.files);
        setStoragePathUsed(`Firestore: kyc/${userKeyFromRow(r)}.files`);
        setDocsError("");
        setRevUploadsNotice("");
        return;
      }

      const possibleKeys = Array.from(
        new Set(
          [
            r.onboardingId,
            r.id,
            r.userId,
            r.uid,
            r?._raw?.userId,
            r?._raw?.uid,
            r?._raw?.firebaseUid,
            r?._raw?.userUID,
          ]
            .map((v) => safeStr(v))
            .filter(Boolean)
        )
      );

      const { items, path, tried } = await listDocsForPossibleKeys(storage, possibleKeys);

      if (items.length) {
        setDocs(items);
        setStoragePathUsed(path);
        setDocsError("");
        setRevUploadsNotice(
          uploadResult.error
            ? "Upload record unavailable — showing Storage documents instead."
            : ""
        );
      } else {
        setDocs([]);
        setStoragePathUsed(tried?.length ? tried.join("  •  ") : "");
        setDocsError("No files found in Firestore kyc/{uid}.files or Storage kyc/{uid}/.");
        setRevUploadsNotice("");
      }
    } catch (e) {
      const msg = String(e?.message || e);

      if (/storage\/unauthorized|permission|unauthorized/i.test(msg)) {
        setDocsError(
          "Storage access denied by rules. Ensure your admin claim is set (request.auth.token.admin == true) and Storage rules allow admins to read kyc/*."
        );
      } else {
        setDocsError("Could not load KYC documents: " + msg);
      }

      setDocs([]);
      setRevUploadsNotice("");
    } finally {
      setDocsLoading(false);
      setRevUploadsLoading(false);
    }
  };

  const closeReview = () => {
    setRevOpen(false);
    setRevRow(null);

    setDocs([]);
    setDocsError("");
    setStoragePathUsed("");

    setRevUser(null);
    setRevUserError("");

    setRevKyc(null);
    setRevKycError("");

    setRevUploads(null);
    setRevUploadsError("");
    setRevUploadsNotice("");
    setRevUploadsLoading(false);
  };

  const isVerifiedForType = (userDoc, type) => {
    const t = normalizeType(type);
    const v = userDoc?.verification?.[t];
    const status = safeLower(v?.status || "");
    return status === "verified";
  };

  const setVerified = async (row, verified, note = "") => {
    const userKey = userKeyFromRow(row);
    if (!userKey) return;

    const t = normalizeType(row?.type);
    const stamp = serverTimestamp();

    const patch = {
      updatedAt: stamp,
      verification: {
        [t]: {
          status: verified ? "verified" : "unverified",
          note: note || null,
          verifiedAt: verified ? stamp : null,
          unverifiedAt: !verified ? stamp : null,
        },
      },
      isVerifiedHost: t === "host" ? !!verified : undefined,
      isVerifiedPartner: t === "partner" ? !!verified : undefined,
    };

    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    try {
      await setDoc(doc(db, "users", userKey), patch, { merge: true });
      await fetchUserProfile(row);
    } catch (e) {
      notify("Could not update verification: " + (e?.message || e), "error");
    }
  };

  const setStatus = async (row, next, reason = "", requiredDocs = []) => {
    if (!row?.id) return;

    const nextUpper = normalizeStatus(next || "PENDING");
    const userKey = userKeyFromRow(row);
    const kind = normalizeType(row.type);

    try {
      await updateDoc(doc(db, "onboarding", row.onboardingId || row.id), {
        status: nextUpper,
        reviewedAt: serverTimestamp(),
        adminNote: reason || null,
        requiredDocuments: requiredDocs.length ? requiredDocs : null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "onboarding", row.onboardingId || row.id, "audits"), {
        action: nextUpper,
        reason: reason || null,
        requiredDocuments: requiredDocs.length ? requiredDocs : null,
        reviewedAt: serverTimestamp(),
      });

      if (userKey) {
        await setDoc(
          doc(db, "kycProfiles", userKey),
          {
            status:
              nextUpper === "APPROVED"
                ? "APPROVED"
                : nextUpper === "REJECTED"
                ? "REJECTED"
                : nextUpper === "MORE_INFO_REQUIRED"
                ? "MORE_INFO_REQUIRED"
                : "PENDING",
            intent: kind,
            role: kind,
            reviewedAt: serverTimestamp(),
            adminNote: reason || null,
            requiredDocuments: requiredDocs.length ? requiredDocs : null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const statusLower =
        nextUpper === "APPROVED"
          ? "approved"
          : nextUpper === "REJECTED"
          ? "rejected"
          : nextUpper === "MORE_INFO_REQUIRED"
          ? "more_info_required"
          : "pending";

      const userPatch = {
        updatedAt: serverTimestamp(),
        application: {
          type: kind,
          status: statusLower,
          reviewedAt: serverTimestamp(),
          reason: reason || null,
          requiredDocuments: requiredDocs.length ? requiredDocs : null,
        },
        applicationType: kind,
        applicationStatus: statusLower,
        kycIntent: kind,
        kycStatus: statusLower,
        kyc: {
          status: statusLower,
          reviewedAt: serverTimestamp(),
          reason: reason || null,
          requiredDocuments: requiredDocs.length ? requiredDocs : null,
          intent: kind,
        },
      };

      if (userKey && nextUpper === "APPROVED") {
        let existingRole = "";
        try {
          const uSnap = await getDoc(doc(db, "users", userKey));
          existingRole = safeLower(uSnap.exists() ? uSnap.data()?.role : "");
        } catch {
          // ignore
        }

        if (existingRole !== "admin") {
          userPatch.role = kind;
          userPatch.accountType = kind;
        }
      }

      if (userKey) {
        await setDoc(doc(db, "users", userKey), userPatch, { merge: true });
      }

      setRows((prev) =>
        prev.map((x) =>
          (x.onboardingId || x.id) === (row.onboardingId || row.id)
            ? {
                ...x,
                status: nextUpper,
                adminNote: reason || x.adminNote,
                requiredDocuments: requiredDocs.length ? requiredDocs : x.requiredDocuments,
              }
            : x
        )
      );

      closeReview();
      notify(`Status updated to ${nextUpper.toLowerCase()}.`, "success");
    } catch (e) {
      notify("Could not update status: " + (e?.message || e), "error");
    }
  };

  const handleMoreInfo = (row) => {
    if (!row) return;
    setMoreInfoRow(row);
    setMoreInfoNote("Please upload the remaining KYC documents.");
    setMoreInfoDocs("passport, utility_bill");
    setMoreInfoOpen(true);
  };

  const submitMoreInfo = async () => {
    if (!moreInfoRow) return;
    setMoreInfoBusy(true);
    const requiredDocs = moreInfoDocs
      ? moreInfoDocs.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    await setStatus(moreInfoRow, "MORE_INFO_REQUIRED", moreInfoNote, requiredDocs);
    setMoreInfoOpen(false);
    setMoreInfoRow(null);
    setMoreInfoBusy(false);
  };

  const openVerify = (row) => {
    setVerifyRow(row);
    setVerifyNote("Verified after physical inspection / documentation review.");
    setVerifyOpen(true);
  };

  const submitVerify = async () => {
    if (!verifyRow) return;
    setVerifyBusy(true);
    await setVerified(verifyRow, true, verifyNote);
    notify("Verification badge granted.", "success");
    setVerifyOpen(false);
    setVerifyRow(null);
    setVerifyBusy(false);
  };

  const openUnverify = (row) => {
    setUnverifyRow(row);
    setUnverifyNote("Verification removed.");
    setUnverifyOpen(true);
  };

  const submitUnverify = async () => {
    if (!unverifyRow) return;
    setUnverifyBusy(true);
    await setVerified(unverifyRow, false, unverifyNote);
    notify("Verification badge removed.", "success");
    setUnverifyOpen(false);
    setUnverifyRow(null);
    setUnverifyBusy(false);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 28, margin: "6px 0 18px" }}>
        Admin
      </h1>

      <AdminHeader
        back
        title="Onboarding queue"
        subtitle="Host & partner onboarding (approval) + separate verification badge."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,auto) 1fr repeat(3,auto)",
          gap: 10,
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        {[
          { k: "all", label: `All ${counts.all}` },
          { k: "PENDING", label: `Pending ${counts.PENDING}` },
          { k: "APPROVED", label: `Approved ${counts.APPROVED}` },
          { k: "REJECTED", label: `Rejected ${counts.REJECTED}` },
          { k: "MORE_INFO_REQUIRED", label: `More info ${counts.MORE_INFO_REQUIRED}` },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: tab === x.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: tab === x.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {x.label}
          </button>
        ))}

        <span />

        {[
          { k: "all", label: "All types" },
          { k: "host", label: `Host ${counts.host || 0}` },
          { k: "partner", label: `Partner ${counts.partner || 0}` },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTypeTab(x.k)}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: typeTab === x.k ? "#413cff" : "rgba(255,255,255,.06)",
              color: typeTab === x.k ? "#eef2ff" : "#cfd3da",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {x.label}
          </button>
        ))}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email / userid / status…"
          style={{
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "#dfe3ea",
            padding: "0 12px",
            minWidth: 260,
          }}
        />

        <LuxeBtn kind="gold" onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </LuxeBtn>
      </div>

      {blockedMsg ? (
        <div
          style={{
            margin: "10px 0 12px",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(253,224,71,.45)",
            background: "rgba(253,224,71,.10)",
            color: "#fde68a",
            fontWeight: 700,
          }}
        >
          {blockedMsg}
        </div>
      ) : null}

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 800,
            fontSize: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          Onboarding
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 1100,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "rgba(255,255,255,.02)",
                  color: "#aeb6c2",
                  textAlign: "left",
                }}
              >
                {["Type", "Email", "User", "Status", "Submitted", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: "#aeb6c2" }}>
                    No onboarding records.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={`${r.onboardingId || r.id}-${r.source || "onboarding"}`}>
                    <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                      {r.type}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{r.email || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{r.userId || r.uid || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusPill value={normalizeStatus(r.status)} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {r.submittedAt ? dayjs(r.submittedAt).format("YYYY-MM-DD HH:mm") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {normalizeStatus(r.status) !== "APPROVED" && (
                          <LuxeBtn kind="emerald" small onClick={() => setStatus(r, "APPROVED")}>
                            Approve
                          </LuxeBtn>
                        )}

                        {normalizeStatus(r.status) !== "REJECTED" && (
                          <LuxeBtn kind="ruby" small onClick={() => setStatus(r, "REJECTED")}>
                            Reject
                          </LuxeBtn>
                        )}

                        <LuxeBtn kind="gold" small onClick={() => openReview(r)}>
                          Review
                        </LuxeBtn>

                        {normalizeStatus(r.status) !== "APPROVED" && (
                          <LuxeBtn kind="slate" small onClick={() => handleMoreInfo(r)}>
                            More info
                          </LuxeBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={revOpen} onClose={closeReview} title="Onboarding review">
        {!revRow ? null : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <SmallBadge
                label={
                  normalizeType(revRow.type) === "partner"
                    ? "PARTNER APPLICATION"
                    : "HOST APPLICATION"
                }
              />
              <SmallBadge label={`STATUS: ${normalizeStatus(revRow.status)}`} />
              {revUser && isVerifiedForType(revUser, revRow.type) ? (
                <SmallBadge label="VERIFIED ✅" />
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div className="muted">Type</div>
              <div style={{ textTransform: "capitalize" }}>{normalizeType(revRow.type)}</div>

              <div className="muted">Email</div>
              <div>{revRow.email || "—"}</div>

              <div className="muted">User ID</div>
              <div>{userKeyFromRow(revRow) || "—"}</div>

              <div className="muted">Submitted</div>
              <div>
                {revRow.submittedAt ? dayjs(revRow.submittedAt).format("YYYY-MM-DD HH:mm") : "—"}
              </div>

              <div className="muted">User role (users/{"{uid}"})</div>
              <div>
                {revUserLoading ? (
                  <span style={{ opacity: 0.7 }}>Loading…</span>
                ) : revUser ? (
                  <span style={{ opacity: 0.95, fontWeight: 800 }}>
                    {revUser.role || "—"}
                  </span>
                ) : (
                  <span style={{ opacity: 0.7 }}>{revUserError || "—"}</span>
                )}
              </div>

              <div className="muted">Verification</div>
              <div>
                {revUserLoading ? (
                  <span style={{ opacity: 0.7 }}>Loading…</span>
                ) : revUser ? (
                  isVerifiedForType(revUser, revRow.type) ? (
                    <span style={{ fontWeight: 900 }}>Verified</span>
                  ) : (
                    <span style={{ opacity: 0.8 }}>Not verified</span>
                  )
                ) : (
                  <span style={{ opacity: 0.7 }}>—</span>
                )}
              </div>

              <div className="muted">KYC profile</div>
              <div>
                {revKycLoading ? (
                  <span style={{ opacity: 0.7 }}>Loading…</span>
                ) : revKyc ? (
                  <span style={{ opacity: 0.95 }}>
                    {safeUpper(revKyc.status || "DRAFT")} • role/intention:{" "}
                    <strong>{normalizeType(revKyc.intent || revKyc.role || revRow.type)}</strong>
                  </span>
                ) : (
                  <span style={{ opacity: 0.7 }}>{revKycError || "—"}</span>
                )}
              </div>

              <div className="muted">Upload record (kyc/{`{uid}`})</div>
              <div>
                {revUploadsLoading ? (
                  <span style={{ opacity: 0.7 }}>Loading…</span>
                ) : revUploads ? (
                  <span style={{ opacity: 0.95 }}>
                    {safeUpper(revUploads.status || "PENDING")} • files:{" "}
                    <strong>{Array.isArray(revUploads.files) ? revUploads.files.length : 0}</strong>
                  </span>
                ) : revUploadsNotice ? (
                  <span style={{ opacity: 0.85, color: "#bfdbfe" }}>{revUploadsNotice}</span>
                ) : (
                  <span style={{ opacity: 0.7 }}>{revUploadsError || "—"}</span>
                )}
              </div>

              {revRow.adminNote ? (
                <>
                  <div className="muted">Admin note</div>
                  <div>{revRow.adminNote}</div>
                </>
              ) : null}

              {Array.isArray(revRow.requiredDocuments) && revRow.requiredDocuments.length ? (
                <>
                  <div className="muted">Requested docs</div>
                  <div>{revRow.requiredDocuments.join(", ")}</div>
                </>
              ) : null}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Documents</div>

              {docsLoading ? (
                <div className="muted">Loading documents…</div>
              ) : docsError ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(253,224,71,.35)",
                    background: "rgba(253,224,71,.08)",
                    color: "#fde68a",
                    fontWeight: 700,
                  }}
                >
                  {docsError}
                  {storagePathUsed ? (
                    <div style={{ marginTop: 8, fontWeight: 600, opacity: 0.85 }}>
                      Source checked: <code style={{ opacity: 0.95 }}>{storagePathUsed}</code>
                    </div>
                  ) : null}
                </div>
              ) : docs.length === 0 ? (
                <div className="muted">
                  No files found.
                  {storagePathUsed ? (
                    <div style={{ marginTop: 8 }}>
                      Source checked: <code>{storagePathUsed}</code>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 10, opacity: 0.8 }}>
                    Source: <code>{storagePathUsed}</code>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                      gap: 10,
                    }}
                  >
                    {docs.map((a, idx) => (
                      <a
                        key={a.id || a.url || idx}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "block",
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,.12)",
                          background: "rgba(255,255,255,.04)",
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.85,
                            marginBottom: 6,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={a.name}
                        >
                          {a.name}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.55,
                            marginBottom: 8,
                          }}
                        >
                          {a.source === "firestore" ? "Firestore file record" : "Storage file"}
                        </div>

                        <div
                          style={{
                            height: 120,
                            display: "grid",
                            placeItems: "center",
                            background: "rgba(0,0,0,.22)",
                            borderRadius: 10,
                          }}
                        >
                          <span style={{ fontSize: 12, opacity: 0.7 }}>Open</span>
                        </div>

                        {a.uploadedAt ? (
                          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
                            {displayDate(a.uploadedAt)}
                          </div>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <LuxeBtn onClick={closeReview}>Close</LuxeBtn>

                <LuxeBtn kind="emerald" onClick={() => setStatus(revRow, "APPROVED")}>
                  Approve (role = {normalizeType(revRow.type)})
                </LuxeBtn>

                <LuxeBtn kind="ruby" onClick={() => setStatus(revRow, "REJECTED")}>
                  Reject
                </LuxeBtn>

                <LuxeBtn kind="slate" onClick={() => handleMoreInfo(revRow)}>
                  More info
                </LuxeBtn>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <LuxeBtn
                  kind="gold"
                  disabled={normalizeStatus(revRow.status) !== "APPROVED"}
                  title={
                    normalizeStatus(revRow.status) !== "APPROVED"
                      ? "Approve first, then verify."
                      : "Mark as Verified (badge)."
                  }
                  onClick={() => openVerify(revRow)}
                >
                  Verify ✅
                </LuxeBtn>

                <LuxeBtn
                  kind="slate"
                  disabled={
                    normalizeStatus(revRow.status) !== "APPROVED" ||
                    !revUser ||
                    !isVerifiedForType(revUser, revRow.type)
                  }
                  title="Remove Verified badge"
                  onClick={() => openUnverify(revRow)}
                >
                  Unverify
                </LuxeBtn>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={moreInfoOpen}
        onClose={() => {
          setMoreInfoOpen(false);
          setMoreInfoRow(null);
        }}
        title="Request more information"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 6,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Message to host/partner
            </label>
            <textarea
              value={moreInfoNote}
              onChange={(e) => setMoreInfoNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "#dfe3ea",
                padding: "10px 12px",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 6,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Required documents (comma-separated)
            </label>
            <input
              value={moreInfoDocs}
              onChange={(e) => setMoreInfoDocs(e.target.value)}
              placeholder="e.g. passport, utility_bill"
              style={{
                width: "100%",
                height: 42,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "#dfe3ea",
                padding: "0 12px",
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <LuxeBtn kind="gold" onClick={submitMoreInfo} disabled={moreInfoBusy}>
              {moreInfoBusy ? "Sending…" : "Send request"}
            </LuxeBtn>
            <LuxeBtn
              kind="slate"
              onClick={() => {
                setMoreInfoOpen(false);
                setMoreInfoRow(null);
              }}
            >
              Cancel
            </LuxeBtn>
          </div>
        </div>
      </Modal>

      <Modal
        open={verifyOpen}
        onClose={() => {
          setVerifyOpen(false);
          setVerifyRow(null);
        }}
        title="Grant verification badge"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            This grants the verified badge to the host/partner. Add an optional note for
            your records.
          </p>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 6,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Verification note (optional)
            </label>
            <textarea
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "#dfe3ea",
                padding: "10px 12px",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <LuxeBtn kind="emerald" onClick={submitVerify} disabled={verifyBusy}>
              {verifyBusy ? "Verifying…" : "Confirm verify ✅"}
            </LuxeBtn>
            <LuxeBtn
              kind="slate"
              onClick={() => {
                setVerifyOpen(false);
                setVerifyRow(null);
              }}
            >
              Cancel
            </LuxeBtn>
          </div>
        </div>
      </Modal>

      <Modal
        open={unverifyOpen}
        onClose={() => {
          setUnverifyOpen(false);
          setUnverifyRow(null);
        }}
        title="Remove verification badge"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ fontSize: 13, color: "#fca5a5", fontWeight: 700 }}>
            This will remove the verified badge from this host/partner.
          </p>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 6,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Reason (optional)
            </label>
            <textarea
              value={unverifyNote}
              onChange={(e) => setUnverifyNote(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "#dfe3ea",
                padding: "10px 12px",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <LuxeBtn kind="ruby" onClick={submitUnverify} disabled={unverifyBusy}>
              {unverifyBusy ? "Removing…" : "Confirm remove"}
            </LuxeBtn>
            <LuxeBtn
              kind="slate"
              onClick={() => {
                setUnverifyOpen(false);
                setUnverifyRow(null);
              }}
            >
              Cancel
            </LuxeBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}