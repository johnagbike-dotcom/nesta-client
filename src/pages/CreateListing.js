// src/pages/CreateListing.js
import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import ImageUploader from "../components/ImageUploader";

/**
 * CreateListing
 * - Luxury-styled form with strict validation
 * - Supports Host (ownerId) and Verified Partner (partnerUid + managers[])
 * - Adds SEO slug + searchable keywords
 * - Lets user pre-check “request_featured” (saved as a separate doc that admin can approve)
 */

const TYPES = ["Apartment", "Bungalow", "Studio", "Loft", "Villa", "Penthouse", "Hotel", "Other"];
const STATUS = ["active", "inactive", "review"];
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
];

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <h3 className="text-lg md:text-xl font-bold text-white">{title}</h3>
      {subtitle ? <p className="text-white/60 mt-1">{subtitle}</p> : null}
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-sm text-white/80">{label}</div>
      {hint ? <div className="text-xs text-white/50 mt-0.5">{hint}</div> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl bg-white/5 border border-white/10",
        "px-3 py-2 outline-none focus:border-yellow-400",
      ].join(" ")}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl bg-white/5 border border-white/10",
        "px-3 py-2 outline-none focus:border-yellow-400",
      ].join(" ")}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10",
        "px-3 py-2 outline-none focus:border-yellow-400",
      ].join(" ")}
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1",
        checked
          ? "bg-yellow-400/20 border border-yellow-400/60 text-yellow-300"
          : "bg-white/5 border border-white/10 text-white/70",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3 w-3 rounded-full",
          checked ? "bg-yellow-400" : "bg-white/30",
        ].join(" ")}
      />
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default function CreateListing() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNavigate();

  const [form, setForm] = useState({
    title: "",
    type: "Apartment",
    city: "",
    area: "",
    pricePerNight: "",
    status: "active",
    description: "",
    bedrooms: "",
    bathrooms: "",
    size: "",
  });

  const [amenities, setAmenities] = useState([]);
  const [houseRules, setHouseRules] = useState("");
  const [images, setImages] = useState([]); // array of URLs from ImageUploader
  const [requestFeatured, setRequestFeatured] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isPartner =
    (profile?.role || "").toLowerCase() === "partner" ||
    (profile?.role || "").toLowerCase() === "verified_partner";

  const isHost =
    (profile?.role || "").toLowerCase() === "host" || !isPartner;

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length >= 5 &&
      form.city.trim().length >= 2 &&
      form.area.trim().length >= 2 &&
      Number(form.pricePerNight) > 0 &&
      images.length > 0
    );
  }, [form, images.length]);

  const priceFieldRef = useRef(null);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleAmenity(a) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function slugify(s) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  function keywords() {
    const bag = [
      form.title,
      form.type,
      form.city,
      form.area,
      ...(amenities || []),
    ]
      .join(" ")
      .toLowerCase();
    const k = new Set();
    bag
      .split(/[\s,./-]+/g)
      .filter(Boolean)
      .forEach((w) => k.add(w));
    return Array.from(k);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!user?.uid) {
      alert("Please log in to create a listing.");
      return;
    }
    if (!canSubmit) {
      setErr(
        "Please complete all required fields and add at least one photo."
      );
      priceFieldRef.current?.focus();
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const nowSlug = slugify(`${form.title}-${form.city}-${form.area}`);
      const price = Number(form.pricePerNight || 0);

      const payload = {
        title: form.title.trim(),
        type: form.type,
        city: form.city.trim(),
        area: form.area.trim(),
        pricePerNight: price,
        status: form.status,
        description: form.description.trim(),
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        size: form.size ? String(form.size) : "",
        // 🔐 store photos in *both* fields for compatibility
        images,
        imageUrls: images,
        amenities,
        houseRules: houseRules?.trim() || "",
        slug: nowSlug,
        keywords: keywords(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        ownerId: isHost ? user.uid : null,
        partnerUid: isPartner ? user.uid : null,
        managers: isPartner ? [user.uid] : [],

        sponsored: false, // admin flips to true after approval
        featured: false, // legacy flag; keep false
      };

      const docRef = await addDoc(collection(db, "listings"), payload);

      if (requestFeatured) {
        try {
          await addDoc(collection(db, "featureRequests"), {
            listingId: docRef.id,
            title: payload.title,
            requestedBy: user.uid,
            requesterRole: profile?.role || "",
            status: "pending",
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("feature request failed", e);
        }
      }

      alert("✅ Listing created.");
      nav(`/listing/${docRef.id}`);
    } catch (e) {
      console.error(e);
      setErr(
        e?.message ||
          "We couldn’t create your listing right now. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-6 text-white">
      <button
        className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
        onClick={() => nav(-1)}
      >
        ← Back
      </button>

      <div className="mt-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-yellow-400">
          Post a Listing
        </h1>
        <p className="text-white/70">
          Share a premium stay. Keep details clear and pricing accurate.
        </p>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {err}
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="mt-5 grid gap-4 max-w-5xl">
        {/* Essentials */}
        <Section
          title="Essentials"
          subtitle="Core info guests see first."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title" hint="e.g. Cozy Loft in Ikoyi GRA">
              <TextInput
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="City">
              <TextInput
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="Area / Neighbourhood">
              <TextInput
                value={form.area}
                onChange={(e) => setField("area", e.target.value)}
                maxLength={50}
              />
            </Field>

            <Field label="Price per night (₦)">
              <TextInput
                ref={priceFieldRef}
                inputMode="numeric"
                type="number"
                min={0}
                value={form.pricePerNight}
                onChange={(e) => setField("pricePerNight", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Bedrooms">
              <TextInput
                inputMode="numeric"
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => setField("bedrooms", e.target.value)}
              />
            </Field>
            <Field label="Bathrooms">
              <TextInput
                inputMode="numeric"
                type="number"
                min={0}
                value={form.bathrooms}
                onChange={(e) => setField("bathrooms", e.target.value)}
              />
            </Field>
            <Field label="Size (m²)">
              <TextInput
                placeholder="e.g. 85"
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" hint="Tell guests what makes this place exceptional.">
            <TextArea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              maxLength={1000}
            />
          </Field>
        </Section>

        {/* Amenities */}
        <Section
          title="Amenities"
          subtitle="Quick highlights guests care about."
        >
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <Toggle
                key={a}
                label={a}
                checked={amenities.includes(a)}
                onChange={() => toggleAmenity(a)}
              />
            ))}
          </div>
        </Section>

        {/* Photos */}
        <Section
          title="Photos"
          subtitle="Upload bright images that sell the experience."
        >
          <ImageUploader
            value={images}
            onChange={setImages}
            folder={`listing-images/${user?.uid || "anon"}`}
          />
        </Section>

        {/* Rules + Feature */}
        <Section title="Extras">
          <Field label="House rules (optional)">
            <TextArea
              value={houseRules}
              onChange={(e) => setHouseRules(e.target.value)}
              placeholder="Check-in after 2pm, no smoking indoors, quiet hours 10pm–7am, etc."
            />
          </Field>

          <div className="flex items-center gap-3">
            <input
              id="req-featured"
              type="checkbox"
              className="h-5 w-5 accent-yellow-400"
              checked={requestFeatured}
              onChange={(e) => setRequestFeatured(e.target.checked)}
            />
            <label htmlFor="req-featured" className="text-sm text-white/90">
              Request to be <span className="font-semibold text-yellow-400">Featured</span> in the carousel
            </label>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            disabled={busy || !canSubmit}
            className={[
              "px-5 py-3 rounded-xl font-semibold",
              busy || !canSubmit
                ? "bg-yellow-500/40 text-black/60 cursor-not-allowed"
                : "bg-yellow-400 text-black hover:bg-yellow-500",
            ].join(" ")}
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </button>

          <div className="ml-auto text-sm text-white/60">
            {isPartner ? (
              <span>
                Role: <strong>Verified Partner</strong> • managers set to you
              </span>
            ) : (
              <span>
                Role: <strong>Host</strong> • ownerId will be your UID
              </span>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
