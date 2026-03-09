// src/pages/EditListing.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import ListingMap from "../components/ListingMap";
import ImageUploader from "../components/ImageUploader";

/* ─────────────────────────── config ─────────────────────────── */
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || "";

/* ─────────────────────────── constants ─────────────────────────── */
const TYPES = ["Apartment", "Bungalow", "Studio", "Loft", "Villa", "Penthouse", "Hotel", "Other"];

const AMENITIES = [
  "Wi-Fi",
  "Air conditioning",
  "24/7 Power",
  "Smart TV",
  "Workspace",
  "Kitchen",
  "Security",
  "Parking",
  "Pool",
  "Gym",
  "Generator",
  "Elevator",
  "Balcony",
  "Garden",
];

const FEATURE_PLANS = {
  spotlight: {
    key: "spotlight",
    label: "Spotlight · 24 hours",
    price: 20000,
    durationDays: 1,
    tagline: "Great for last-minute boosts",
    tier: "Entry",
  },
  premium: {
    key: "premium",
    label: "Premium · 7 days",
    price: 70000,
    durationDays: 7,
    tagline: "Week-long visibility in peak areas",
    tier: "Popular",
  },
  signature: {
    key: "signature",
    label: "Signature · 30 days",
    price: 250000,
    durationDays: 30,
    tagline: "Flagship placement for serious hosts",
    tier: "Flagship",
  },
};

/* ─────────────────────────── helpers ─────────────────────────── */
function normalizeRole(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "verified_host") return "host";
  if (r === "verified_partner") return "partner";
  if (!r) return "guest";
  return r;
}

function canEditListing(user, profile, listing) {
  if (!user || !listing) return false;
  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";
  if (isAdmin) return true;

  const uid = user.uid;
  const candidates = [
    listing.ownerUid, listing.ownerId,
    listing.hostUid, listing.hostId,
    listing.partnerUid, listing.partnerId,
    listing.userUid, listing.userId,
    listing.createdBy, listing.createdByUid,
  ].filter(Boolean);

  return candidates.includes(uid);
}

function pickPhotos(data) {
  if (!data) return [];
  const a =
    (Array.isArray(data.photos) && data.photos) ||
    (Array.isArray(data.images) && data.images) ||
    (Array.isArray(data.imageUrls) && data.imageUrls) ||
    [];
  return a.filter(Boolean);
}

function toNullableNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ─────────────────────────── shared UI primitives ─────────────────────────── */
const inputCls =
  "w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2.5 text-white/90 text-sm outline-none focus:border-amber-400/70 transition-colors placeholder-white/25";

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-white/55">
        {label}
      </div>
      {hint ? <div className="text-[11px] text-white/40 -mt-1">{hint}</div> : null}
      <div>{children}</div>
    </label>
  );
}

function TextInput(props) {
  return <input {...props} className={[inputCls, props.className || ""].join(" ")} />;
}

function SelectInput({ children, ...props }) {
  return (
    <select {...props} className={[inputCls, props.className || ""].join(" ")}>
      {children}
    </select>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full min-h-[100px] rounded-2xl bg-black/30 border border-white/10",
        "px-3 py-2.5 text-white/90 text-sm outline-none focus:border-amber-400/70 transition-colors resize-y placeholder-white/25",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-white/8 bg-[#0c0f16] p-5 md:p-6 space-y-4">
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-[13px] text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function AmenityToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium border transition-all",
        checked
          ? "bg-amber-400/15 border-amber-400/50 text-amber-300"
          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-2.5 w-2.5 rounded-full transition-colors",
          checked ? "bg-amber-400" : "bg-white/25",
        ].join(" ")}
      />
      {label}
    </button>
  );
}

/* ─────────────────────────── Confirm modal ─────────────────────────── */
function ConfirmModal({ open, title, body, confirmLabel, tone = "red", onConfirm, onCancel }) {
  if (!open) return null;
  const btnCls =
    tone === "red"
      ? "bg-red-500/80 hover:bg-red-500 border-red-500/60 text-white"
      : "bg-amber-400 hover:bg-amber-300 border-amber-400/60 text-black";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e1118] shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white">{title}</h3>
        {body && <p className="text-[13px] text-white/60 leading-relaxed">{body}</p>}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={["flex-1 py-2.5 rounded-2xl border text-sm font-semibold transition-all", btnCls].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Info modal ─────────────────────────── */
function InfoModal({ open, title, body, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e1118] shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white">{title}</h3>
        {body && <p className="text-[13px] text-white/60 leading-relaxed">{body}</p>}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm hover:bg-white/10 transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Feature plan modal ─────────────────────────── */
function FeaturePlanModal({ open, onClose, onConfirm, initialPlanKey = "spotlight" }) {
  const [choice, setChoice] = useState(initialPlanKey || "spotlight");

  useEffect(() => {
    if (open) setChoice(initialPlanKey || "spotlight");
  }, [open, initialPlanKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0e1118] shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold text-white">Boost this listing</h3>
          <p className="text-[13px] text-white/55 mt-1">
            Choose a spotlight plan. Admin reviews first. After approval, you'll pay securely and
            admin activates your placement.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {Object.values(FEATURE_PLANS).map((plan) => {
            const active = choice === plan.key;
            return (
              <button
                key={plan.key}
                type="button"
                onClick={() => setChoice(plan.key)}
                className={[
                  "flex flex-col items-start text-left rounded-2xl border px-4 py-3 transition-all",
                  active
                    ? "border-amber-400 bg-amber-500/15"
                    : "border-white/10 bg-black/40 hover:bg-black/60",
                ].join(" ")}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-1">
                  {plan.tier}
                </div>
                <div className="text-sm font-semibold text-white mb-1">{plan.label}</div>
                <div className="text-[11px] text-white/55 mb-3">{plan.tagline}</div>
                <div className="mt-auto text-sm font-bold text-amber-300">
                  ₦{plan.price.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choice)}
            className="px-5 py-2.5 rounded-2xl border border-amber-400/60 bg-amber-500/80 text-sm font-semibold text-black hover:bg-amber-400 transition-all"
          >
            Submit request
          </button>
          <div className="ml-auto text-[11px] text-white/45">
            Admin approves → you pay → admin activates.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main component ─────────────────────────── */
export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

  /* ── state ─────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [featureBusy, setFeatureBusy] = useState(false);
  const [listing, setListing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    area: "",
    neighbourhood: "",
    address: "",
    nightlyRate: "",
    pricePerNight: "",
    type: "Apartment",
    bedrooms: "",
    bathrooms: "",
    beds: "",
    maxGuests: "",
    amenities: [],
    photos: [],
    instantBook: false,
    ownerUid: "",
    partnerUid: "",
    sponsored: false,
    lat: null,
    lng: null,
  });

  const [featureReq, setFeatureReq] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Modal state — replaces all window.alert / window.confirm
  const [infoModal, setInfoModal] = useState({ open: false, title: "", body: "" });
  const [confirmModal, setConfirmModal] = useState({
    open: false, title: "", body: "", confirmLabel: "", tone: "red", onConfirm: null,
  });

  const showInfo = (title, body) => setInfoModal({ open: true, title, body });
  const closeInfo = () => setInfoModal((p) => ({ ...p, open: false }));

  const showConfirm = ({ title, body, confirmLabel, tone = "red", onConfirm }) =>
    setConfirmModal({ open: true, title, body, confirmLabel, tone, onConfirm });
  const closeConfirm = () => setConfirmModal((p) => ({ ...p, open: false }));

  /* ── derived ───────────────────────────────────────────────────── */
  const canEdit = canEditListing(user, profile, listing);
  const canSave = canEdit && !busy && !!form.title.trim() && !!form.city.trim();

  /* ── load listing ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "listings", id));
        if (!snap.exists()) {
          showInfo("Not found", "This listing could not be found.");
          navigate("/host");
          return;
        }

        const data = snap.data();
        const photos = pickPhotos(data);

        setListing({ id: snap.id, ...data });
        setForm({
          title: data.title || "",
          description: data.description || "",
          city: data.city || "",
          area: data.area || "",
          neighbourhood: data.neighbourhood || "",
          address: data.address || "",
          nightlyRate: data.nightlyRate ?? data.pricePerNight ?? "",
          pricePerNight: data.pricePerNight ?? data.nightlyRate ?? "",
          type: data.type || "Apartment",
          bedrooms: data.bedrooms ?? "",
          bathrooms: data.bathrooms ?? "",
          beds: data.beds ?? data.bedCount ?? data.numberOfBeds ?? "",
          maxGuests: data.maxGuests ?? "",
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          photos,
          instantBook: !!data.instantBook,
          ownerUid: data.ownerUid || data.ownerId || "",
          partnerUid: data.partnerUid || "",
          sponsored: !!data.sponsored,
          lat: typeof data.lat === "number" ? data.lat : null,
          lng: typeof data.lng === "number" ? data.lng : null,
        });
      } catch (e) {
        console.error(e);
        showInfo("Load failed", "Could not load listing. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  /* ── live feature request ──────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;

    const qRef = query(
      collection(db, "featureRequests"),
      where("listingId", "==", id),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setFeatureReq(
          snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
        );
      },
      (err) => console.error("featureRequests listener:", err)
    );

    return () => unsub();
  }, [id]);

  /* ── form helpers ──────────────────────────────────────────────── */
  const updateField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleAmenity = (amenity) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(amenity)
        ? f.amenities.filter((x) => x !== amenity)
        : [...f.amenities, amenity],
    }));

  /* ── save ──────────────────────────────────────────────────────── */
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canSave) return;

    setBusy(true);
    setSaveErr("");
    setSaveSuccess(false);

    try {
      const mergedPhotos = [...(form.photos || [])].filter(Boolean);
      const nightly = Number(form.nightlyRate || form.pricePerNight || 0);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        neighbourhood: form.neighbourhood.trim(),
        address: form.address.trim(),

        nightlyRate: nightly || "",
        pricePerNight: nightly || "",

        type: form.type,
        bedrooms: toNullableNumber(form.bedrooms),
        bathrooms: toNullableNumber(form.bathrooms),
        beds: toNullableNumber(form.beds),
        maxGuests: toNullableNumber(form.maxGuests),

        amenities: form.amenities,

        photos: mergedPhotos,
        images: mergedPhotos,
        imageUrls: mergedPhotos,
        primaryImageUrl: mergedPhotos[0] || listing?.primaryImageUrl || null,

        instantBook: !!form.instantBook,
        ownerUid: form.ownerUid || listing?.ownerUid || user?.uid || "",
        partnerUid: form.partnerUid || listing?.partnerUid || "",
        sponsored: !!form.sponsored,

        lat: typeof form.lat === "number" ? form.lat : null,
        lng: typeof form.lng === "number" ? form.lng : null,

        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "listings", id), payload);
      setSaveSuccess(true);
      // Navigate after short delay so user sees success
      setTimeout(() => navigate("/host"), 1200);
    } catch (e) {
      console.error(e);
      setSaveErr(e?.message || "Could not save listing. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ── delete ────────────────────────────────────────────────────── */
  const handleDelete = () => {
    showConfirm({
      title: "Delete this listing?",
      body: "This is permanent and cannot be undone. All booking history will remain but the listing will no longer be visible.",
      confirmLabel: "Delete permanently",
      tone: "red",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "listings", id));
          navigate("/host");
        } catch (e) {
          console.error(e);
          showInfo("Delete failed", "Could not delete listing. Please try again.");
        }
      },
    });
  };

  /* ── featured workflow ─────────────────────────────────────────── */
  const featureStatus = String(featureReq?.status || "").toLowerCase();

  const planLabel = useMemo(() => {
    if (!featureReq) return null;
    if (featureReq.planLabel) return featureReq.planLabel;
    const k = featureReq.planId || featureReq.planKey;
    return (k && FEATURE_PLANS[k]?.label) || "Custom plan";
  }, [featureReq]);

  const {
    requestSummary,
    requestHelpText,
    requestButtonLabel,
    requestButtonDisabled,
    showPayNowAction,
    featureStatusTone,
  } = useMemo(() => {
    if (!featureReq)
      return {
        requestSummary: "No featured request yet.",
        requestHelpText: "Boost visibility by appearing in the homepage Featured carousel.",
        requestButtonLabel: "Request Featured",
        requestButtonDisabled: false,
        showPayNowAction: false,
        featureStatusTone: "neutral",
      };

    const map = {
      pending: {
        requestSummary: `Pending review — ${planLabel}`,
        requestHelpText: "Admin is reviewing your request. After approval it becomes 'Awaiting payment'.",
        requestButtonLabel: "Request pending",
        requestButtonDisabled: true,
        showPayNowAction: false,
        featureStatusTone: "amber",
      },
      "awaiting-payment": {
        requestSummary: `Approved — payment required — ${planLabel}`,
        requestHelpText: "Admin approved and locked your plan. Complete payment to proceed.",
        requestButtonLabel: "Pay now",
        requestButtonDisabled: false,
        showPayNowAction: true,
        featureStatusTone: "amber",
      },
      paid: {
        requestSummary: `Payment received — ${planLabel}`,
        requestHelpText: "Admin will activate your carousel placement after final checks.",
        requestButtonLabel: "Paid — awaiting activation",
        requestButtonDisabled: true,
        showPayNowAction: false,
        featureStatusTone: "emerald",
      },
      "paid-needs-review": {
        requestSummary: `Payment received — ${planLabel}`,
        requestHelpText: "Admin will activate your carousel placement after final checks.",
        requestButtonLabel: "Paid — awaiting activation",
        requestButtonDisabled: true,
        showPayNowAction: false,
        featureStatusTone: "emerald",
      },
      active: {
        requestSummary: `Featured placement active — ${planLabel}`,
        requestHelpText: "Your property is currently in the homepage Featured carousel.",
        requestButtonLabel: "Currently featured",
        requestButtonDisabled: true,
        showPayNowAction: false,
        featureStatusTone: "emerald",
      },
      rejected: {
        requestSummary: `Request rejected — ${planLabel}`,
        requestHelpText: featureReq?.adminNote || "You can submit a new request when ready.",
        requestButtonLabel: "Request again",
        requestButtonDisabled: false,
        showPayNowAction: false,
        featureStatusTone: "red",
      },
    };

    return (
      map[featureStatus] || {
        requestSummary: "No featured request yet.",
        requestHelpText: "Boost visibility in the homepage Featured carousel.",
        requestButtonLabel: "Request Featured",
        requestButtonDisabled: false,
        showPayNowAction: false,
        featureStatusTone: "neutral",
      }
    );
  }, [featureReq, featureStatus, planLabel]);

  const handleOpenPlanModal = () => {
    if (
      featureReq &&
      ["pending", "awaiting-payment", "paid", "paid-needs-review", "active"].includes(featureStatus)
    ) {
      showInfo(
        "Request already in progress",
        "You already have a featured request active for this listing. Check the status below."
      );
      return;
    }
    setPlanModalOpen(true);
  };

  const confirmPlanAndRequest = async (planKey) => {
    if (!user || !listing) {
      showInfo("Not ready", "Listing not ready yet. Please try again.");
      return;
    }

    const plan = FEATURE_PLANS[planKey] || FEATURE_PLANS.spotlight;
    const primaryImageUrl =
      (Array.isArray(form.photos) && form.photos[0]) ||
      (Array.isArray(listing.photos) && listing.photos[0]) ||
      listing.primaryImageUrl ||
      null;

    setFeatureBusy(true);
    try {
      await addDoc(collection(db, "featureRequests"), {
        kind: "listing-feature",
        type: "featured-carousel",
        listingId: id,
        listingTitle: form.title || listing.title || "",
        hostUid: listing.ownerUid || listing.ownerId || user.uid,
        hostEmail: user.email || profile?.email || "",
        requesterRole: profile?.role || "",
        status: "pending",
        archived: false,
        planId: plan.key,
        planLabel: plan.label,
        price: plan.price,
        durationDays: plan.durationDays,
        primaryImageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPlanModalOpen(false);
      showInfo(
        "Request submitted",
        "Admin will review your featured request shortly. You'll see the status update here."
      );
    } catch (e) {
      console.error(e);
      showInfo("Request failed", "Could not send request. Please try again later.");
    } finally {
      setFeatureBusy(false);
    }
  };

  const ensurePaystackScript = () =>
    new Promise((resolve, reject) => {
      if (window.PaystackPop) return resolve();
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Paystack failed to load"));
      document.body.appendChild(script);
    });

  const handlePayNow = async () => {
    try {
      if (!featureReq) {
        showInfo("No request found", "No featured request found for this listing.");
        return;
      }

      if (String(featureReq.status || "").toLowerCase() !== "awaiting-payment") {
        showInfo("Not ready for payment", "This request is not approved for payment yet.");
        return;
      }

      const amountNaira = Number(featureReq.price ?? featureReq.planPrice ?? 0);
      if (!amountNaira || Number.isNaN(amountNaira) || amountNaira <= 0) {
        showInfo("Invalid price", "This plan does not have a valid locked price. Admin must approve and set price.");
        return;
      }

      if (!PAYSTACK_PUBLIC_KEY) {
        showInfo("Config missing", "Missing Paystack public key. Set REACT_APP_PAYSTACK_PUBLIC_KEY in your .env file.");
        return;
      }

      await ensurePaystackScript();

      const amountKobo = Math.round(amountNaira * 100);
      const featureRequestId = featureReq.id;

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: (featureReq.hostEmail || user?.email || "").trim() || "host@nestaapp.ng",
        amount: amountKobo,
        currency: "NGN",
        ref: featureRequestId,
        metadata: {
          type: "featured",
          featureRequestId,
          listingId: id,
          planId: featureReq.planId || featureReq.planKey || "custom",
          planLabel: featureReq.planLabel || "",
        },
        callback: (response) => {
          (async () => {
            try {
              await updateDoc(doc(db, "featureRequests", featureRequestId), {
                paymentAttemptRef: response.reference,
                paymentAttemptedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              showInfo(
                "Payment submitted",
                "Your payment will be confirmed automatically. Once confirmed, admin will activate your carousel placement."
              );
            } catch (err) {
              console.error("[Paystack callback] update failed:", err);
              showInfo(
                "Payment received — action needed",
                `Payment succeeded but we could not record it automatically. Please contact Nesta support with reference: ${response.reference}`
              );
            }
          })();
        },
        onClose: () => {},
      });

      handler.openIframe();
    } catch (err) {
      console.error("[handlePayNow] error:", err);
      showInfo("Payment error", "Could not start payment. Please refresh and try again.");
    }
  };

  /* ── feature status pill colour ───────────────────────────────── */
  const featurePillCls =
    featureStatusTone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : featureStatusTone === "amber"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : featureStatusTone === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-white/10 bg-white/5 text-white/60";

  /* ── render guards ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070a] pt-20 px-4 text-white/60">
        <div className="max-w-3xl mx-auto">Loading listing…</div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-[#05070a] pt-20 px-4 text-white/60">
        <div className="max-w-3xl mx-auto">Listing not found.</div>
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="min-h-screen bg-[#05070a] pt-20 px-4 text-white">
        <div className="max-w-3xl mx-auto space-y-2">
          <h2 className="text-xl font-semibold">Permission denied</h2>
          <p className="text-white/55">Only the listing owner or a Nesta admin can edit this listing.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 rounded-full bg-white/8 border border-white/10 text-sm hover:bg-white/12 transition-all"
          >
            ← Go back
          </button>
        </div>
      </main>
    );
  }

  /* ── main render ───────────────────────────────────────────────── */
  return (
    <>
      {/* ── modals ── */}
      <InfoModal
        open={infoModal.open}
        title={infoModal.title}
        body={infoModal.body}
        onClose={closeInfo}
      />
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        body={confirmModal.body}
        confirmLabel={confirmModal.confirmLabel}
        tone={confirmModal.tone}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
      <FeaturePlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onConfirm={confirmPlanAndRequest}
        initialPlanKey="spotlight"
      />

      {/* ── page ── */}
      {/* ✅ pt-20 keeps back button clear of fixed header */}
      <main className="min-h-screen bg-[#05070a] pt-20 pb-16 px-4 text-white">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Back */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/12 text-sm text-white/70 hover:text-white transition-all"
          >
            ← Back
          </button>

          {/* Header */}
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/40 font-semibold">
                Edit listing
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-amber-300 truncate max-w-lg">
                {form.title || "Untitled"}
              </h1>
              <div className="text-[12px] text-white/40">
                ID: {id} · Role: {profile?.role || "host"}{isAdmin ? " · Admin" : ""}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-2xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm transition-all"
              >
                Delete
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={handleSave}
                className={[
                  "px-4 py-2 rounded-2xl text-sm font-semibold transition-all",
                  canSave
                    ? "border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100"
                    : "border border-white/10 bg-white/5 text-white/30 cursor-not-allowed",
                ].join(" ")}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </header>

          {/* Inline save feedback */}
          {saveErr && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {saveErr}
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Listing updated — redirecting…
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">

            {/* Basics */}
            <Section title="Basics">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Title">
                  <TextInput
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="Designer studio in Lekki"
                    maxLength={80}
                  />
                </Field>

                <Field label="Property type">
                  <SelectInput
                    value={form.type}
                    onChange={(e) => updateField("type", e.target.value)}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              <Field label="Description">
                <TextArea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe what makes this stay special…"
                  maxLength={1000}
                />
                <div className="mt-1 text-right text-[11px] text-white/30">
                  {form.description.length}/1000
                </div>
              </Field>
            </Section>

            {/* Location */}
            <Section title="Location">
              <div className="grid md:grid-cols-3 gap-3">
                <Field label="City">
                  <TextInput
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Lagos, Abuja…"
                  />
                </Field>
                <Field label="Area">
                  <TextInput
                    value={form.area}
                    onChange={(e) => updateField("area", e.target.value)}
                    placeholder="Ikoyi, Lekki…"
                  />
                </Field>
                <Field label="Neighbourhood" hint="Optional">
                  <TextInput
                    value={form.neighbourhood}
                    onChange={(e) => updateField("neighbourhood", e.target.value)}
                    placeholder="Near Landmark…"
                  />
                </Field>
              </div>

              <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <Field label="Street address" hint="Shown only to confirmed guests">
                    <TextInput
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="e.g. 12 Bourdillon Road"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude">
                      <TextInput
                        className="text-xs"
                        value={form.lat ?? ""}
                        onChange={(e) =>
                          updateField("lat", e.target.value === "" ? null : Number(e.target.value))
                        }
                        placeholder="6.435"
                      />
                    </Field>
                    <Field label="Longitude">
                      <TextInput
                        className="text-xs"
                        value={form.lng ?? ""}
                        onChange={(e) =>
                          updateField("lng", e.target.value === "" ? null : Number(e.target.value))
                        }
                        placeholder="3.421"
                      />
                    </Field>
                  </div>

                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Guests see only an approximate area map before booking. Exact location is
                    shared securely after confirmation.
                  </p>
                </div>

                <div>
                  <ListingMap
                    lat={
                      typeof form.lat === "number" ? form.lat
                      : typeof listing.lat === "number" ? listing.lat
                      : null
                    }
                    lng={
                      typeof form.lng === "number" ? form.lng
                      : typeof listing.lng === "number" ? listing.lng
                      : null
                    }
                    editable
                    onChange={(pos) => {
                      updateField("lat", pos.lat);
                      updateField("lng", pos.lng);
                    }}
                  />
                </div>
              </div>
            </Section>

            {/* Pricing & capacity */}
            <Section title="Pricing & capacity">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Field label="Nightly rate (₦)">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    value={form.nightlyRate}
                    onChange={(e) => {
                      updateField("nightlyRate", e.target.value);
                      updateField("pricePerNight", e.target.value);
                    }}
                    placeholder="0"
                  />
                </Field>
                <Field label="Bedrooms">
                  <TextInput
                    type="number"
                    min={0}
                    value={form.bedrooms}
                    onChange={(e) => updateField("bedrooms", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Bathrooms">
                  <TextInput
                    type="number"
                    min={0}
                    value={form.bathrooms}
                    onChange={(e) => updateField("bathrooms", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Beds">
                  <TextInput
                    type="number"
                    min={0}
                    value={form.beds}
                    onChange={(e) => updateField("beds", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Max guests">
                  <TextInput
                    type="number"
                    min={1}
                    value={form.maxGuests}
                    onChange={(e) => updateField("maxGuests", e.target.value)}
                    placeholder="2"
                  />
                </Field>
              </div>
            </Section>

            {/* Amenities */}
            <Section title="Amenities">
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => (
                  <AmenityToggle
                    key={a}
                    label={a}
                    checked={form.amenities.includes(a)}
                    onChange={() => toggleAmenity(a)}
                  />
                ))}
              </div>
              {form.amenities.length > 0 && (
                <p className="text-[11px] text-white/40">
                  {form.amenities.length} selected: {form.amenities.join(", ")}
                </p>
              )}
            </Section>

            {/* Photos */}
            <Section
              title="Photos"
              subtitle="First image becomes the cover photo."
            >
              <ImageUploader
                value={form.photos}
                onChange={(next) => {
                  setForm((prev) => ({
                    ...prev,
                    photos: typeof next === "function"
                      ? next(prev.photos || [])
                      : Array.isArray(next) ? next : [],
                  }));
                }}
                userId={user?.uid}
                disabled={!user?.uid}
              />
            </Section>

            {/* Booking options */}
            <Section title="Booking options">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-400"
                  checked={form.instantBook}
                  onChange={(e) => updateField("instantBook", e.target.checked)}
                />
                <span className="text-sm text-white/80">Enable instant booking</span>
              </label>
            </Section>

            {/* Featured */}
            <Section
              title="Featured placement"
              subtitle="Appear in the homepage carousel to boost bookings."
            >
              <div className={["rounded-2xl border p-4 space-y-2", featurePillCls].join(" ")}>
                <div className="text-sm font-semibold">{requestSummary}</div>
                <div className="text-[13px] opacity-80">{requestHelpText}</div>
              </div>

              <button
                type="button"
                disabled={featureBusy || requestButtonDisabled}
                onClick={showPayNowAction ? handlePayNow : handleOpenPlanModal}
                className={[
                  "px-5 py-2.5 rounded-2xl border text-sm font-semibold transition-all",
                  featureBusy || requestButtonDisabled
                    ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                    : showPayNowAction
                    ? "border-emerald-400/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200"
                    : "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200",
                ].join(" ")}
              >
                {featureBusy ? "Working…" : showPayNowAction ? "Pay now" : requestButtonLabel}
              </button>
            </Section>

          </form>

          {/* Bottom action row */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/5">
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={[
                "px-6 py-3 rounded-2xl text-sm font-semibold transition-all",
                canSave
                  ? "bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20"
                  : "bg-amber-500/20 text-black/40 cursor-not-allowed",
              ].join(" ")}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="ml-auto px-5 py-3 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm transition-all"
            >
              Delete listing
            </button>
          </div>

        </div>
      </main>
    </>
  );
}