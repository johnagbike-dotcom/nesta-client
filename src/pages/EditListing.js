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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import ListingMap from "../components/ListingMap";

/* ───────────────────────── config ───────────────────────── */
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || "";

/* ───────────────────────── helpers ───────────────────────── */

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

  const ownerCandidates = [
    listing.ownerUid,
    listing.ownerId,
    listing.hostUid,
    listing.hostId,
    listing.partnerUid,
    listing.partnerId,
    listing.userUid,
    listing.userId,
    listing.createdBy,
    listing.createdByUid,
  ].filter(Boolean);

  return ownerCandidates.includes(uid);
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

/* ───────────────────────── plans ───────────────────────── */

const FEATURE_PLANS = {
  spotlight: { key: "spotlight", label: "Spotlight · 24 hours", price: 20000, durationDays: 1, tagline: "Great for last-minute boosts" },
  premium: { key: "premium", label: "Premium · 7 days", price: 70000, durationDays: 7, tagline: "Week-long visibility in peak areas" },
  signature: { key: "signature", label: "Signature · 30 days", price: 250000, durationDays: 30, tagline: "Flagship placement for serious hosts" },
};

function Section({ title, children }) {
  return (
    <section className="border-t border-white/10 pt-6 mt-6">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

/* ───────────────────────── Feature plan modal ───────────────────────── */

function FeaturePlanModal({ open, onClose, onConfirm, initialPlanKey = "spotlight" }) {
  const [choice, setChoice] = useState(initialPlanKey || "spotlight");

  useEffect(() => {
    if (open) setChoice(initialPlanKey || "spotlight");
  }, [open, initialPlanKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-black/70 shadow-2xl p-5 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Boost this listing in the Nesta carousel</h3>
            <p className="text-xs text-white/60 mt-1">
              Choose a spotlight plan. Admin reviews first. After approval, you’ll pay securely and admin activates your placement.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mb-5">
          {Object.values(FEATURE_PLANS).map((plan) => {
            const active = choice === plan.key;
            return (
              <button
                key={plan.key}
                type="button"
                onClick={() => setChoice(plan.key)}
                className={`flex flex-col items-start text-left rounded-2xl border px-3 py-3 text-xs transition ${
                  active
                    ? "border-amber-400 bg-amber-500/15 shadow-[0_18px_40px_rgba(0,0,0,0.65)]"
                    : "border-white/10 bg-black/40 hover:bg-black/60"
                }`}
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 mb-1">
                  {plan.key === "spotlight" ? "Entry" : plan.key === "premium" ? "Popular" : "Flagship"}
                </div>
                <div className="text-sm font-semibold text-white mb-1">{plan.label}</div>
                <div className="text-[11px] text-white/60 mb-2">{plan.tagline}</div>
                <div className="mt-auto text-xs font-semibold text-amber-300">₦{plan.price.toLocaleString()}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-sm text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choice)}
            className="px-4 py-2 rounded-xl border border-amber-400/60 bg-amber-500/80 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Submit request
          </button>
          <div className="md:ml-auto text-[11px] text-white/55">Admin approves → you pay → admin activates.</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── component ───────────────────────── */

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const role = normalizeRole(profile?.role || profile?.type);
  const isAdmin = profile?.isAdmin === true || role === "admin";

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
    type: "apartment",
    bedrooms: "",
    bathrooms: "",
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

  const [newPhotos, setNewPhotos] = useState([]);

  // live feature request (latest)
  const [featureReq, setFeatureReq] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const canEdit = canEditListing(user, profile, listing);
  const canSave = canEdit && !busy && !!form.title && !!form.city;

  /* ───────────────────────── load listing ───────────────────────── */
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "listings", id));
        if (!snap.exists()) {
          window.alert("Listing not found.");
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
          type: data.type || "apartment",
          bedrooms: data.bedrooms || "",
          bathrooms: data.bathrooms || "",
          maxGuests: data.maxGuests || "",
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
        window.alert("Failed to load listing.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  /* ───────────────────────── live feature request ───────────────────────── */
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
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setFeatureReq({ id: docSnap.id, ...docSnap.data() });
        } else {
          setFeatureReq(null);
        }
      },
      (err) => {
        console.error("featureRequests listener error", err);
      }
    );

    return () => unsub();
  }, [id]);

  /* ───────────────────────── helpers ───────────────────────── */

  const updateField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const amenitiesOptions = [
    "Wi-Fi",
    "Air conditioning",
    "Parking",
    "Swimming pool",
    "24/7 security",
    "Generator / Inverter",
    "Housekeeping",
    "Smart TV",
  ];

  const toggleAmenity = (amenity) =>
    setForm((f) => {
      const has = f.amenities.includes(amenity);
      return { ...f, amenities: has ? f.amenities.filter((x) => x !== amenity) : [...f.amenities, amenity] };
    });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNewPhotos(files);
  };

  const uploadNewPhotos = async () => {
    if (!newPhotos.length) return [];
    const uploaded = [];
    for (const file of newPhotos) {
      const storageRef = ref(storage, `listingPhotos/${id}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      uploaded.push(url);
    }
    return uploaded;
  };

  /* ───────────────────────── save / delete ───────────────────────── */

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canSave) return;

    setBusy(true);
    try {
      const photoUrls = await uploadNewPhotos();
      const mergedPhotos = [...(form.photos || []), ...photoUrls].filter(Boolean);

      const nightly = Number(form.nightlyRate || form.pricePerNight || 0);

      const payload = {
        title: String(form.title || "").trim(),
        description: String(form.description || "").trim(),
        city: String(form.city || "").trim(),
        area: String(form.area || "").trim(),
        neighbourhood: String(form.neighbourhood || "").trim(),
        address: String(form.address || "").trim(),

        // Pricing consistency
        nightlyRate: nightly || "",
        pricePerNight: nightly || "",

        type: form.type,
        bedrooms: Number(form.bedrooms) || "",
        bathrooms: Number(form.bathrooms) || "",
        maxGuests: Number(form.maxGuests) || "",
        amenities: form.amenities,

        // Images compatibility
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
      window.alert("Listing updated.");
      navigate("/host");
    } catch (e) {
      console.error(e);
      window.alert("Failed to save listing.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this listing permanently?")) return;
    try {
      await deleteDoc(doc(db, "listings", id));
      window.alert("Listing deleted.");
      navigate("/host");
    } catch (e) {
      console.error(e);
      window.alert("Failed to delete listing.");
    }
  };

  /* ───────────────────────── featured workflow (luxury standard) ───────────────────────── */

  const featureStatus = String(featureReq?.status || "").toLowerCase();

  const planLabel = useMemo(() => {
    if (!featureReq) return null;
    if (featureReq.planLabel) return featureReq.planLabel;
    const k = featureReq.planId || featureReq.planKey;
    if (k && FEATURE_PLANS[k]) return FEATURE_PLANS[k].label;
    return "Custom plan";
  }, [featureReq]);

  const {
    requestSummary,
    requestHelpText,
    requestButtonLabel,
    requestButtonDisabled,
    showPayNowAction,
  } = useMemo(() => {
    if (!featureReq) {
      return {
        requestSummary: "No featured request yet.",
        requestHelpText: "Boost visibility by appearing in the homepage Featured carousel.",
        requestButtonLabel: "Request Featured",
        requestButtonDisabled: false,
        showPayNowAction: false,
      };
    }

    if (featureStatus === "pending") {
      return {
        requestSummary: `Featured request: Pending — ${planLabel}`,
        requestHelpText: "Admin is reviewing your request. After approval, it becomes ‘Awaiting payment’.",
        requestButtonLabel: "Request pending",
        requestButtonDisabled: true,
        showPayNowAction: false,
      };
    }

    if (featureStatus === "awaiting-payment") {
      return {
        requestSummary: `Featured request: Awaiting payment — ${planLabel}`,
        requestHelpText: "Admin approved and locked your plan. Complete payment to proceed.",
        requestButtonLabel: "Pay now",
        requestButtonDisabled: false,
        showPayNowAction: true,
      };
    }

    if (featureStatus === "paid" || featureStatus === "paid-needs-review") {
      return {
        requestSummary: `Payment received — ${planLabel}`,
        requestHelpText: "Payment is recorded. Admin will activate your placement after final checks.",
        requestButtonLabel: "Paid (awaiting activation)",
        requestButtonDisabled: true,
        showPayNowAction: false,
      };
    }

    if (featureStatus === "active") {
      return {
        requestSummary: `Featured placement active — ${planLabel}`,
        requestHelpText: "Your property is currently eligible for the homepage Featured carousel.",
        requestButtonLabel: "Currently featured",
        requestButtonDisabled: true,
        showPayNowAction: false,
      };
    }

    if (featureStatus === "rejected") {
      return {
        requestSummary: `Featured request: Rejected — ${planLabel}`,
        requestHelpText: featureReq?.adminNote || "You can submit a new request when ready.",
        requestButtonLabel: "Request again",
        requestButtonDisabled: false,
        showPayNowAction: false,
      };
    }

    // fallback
    return {
      requestSummary: "No featured request yet.",
      requestHelpText: "Boost visibility by appearing in the homepage Featured carousel.",
      requestButtonLabel: "Request Featured",
      requestButtonDisabled: false,
      showPayNowAction: false,
    };
  }, [featureReq, featureStatus, planLabel]);

  const handleOpenPlanModal = () => {
    if (featureReq && ["pending", "awaiting-payment", "paid", "paid-needs-review", "active"].includes(featureStatus)) {
      window.alert("You already have a featured request in progress for this listing.");
      return;
    }
    setPlanModalOpen(true);
  };

  const confirmPlanAndRequest = async (planKey) => {
    if (!user || !listing) {
      window.alert("Listing not ready yet, please try again.");
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

        // start pending; admin will approve -> awaiting-payment and lock terms if needed
        status: "pending",
        archived: false,

        // initial terms (admin may override/lock)
        planId: plan.key,
        planLabel: plan.label,
        price: plan.price,
        durationDays: plan.durationDays,

        primaryImageUrl,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPlanModalOpen(false);
      window.alert("Request sent. Admin will review shortly.");
    } catch (e) {
      console.error(e);
      window.alert("Could not send request. Please try again later.");
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
        window.alert("No featured request found for this listing.");
        return;
      }
      if (String(featureReq.status || "").toLowerCase() !== "awaiting-payment") {
        window.alert("This request is not approved for payment yet.");
        return;
      }

      const amountNaira = Number(featureReq.price ?? featureReq.planPrice ?? 0);
      if (!amountNaira || Number.isNaN(amountNaira) || amountNaira <= 0) {
        window.alert("This plan does not have a valid locked price. Admin must approve and set price.");
        return;
      }

      if (!PAYSTACK_PUBLIC_KEY) {
        window.alert("Missing Paystack public key. Set REACT_APP_PAYSTACK_PUBLIC_KEY in your .env file.");
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

        // reference is used as your idempotency key in webhook
        ref: featureRequestId,

        metadata: {
          type: "featured",
          featureRequestId,
          listingId: id,
          planId: featureReq.planId || featureReq.planKey || "custom",
          planLabel: featureReq.planLabel || "",
        },

        callback: (response) => {
          // IMPORTANT: do NOT activate listing here.
          // Webhook will mark PAID; admin activates after QC.
          (async () => {
            try {
              await updateDoc(doc(db, "featureRequests", featureRequestId), {
                paymentAttemptRef: response.reference,
                paymentAttemptedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // do not set paid:true here; webhook is source of truth
              });

              window.alert(
                "✅ Payment submitted.\n\nYour payment will be confirmed automatically (webhook). Once confirmed, admin will activate your carousel placement."
              );
            } catch (err) {
              console.error("[Paystack callback] update failed:", err);
              window.alert(
                "Payment succeeded, but we could not record your attempt automatically.\nPlease contact Nesta support with this reference: " +
                  response.reference
              );
            }
          })();
        },

        onClose: () => {
          // optional: no alert
        },
      });

      handler.openIframe();
    } catch (err) {
      console.error("[handlePayNow] error:", err);
      window.alert("Could not start payment. Please refresh and try again.");
    }
  };

  /* ───────────────────────── render guards ───────────────────────── */

  if (loading) {
    return <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">Loading listing…</main>;
  }

  if (!listing) {
    return <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">Listing not found.</main>;
  }

  if (!canEdit) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">
        <h2 className="text-xl font-semibold mb-2">You don't have permission to edit this listing.</h2>
        <p className="text-white/60">Only the listing owner or a Nesta admin can make changes.</p>
      </main>
    );
  }

  /* ───────────────────────── main render ───────────────────────── */

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-8 text-white">
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5"
          >
            ← Back
          </button>

          <div>
            <div className="text-sm text-white/60">Edit listing</div>
            <h1 className="text-2xl font-semibold">{form.title || "Untitled"}</h1>
          </div>

          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`px-4 py-2 rounded-xl border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-50 ${
                !canSave ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-6">
          <Section title="Basics">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Title</label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Designer studio in Lekki"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Type</label>
                <select
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                >
                  <option value="apartment">Apartment</option>
                  <option value="duplex">Duplex</option>
                  <option value="villa">Villa</option>
                  <option value="studio">Studio</option>
                  <option value="room">Private room</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-white/70 mb-1">Description</label>
              <textarea
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm min-h-[80px]"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Describe what makes this stay special…"
              />
            </div>
          </Section>

          <Section title="Location">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">City</label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Lagos, Abuja, Port Harcourt…"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Area</label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.area}
                  onChange={(e) => updateField("area", e.target.value)}
                  placeholder="Ikoyi, Lekki, Maitama…"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Neighbourhood (optional)</label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.neighbourhood}
                  onChange={(e) => updateField("neighbourhood", e.target.value)}
                  placeholder="Close to Landmark, Eko Atlantic…"
                />
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-sm text-white/70 mb-1">Street address (optional)</label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Shown only to confirmed guests"
                />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Latitude</label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      value={form.lat ?? ""}
                      onChange={(e) => updateField("lat", e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="Click map or paste"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Longitude</label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      value={form.lng ?? ""}
                      onChange={(e) => updateField("lng", e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="Click map or paste"
                    />
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-white/50">
                  Guests only see a nearby area map before booking. Exact details are shared securely after confirmation.
                </p>
              </div>

              <div className="mt-1">
                <ListingMap
                  lat={typeof form.lat === "number" ? form.lat : typeof listing.lat === "number" ? listing.lat : null}
                  lng={typeof form.lng === "number" ? form.lng : typeof listing.lng === "number" ? listing.lng : null}
                  editable
                  onChange={(pos) => {
                    updateField("lat", pos.lat);
                    updateField("lng", pos.lng);
                  }}
                />
              </div>
            </div>
          </Section>

          <Section title="Pricing & capacity">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Nightly rate (₦)</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.nightlyRate}
                  onChange={(e) => {
                    updateField("nightlyRate", e.target.value);
                    updateField("pricePerNight", e.target.value);
                  }}
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Bedrooms</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.bedrooms}
                  onChange={(e) => updateField("bedrooms", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Bathrooms</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.bathrooms}
                  onChange={(e) => updateField("bathrooms", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Max guests</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.maxGuests}
                  onChange={(e) => updateField("maxGuests", e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Amenities">
            <div className="flex flex-wrap gap-2">
              {amenitiesOptions.map((a) => {
                const active = form.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      active
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-100"
                        : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Photos">
            <div className="grid md:grid-cols-4 gap-3 mb-4">
              {(form.photos || []).map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video">
                  <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}

              {(form.photos || []).length === 0 && (
                <div className="text-sm text-white/60">
                  No photos yet. Upload at least one high-quality image for best results.
                </div>
              )}
            </div>

            <input type="file" multiple accept="image/*" onChange={handleFileChange} className="text-sm" />
            {newPhotos.length > 0 && (
              <div className="text-xs text-white/60 mt-1">{newPhotos.length} new photo(s) will upload on save.</div>
            )}
          </Section>

          <Section title="Booking options">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.instantBook}
                onChange={(e) => updateField("instantBook", e.target.checked)}
              />
              <span>Enable instant booking</span>
            </label>
          </Section>

          <Section title="Featured (carousel)">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm flex flex-col gap-2">
              <div className="text-xs text-amber-200">{requestSummary}</div>
              <div className="text-xs text-white/60">{requestHelpText}</div>
            </div>
          </Section>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            disabled={busy || !canSave}
            onClick={handleSave}
            className={`px-5 py-3 rounded-xl border border-emerald-400/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-sm font-semibold ${
              !canSave ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            disabled={featureBusy || requestButtonDisabled}
            onClick={showPayNowAction ? handlePayNow : handleOpenPlanModal}
            className={`px-5 py-3 rounded-xl border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-sm font-semibold ${
              featureBusy || requestButtonDisabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {featureBusy ? "Working…" : showPayNowAction ? "Pay now" : requestButtonLabel}
          </button>

          <div className="ml-auto text-sm text-white/60">
            Role: <strong>{profile?.role || "host/partner"}</strong>
            {isAdmin && " · Admin"}
          </div>
        </div>
      </main>

      <FeaturePlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onConfirm={confirmPlanAndRequest}
        initialPlanKey="spotlight"
      />
    </>
  );
}
