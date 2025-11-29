// src/pages/EditListing.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import ImageUploader from "../components/ImageUploader";

/**
 * EditListing
 * - Loads listing
 * - Allows editing all fields + photos
 * - “Request Featured” button posts into featureRequests
 */

const TYPES = ["Apartment", "Bungalow", "Studio", "Loft", "Villa", "Penthouse", "Hotel", "Other"];
const STATUS = ["active", "inactive", "review"];

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
const TextInput = (p) => (
  <input
    {...p}
    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
  />
);
const Select = (p) => (
  <select
    {...p}
    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
  />
);
const TextArea = (p) => (
  <textarea
    {...p}
    className="w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
  />
);

export default function EditListing() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
    amenities: [],
    houseRules: "",
    images: [],
    sponsored: false,
    featured: false, // legacy
    partnerUid: null,
    ownerId: null,
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const canSave = useMemo(() => {
    return (
      form.title.trim().length >= 5 &&
      form.city.trim().length >= 2 &&
      form.area.trim().length >= 2 &&
      Number(form.pricePerNight) > 0 &&
      (form.images?.length || 0) > 0
    );
  }, [form]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const snap = await getDoc(doc(db, "listings", id));
        if (!snap.exists()) {
          if (alive) setErr("Listing not found.");
          return;
        }
        const d = snap.data();
        if (!alive) return;

        // Prefer `images`, fallback to `imageUrls` if needed
        const imgs =
          Array.isArray(d.images) && d.images.length
            ? d.images
            : Array.isArray(d.imageUrls)
            ? d.imageUrls
            : [];

        setForm({
          title: d.title || "",
          type: d.type || "Apartment",
          city: d.city || "",
          area: d.area || "",
          pricePerNight: d.pricePerNight || "",
          status: d.status || "active",
          description: d.description || "",
          bedrooms: d.bedrooms ?? "",
          bathrooms: d.bathrooms ?? "",
          size: d.size ?? "",
          amenities: Array.isArray(d.amenities) ? d.amenities : [],
          houseRules: d.houseRules || "",
          images: imgs,
          sponsored: !!d.sponsored,
          featured: !!d.featured,
          partnerUid: d.partnerUid || null,
          ownerId: d.ownerId || null,
        });
      } catch (e) {
        console.error(e);
        if (alive) setErr("Could not load listing.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    if (!canSave) {
      setErr("Please complete all required fields before saving.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload = {
        ...form,
        pricePerNight: Number(form.pricePerNight || 0),
        // keep Firestore in sync: both `images` and `imageUrls`
        images: form.images || [],
        imageUrls: form.images || [],
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "listings", id), payload);
      alert("✅ Changes saved.");
      nav(`/listing/${id}`);
    } catch (e) {
      console.error(e);
      setErr("Could not save changes. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestFeatured() {
    try {
      await addDoc(collection(db, "featureRequests"), {
        listingId: id,
        title: form.title || "Untitled",
        requestedBy: user?.uid || null,
        requesterRole: profile?.role || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert("📣 Request sent. An admin will review shortly.");
    } catch (e) {
      console.error(e);
      alert("Could not send request. Please try again later.");
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6 text-white">Loading…</main>
    );
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
          Edit Listing
        </h1>
        <p className="text-white/70">
          Keep your details fresh. Great photos and accurate pricing boost
          conversions.
        </p>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 max-w-5xl">
        <Section title="Essentials">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title">
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
              />
            </Field>
            <Field label="Area">
              <TextInput
                value={form.area}
                onChange={(e) => setField("area", e.target.value)}
              />
            </Field>

            <Field label="Price per night (₦)">
              <TextInput
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
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => setField("bedrooms", e.target.value)}
              />
            </Field>
            <Field label="Bathrooms">
              <TextInput
                type="number"
                min={0}
                value={form.bathrooms}
                onChange={(e) => setField("bathrooms", e.target.value)}
              />
            </Field>
            <Field label="Size (m²)">
              <TextInput
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description">
            <TextArea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              maxLength={1000}
            />
          </Field>
        </Section>

        <Section title="Photos" subtitle="Drag to reorder.">
          <ImageUploader
            value={form.images}
            onChange={(urls) => setField("images", urls)}
            folder={`listing-images/${form.ownerId || form.partnerUid || "anon"}`}
          />
        </Section>

        <Section title="House rules">
          <TextArea
            value={form.houseRules}
            onChange={(e) => setField("houseRules", e.target.value)}
            placeholder="Check-in after 2pm, ID required at check-in, no parties, etc."
          />
        </Section>

        <Section title="Meta">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
              <div className="text-white/70">Owner UID</div>
              <div className="text-white mt-1">{form.ownerId || "—"}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
              <div className="text-white/70">Partner UID</div>
              <div className="text-white mt-1">{form.partnerUid || "—"}</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
            <div className="text-white/70">Featured (carousel)</div>
            <div className="text-white mt-1">{form.sponsored ? "Yes" : "No"}</div>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={busy || !canSave}
            onClick={save}
            className={[
              "px-5 py-3 rounded-xl font-semibold",
              busy || !canSave
                ? "bg-yellow-500/40 text-black/60 cursor-not-allowed"
                : "bg-yellow-400 text-black hover:bg-yellow-500",
            ].join(" ")}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={requestFeatured}
            className="px-5 py-3 rounded-xl border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20"
          >
            Request Featured
          </button>

          <div className="ml-auto text-sm text-white/60">
            Role: <strong>{profile?.role || "host/partner"}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}
