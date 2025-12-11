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

/* ───────────────────────── helpers ───────────────────────── */
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || "";

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

  // include all possible owner fields, especially partnerUid
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

// feature plans
const FEATURE_PLANS = {
  spotlight: {
    key: "spotlight",
    label: "Spotlight · 24 hours",
    price: 20000,
    tagline: "Great for last-minute boosts",
  },
  premium: {
    key: "premium",
    label: "Premium · 7 days",
    price: 70000,
    tagline: "Week-long visibility in peak areas",
  },
  signature: {
    key: "signature",
    label: "Signature · 30 days",
    price: 250000,
    tagline: "Flagship placement for serious hosts",
  },
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

function FeaturePlanModal({
  open,
  onClose,
  onConfirm,
  initialPlanKey = "spotlight",
}) {
  const [choice, setChoice] = useState(initialPlanKey || "spotlight");

  useEffect(() => {
    if (open) {
      setChoice(initialPlanKey || "spotlight");
    }
  }, [open, initialPlanKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-black/70 shadow-2xl p-5 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              Boost this listing in the Nesta carousel
            </h3>
            <p className="text-xs text-white/60 mt-1">
              Choose a spotlight plan. Our team will review your request and
              share payment details. Once payment is confirmed, your stay joins
              the homepage Featured carousel.
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
                  {plan.key === "spotlight"
                    ? "Entry"
                    : plan.key === "premium"
                    ? "Popular"
                    : "Flagship"}
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  {plan.label}
                </div>
                <div className="text-[11px] text-white/60 mb-2">
                  {plan.tagline}
                </div>
                <div className="mt-auto text-xs font-semibold text-amber-300">
                  ₦{plan.price.toLocaleString()}
                </div>
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
            Continue with this plan
          </button>
          <div className="md:ml-auto text-[11px] text-white/55">
            You’ll be charged safely via Nesta after an admin accepts your
            request.
          </div>
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

  // live feature request for this listing
  const [featureReq, setFeatureReq] = useState(null);

  // plan modal
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const isAdmin = profile?.isAdmin === true || role === "admin";
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
        setListing({ id: snap.id, ...data });

        setForm({
          title: data.title || "",
          description: data.description || "",
          city: data.city || "",
          area: data.area || "",
          neighbourhood: data.neighbourhood || "",
          address: data.address || "",
          nightlyRate: data.nightlyRate || "",
          type: data.type || "apartment",
          bedrooms: data.bedrooms || "",
          bathrooms: data.bathrooms || "",
          maxGuests: data.maxGuests || "",
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          instantBook: !!data.instantBook,
          ownerUid: data.ownerUid || "",
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

  const updateField = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: value,
    }));

  const toggleAmenity = (amenity) =>
    setForm((f) => {
      const has = f.amenities.includes(amenity);
      return {
        ...f,
        amenities: has
          ? f.amenities.filter((x) => x !== amenity)
          : [...f.amenities, amenity],
      };
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
      const storageRef = ref(
        storage,
        `listingPhotos/${id}/${Date.now()}-${file.name}`
      );
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
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        neighbourhood: form.neighbourhood.trim(),
        address: form.address.trim(),
        nightlyRate: Number(form.nightlyRate) || "",
        type: form.type,
        bedrooms: Number(form.bedrooms) || "",
        bathrooms: Number(form.bathrooms) || "",
        maxGuests: Number(form.maxGuests) || "",
        amenities: form.amenities,
        photos: [...form.photos, ...photoUrls],
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

  /* ───────────────────────── featured workflow ───────────────────────── */

  const featureStatus = featureReq?.status || null;

  const planLabel = useMemo(() => {
    if (!featureReq) return null;
    if (featureReq.planLabel) return featureReq.planLabel;
    if (featureReq.planKey && FEATURE_PLANS[featureReq.planKey]) {
      return FEATURE_PLANS[featureReq.planKey].label;
    }
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
        requestHelpText:
          "Boost visibility by appearing in the homepage Featured carousel.",
        requestButtonLabel: "Request Featured",
        requestButtonDisabled: false,
        showPayNowAction: false,
      };
    }

    switch (featureStatus) {
      case "pending":
        return {
          requestSummary: `Featured request: Pending — ${planLabel}`,
          requestHelpText:
            "Our team is reviewing your request. Once accepted, we’ll move it to 'Awaiting payment'.",
          requestButtonLabel: "Request pending",
          requestButtonDisabled: true,
          showPayNowAction: false,
        };
      case "awaiting-payment":
        return {
          requestSummary: `Featured request: Awaiting payment — ${planLabel}`,
          requestHelpText:
            "Your request has been accepted. Complete payment to activate your spotlight placement.",
          requestButtonLabel: "Pay now",
          requestButtonDisabled: false,
          showPayNowAction: true,
        };
      case "active":
        return {
          requestSummary: `Featured placement active — ${planLabel}`,
          requestHelpText:
            "Your property is currently rotating in the homepage Featured carousel.",
          requestButtonLabel: "Currently featured",
          requestButtonDisabled: true,
          showPayNowAction: false,
        };
      case "rejected":
        return {
          requestSummary: `Featured request: Rejected — ${planLabel}`,
          requestHelpText:
            featureReq.adminNote ||
            "You can submit a new request if you’d like to try another date or plan.",
          requestButtonLabel: "Request again",
          requestButtonDisabled: false,
          showPayNowAction: false,
        };
      default:
        return {
          requestSummary: "No featured request yet.",
          requestHelpText:
            "Boost visibility by appearing in the homepage Featured carousel.",
          requestButtonLabel: "Request Featured",
          requestButtonDisabled: false,
          showPayNowAction: false,
        };
    }
  }, [featureReq, featureStatus, planLabel]);

  const handleOpenPlanModal = () => {
    if (
      featureReq &&
      ["pending", "awaiting-payment", "active"].includes(featureStatus)
    ) {
      window.alert(
        "You already have a featured request in progress for this listing."
      );
      return;
    }
    setPlanModalOpen(true);
  };

  const confirmPlanAndRequest = async (planKey) => {
    if (!user || !listing) {
      window.alert("Listing not ready yet, please try again.");
      return;
    }

    const plan =
      FEATURE_PLANS[planKey] ||
      FEATURE_PLANS.spotlight || {
        key: "custom",
        label: "Custom plan",
        price: null,
      };

    const primaryImageUrl =
      (Array.isArray(listing.photos) && listing.photos[0]) ||
      (Array.isArray(form.photos) && form.photos[0]) ||
      null;

    setFeatureBusy(true);
    try {
      await addDoc(collection(db, "featureRequests"), {
        listingId: id,
        listingTitle: form.title || listing.title || "",
        hostUid: listing.ownerUid || user.uid,
        hostEmail: user.email || profile?.email || "",
        type: "featured-carousel",
        planKey: plan.key,
        planLabel: plan.label,
        planPrice: plan.price, // store price
        price: plan.price, // fallback field
        primaryImageUrl,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPlanModalOpen(false);
      window.alert("Request sent. An admin will review shortly.");
    } catch (e) {
      console.error(e);
      window.alert("Could not send request. Please try again later.");
    } finally {
      setFeatureBusy(false);
    }
  };

  const handlePayNow = () => {
    try {
      if (!featureReq) {
        window.alert("No featured request found for this listing.");
        return;
      }

      // Derive a safe price
      const fallbackPlan =
        FEATURE_PLANS[featureReq.planKey || ""] || FEATURE_PLANS.spotlight;

      const effectivePrice =
        featureReq.planPrice ??
        featureReq.price ??
        fallbackPlan?.price ??
        null;

      const amountNaira = Number(effectivePrice);

      if (!amountNaira || Number.isNaN(amountNaira) || amountNaira <= 0) {
        window.alert(
          "This plan does not have a valid price configured yet. Please contact Nesta support."
        );
        return;
      }

      if (!PAYSTACK_PUBLIC_KEY) {
        window.alert(
          "Paystack public key is missing. Please set REACT_APP_PAYSTACK_PUBLIC_KEY in your .env file."
        );
        return;
      }

      const amountKobo = amountNaira * 100;

      const launchCheckout = () => {
        if (
          !window.PaystackPop ||
          typeof window.PaystackPop.setup !== "function"
        ) {
          window.alert(
            "Paystack could not be initialised. Please check your connection and try again."
          );
          return;
        }

        const handler = window.PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email:
            (featureReq.hostEmail || user?.email || "").trim() ||
            "guest@nestaapp.ng",
          amount: amountKobo,
          currency: "NGN",
          ref: featureReq.id, // use the featureRequest doc id
          metadata: {
            custom_fields: [
              {
                display_name: "Listing",
                variable_name: "listing_title",
                value: listing?.title || form.title || "",
              },
              {
                display_name: "Listing ID",
                variable_name: "listing_id",
                value: listing?.id || id,
              },
              {
                display_name: "Plan",
                variable_name: "feature_plan",
                value: planLabel || featureReq.planKey || "custom",
              },
            ],
          },
          callback: (response) => {
            // Firestore updates in a safe async block
            (async () => {
              try {
                await updateDoc(doc(db, "featureRequests", featureReq.id), {
                  status: "active",
                  paid: true,
                  paymentRef: response.reference,
                  paidVia: "paystack-inline",
                  paidAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });

                await updateDoc(doc(db, "listings", id), {
                  sponsored: true,
                  featured: true, // used by the homepage carousel
                  updatedAt: serverTimestamp(),
                });

                window.alert(
                  "Payment successful. Your listing will now appear in the Featured carousel."
                );
              } catch (err) {
                console.error(
                  "[Paystack callback] Firestore update failed:",
                  err
                );
                window.alert(
                  "Payment succeeded, but we could not update your listing automatically.\nPlease contact Nesta support with this reference: " +
                    response.reference
                );
              }
            })();
          },
          onClose: () => {
            // optional: notify on close
            // window.alert("Payment window closed.");
          },
        });

        handler.openIframe();
      };

      // Ensure Paystack script is present
      if (!window.PaystackPop) {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        script.onload = launchCheckout;
        script.onerror = () => {
          window.alert(
            "Could not load Paystack at the moment. Please check your connection and try again."
          );
        };
        document.body.appendChild(script);
      } else {
        launchCheckout();
      }
    } catch (err) {
      console.error("[handlePayNow] unexpected error:", err);
      window.alert(
        "Something went wrong while starting the payment. Please refresh the page and try again."
      );
    }
  };

  /* ───────────────────────── render guards ───────────────────────── */

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">
        Loading listing…
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">
        Listing not found.
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white/80">
        <h2 className="text-xl font-semibold mb-2">
          You don't have permission to edit this listing.
        </h2>
        <p className="text-white/60">
          Only the listing owner or a Nesta admin can make changes to this
          property.
        </p>
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
            <h1 className="text-2xl font-semibold">
              {form.title || "Untitled"}
            </h1>
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

        {/* FORM */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* BASICS */}
          <Section title="Basics">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Title
                </label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Designer studio in Lekki"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Type
                </label>
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
              <label className="block text-sm text-white/70 mb-1">
                Description
              </label>
              <textarea
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm min-h-[80px]"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Describe what makes this stay special…"
              />
            </div>
          </Section>

          {/* LOCATION */}
          <Section title="Location">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  City
                </label>
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
                <label className="block text-sm text-white/70 mb-1">
                  Neighbourhood (optional)
                </label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.neighbourhood}
                  onChange={(e) =>
                    updateField("neighbourhood", e.target.value)
                  }
                  placeholder="Close to Landmark, Eko Atlantic…"
                />
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Street address (optional)
                </label>
                <input
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Estate / street name shown only to confirmed guests"
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">
                      Latitude
                    </label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      value={form.lat ?? ""}
                      onChange={(e) =>
                        updateField(
                          "lat",
                          e.target.value === ""
                            ? null
                            : Number(e.target.value)
                        )
                      }
                      placeholder="Click map or paste"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">
                      Longitude
                    </label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      value={form.lng ?? ""}
                      onChange={(e) =>
                        updateField(
                          "lng",
                          e.target.value === ""
                            ? null
                            : Number(e.target.value)
                        )
                      }
                      placeholder="Click map or paste"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-white/50">
                  Guests will only see a nearby area map before booking. Exact
                  details are shared securely after confirmation.
                </p>
              </div>

              <div className="mt-1">
                <ListingMap
                  lat={
                    typeof form.lat === "number"
                      ? form.lat
                      : typeof listing.lat === "number"
                      ? listing.lat
                      : null
                  }
                  lng={
                    typeof form.lng === "number"
                      ? form.lng
                      : typeof listing.lng === "number"
                      ? listing.lng
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

          {/* PRICING & CAPACITY */}
          <Section title="Pricing & capacity">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Nightly rate (₦)
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.nightlyRate}
                  onChange={(e) => updateField("nightlyRate", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Bedrooms
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.bedrooms}
                  onChange={(e) => updateField("bedrooms", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Bathrooms
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.bathrooms}
                  onChange={(e) => updateField("bathrooms", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Max guests
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  value={form.maxGuests}
                  onChange={(e) => updateField("maxGuests", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* AMENITIES */}
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

          {/* PHOTOS */}
          <Section title="Photos">
            <div className="grid md:grid-cols-4 gap-3 mb-4">
              {form.photos.map((url, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video"
                >
                  {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {form.photos.length === 0 && (
                <div className="text-sm text-white/60">
                  No photos yet. Upload at least one high-quality image for best
                  results.
                </div>
              )}
            </div>

            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="text-sm"
            />
            {newPhotos.length > 0 && (
              <div className="text-xs text-white/60 mt-1">
                {newPhotos.length} new photo(s) will be uploaded on save.
              </div>
            )}
          </Section>

          {/* BOOKING OPTIONS */}
          <Section title="Booking options">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.instantBook}
                onChange={(e) => updateField("instantBook", e.target.checked)}
              />
              <span>Enable instant booking (no manual approval required)</span>
            </label>
          </Section>

          {/* META & FEATURED */}
          <Section title="Meta">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
                <div className="text-white/70">Listing ID</div>
                <div className="text-white mt-1 break-all">{listing.id}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
                <div className="text-white/70">Owner UID</div>
                <div className="text-white mt-1">
                  {form.ownerUid || listing.ownerUid || "—"}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
                <div className="text-white/70">Partner UID</div>
                <div className="text-white mt-1">
                  {form.partnerUid || listing.partnerUid || "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 text-sm flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white/70">Featured (carousel)</div>
                  <div className="text-white mt-1">
                    {form.sponsored || listing.sponsored
                      ? "Yes — currently featured"
                      : "No — not currently featured"}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-amber-200">
                {requestSummary}
              </div>
              <div className="text-xs text-white/60">{requestHelpText}</div>
            </div>
          </Section>
        </form>

        {/* FOOTER ACTIONS */}
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
              featureBusy || requestButtonDisabled
                ? "opacity-60 cursor-not-allowed"
                : ""
            }`}
          >
            {featureBusy
              ? "Sending request…"
              : showPayNowAction
              ? "Pay now"
              : requestButtonLabel}
          </button>

          <div className="ml-auto text-sm text-white/60">
            Role: <strong>{profile?.role || "host/partner"}</strong>
            {isAdmin && " · Admin"}
          </div>
        </div>
      </main>

      {/* Plan chooser modal */}
      <FeaturePlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onConfirm={confirmPlanAndRequest}
        initialPlanKey="spotlight"
      />
    </>
  );
}
