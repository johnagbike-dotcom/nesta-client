// src/pages/CreateListing.js
import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import ImageUploader from "../components/ImageUploader";
import ListingMap from "../components/ListingMap";

/**
 * CreateListing (Luxury Standard)
 * - Writes listing fields in a compatible shape for all pages:
 *   images[] + imageUrls[] + photos[] + primaryImageUrl
 *   pricePerNight + nightlyRate
 * - Featured request creates a Firestore featureRequests doc with:
 *   status=pending, planId, planLabel, price, durationDays
 * - Admin later approves -> awaiting-payment and locks terms.
 *
 * Fixes:
 * - Back button no longer hidden under fixed header (pt-20 on main)
 * - alert() replaced with inline success/error state
 * - address field added to payload
 * - neighbourhood field wired to form input
 * - canSubmit gate applied to type="submit" button (was type-less)
 * - busy spinner improved
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
  "Generator",
  "Elevator",
  "Balcony",
  "Garden",
];

const DEFAULT_SPOTLIGHT_PLAN = {
  planId: "spotlight",
  planLabel: "Spotlight · 24 hours",
  price: 20000,
  durationDays: 1,
};

function redactContactText(raw) {
  if (!raw) return "";
  let s = String(raw);
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]");
  s = s.replace(/\+?\d[\d\s\-().]{6,}\d/g, "[number removed]");
  return s.trim();
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parseNaira(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-white/8 bg-[#0c0f16] p-5 md:p-6 space-y-4">
      <div>
        <h3 className="text-base md:text-lg font-bold text-white tracking-tight">{title}</h3>
        {subtitle ? (
          <p className="text-[13px] text-white/50 mt-0.5 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, required }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-white/55">
          {label}
        </span>
        {required && <span className="text-amber-400 text-[10px]">required</span>}
      </div>
      {hint ? <div className="text-[11px] text-white/40 -mt-1">{hint}</div> : null}
      <div>{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2.5 text-white/90 text-sm outline-none focus:border-amber-400/70 transition-colors placeholder-white/25";

function TextInput(props) {
  return <input {...props} className={[inputCls, props.className || ""].join(" ")} />;
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={[
        inputCls,
        "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff60' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_12px_center]",
        props.className || "",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full min-h-[120px] rounded-2xl bg-black/30 border border-white/10",
        "px-3 py-2.5 text-white/90 text-sm outline-none focus:border-amber-400/70 transition-colors resize-y placeholder-white/25",
        props.className || "",
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

function CheckRow({ ok, label }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className={ok ? "text-white/70" : "text-white/50"}>{label}</span>
      <span className={ok ? "text-emerald-400 font-bold" : "text-white/25"}>
        {ok ? "✓" : "○"}
      </span>
    </div>
  );
}

/* ─────────────────────────── Main component ─────────────────────────── */

export default function CreateListing() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNavigate();

  const [form, setForm] = useState({
    title: "",
    type: "Apartment",
    city: "",
    area: "",
    neighbourhood: "",
    address: "",
    pricePerNight: "",
    status: "active",
    description: "",
    bedrooms: "",
    bathrooms: "",
    beds: "",
    maxGuests: "",
    size: "",
    lat: null,
    lng: null,
  });

  const [amenities, setAmenities] = useState([]);
  const [houseRules, setHouseRules] = useState("");
  const [images, setImages] = useState([]);
  const [requestFeatured, setRequestFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const roleRaw = String(profile?.role || "").toLowerCase();
  const isPartner = ["partner", "verified_partner", "partner_verified"].includes(roleRaw);
  const priceFieldRef = useRef(null);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleAmenity(a) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  const parsedPrice = useMemo(() => parseNaira(form.pricePerNight), [form.pricePerNight]);

  const checks = useMemo(() => {
    const titleOk = form.title.trim().length >= 5;
    const cityOk = form.city.trim().length >= 2;
    const areaOk = form.area.trim().length >= 2;
    const priceOk = parsedPrice > 0;
    const photosOk =
      Array.isArray(images) &&
      images.filter((u) => typeof u === "string" && u.trim().length > 10).length > 0;

    return { titleOk, cityOk, areaOk, priceOk, photosOk };
  }, [form, images, parsedPrice]);

  const canSubmit = useMemo(
    () => checks.titleOk && checks.cityOk && checks.areaOk && checks.priceOk && checks.photosOk,
    [checks]
  );

  function keywords(cleanTitle) {
    const bag = [cleanTitle, form.type, form.city, form.area, ...(amenities || [])]
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
      setErr("Please log in to create a listing.");
      return;
    }

    if (!canSubmit) {
      setErr("Please complete all required fields and add at least one photo.");
      priceFieldRef.current?.focus();
      return;
    }

    setBusy(true);
    setErr("");
    setSuccess("");

    try {
      const uid = user.uid;
      const cleanTitle = redactContactText(form.title.trim());
      const cleanDesc = redactContactText(form.description);
      const cleanRules = redactContactText(houseRules);
      const price = parsedPrice;
      const nowSlug = slugify(`${cleanTitle}-${form.city}-${form.area}`);
      const primaryImageUrl = images?.[0] || null;

      const baseOwner = {
        ownerUid: uid,
        ownerId: uid,
        hostUid: uid,
        hostId: uid,
        userUid: uid,
        userId: uid,
        createdBy: uid,
        createdByUid: uid,
      };

      const partnerBits = isPartner
        ? { partnerUid: uid, partnerId: uid, managers: [uid] }
        : { partnerUid: null, partnerId: null, managers: [] };

      const payload = {
        // Core display fields
        title: cleanTitle,
        description: cleanDesc,
        type: form.type,
        city: form.city.trim(),
        area: form.area.trim(),
        neighbourhood: form.neighbourhood.trim(),
        address: form.address.trim(),

        // Pricing consistency
        pricePerNight: price,
        nightlyRate: price,

        // Capacity / details
        bedrooms: toNullableNumber(form.bedrooms),
        bathrooms: toNullableNumber(form.bathrooms),
        beds: toNullableNumber(form.beds),
        maxGuests: toNullableNumber(form.maxGuests),
        size: form.size ? String(form.size) : "",

        status: form.status,

        // Location
        lat: typeof form.lat === "number" && !Number.isNaN(form.lat) ? form.lat : null,
        lng: typeof form.lng === "number" && !Number.isNaN(form.lng) ? form.lng : null,

        // Images (compat everywhere)
        images,
        imageUrls: images,
        photos: images,
        primaryImageUrl,

        // Extras
        amenities,
        houseRules: cleanRules,

        // Search / SEO
        slug: nowSlug,
        keywords: keywords(cleanTitle),

        // Featured flags (admin-controlled)
        sponsored: false,
        featured: false,
        sponsoredUntil: null,

        // Meta
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // Ownership
        ...baseOwner,
        ...partnerBits,
      };

      const docRef = await addDoc(collection(db, "listings"), payload);

      if (requestFeatured) {
        try {
          await addDoc(collection(db, "featureRequests"), {
            kind: "listing-feature",
            type: "featured-carousel",
            listingId: docRef.id,
            listingTitle: payload.title,
            hostUid: uid,
            hostEmail: user.email || profile?.email || "",
            requesterRole: profile?.role || "",
            status: "pending",
            archived: false,
            planId: DEFAULT_SPOTLIGHT_PLAN.planId,
            planLabel: DEFAULT_SPOTLIGHT_PLAN.planLabel,
            price: DEFAULT_SPOTLIGHT_PLAN.price,
            durationDays: DEFAULT_SPOTLIGHT_PLAN.durationDays,
            primaryImageUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("[CreateListing] feature request failed:", e);
        }
      }

      // ✅ No alert() — inline success state, then navigate
      setSuccess("Listing published successfully!");
      setTimeout(() => nav(`/listing/${docRef.id}`), 1200);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "We couldn't create your listing right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const photoCount = Array.isArray(images)
    ? images.filter((u) => typeof u === "string" && u.trim().length > 10).length
    : 0;

  return (
    // ✅ pt-20 ensures the back button clears the fixed header
    <main className="min-h-screen bg-[#05070a] pt-20 pb-16 px-4 text-white">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back button — now safely below fixed header */}
        <button
          type="button"
          onClick={() => nav(-1)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/12 text-sm text-white/70 hover:text-white transition-all"
        >
          ← Back
        </button>

        {/* Page header */}
        <header className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300">
              Post a Listing
            </h1>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/50 font-semibold uppercase tracking-widest">
              {isPartner ? "Partner" : "Host"}
            </span>
          </div>
          <p className="text-white/55 text-sm max-w-xl">
            Share a premium stay. Nesta automatically removes contact details from descriptions
            and reveals them securely to confirmed guests.
          </p>
        </header>

        {/* Alerts */}
        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-center gap-2">
            <span className="text-emerald-400 text-base">✓</span> {success}
          </div>
        )}

        {/* Publish checklist */}
        <div className="rounded-3xl border border-white/8 bg-[#0c0f16] p-4 md:p-5 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/40">
            Publish checklist
          </div>
          <div className="grid gap-2">
            <CheckRow ok={checks.titleOk} label="Title — at least 5 characters" />
            <CheckRow ok={checks.cityOk} label="City entered" />
            <CheckRow ok={checks.areaOk} label="Area / neighbourhood entered" />
            <CheckRow ok={checks.priceOk} label="Price per night is greater than ₦0" />
            <CheckRow
              ok={checks.photosOk}
              label={`At least 1 photo uploaded${photoCount > 0 ? ` (${photoCount} added)` : ""}`}
            />
          </div>

          {!checks.priceOk && (
            <p className="text-[11px] text-white/40 border-t border-white/5 pt-3">
              Enter price as digits only, e.g.{" "}
              <span className="text-white/70 font-semibold">20000</span> — commas like{" "}
              <span className="text-white/70 font-semibold">20,000</span> are also accepted.
            </p>
          )}
          {!checks.photosOk && (
            <p className="text-[11px] text-white/40 border-t border-white/5 pt-3">
              If photos show 0 after uploading, check Firebase Storage rules or that the uploader
              is returning URL strings.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4">

          {/* Essentials */}
          <Section title="Essentials" subtitle="Core info guests see first.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Title" hint="No phone numbers or emails" required>
                <TextInput
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. Designer Loft in Ikoyi"
                  maxLength={80}
                />
              </Field>

              <Field label="Property type">
                <Select value={form.type} onChange={(e) => setField("type", e.target.value)}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="City" required>
                <TextInput
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="e.g. Lagos"
                  maxLength={40}
                />
              </Field>

              <Field label="Area / Neighbourhood" required>
                <TextInput
                  value={form.area}
                  onChange={(e) => setField("area", e.target.value)}
                  placeholder="e.g. Ikoyi, Lekki Phase 1"
                  maxLength={50}
                />
              </Field>

              <Field label="Price per night (₦)" hint="Numbers only — commas accepted" required>
                <TextInput
                  ref={priceFieldRef}
                  inputMode="numeric"
                  type="text"
                  value={form.pricePerNight}
                  onChange={(e) => setField("pricePerNight", e.target.value)}
                  placeholder="e.g. 45000"
                />
              </Field>

              <Field label="Listing status">
                <Select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Capacity row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Bedrooms">
                <TextInput
                  inputMode="numeric"
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => setField("bedrooms", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Bathrooms">
                <TextInput
                  inputMode="numeric"
                  type="number"
                  min={0}
                  value={form.bathrooms}
                  onChange={(e) => setField("bathrooms", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Beds">
                <TextInput
                  inputMode="numeric"
                  type="number"
                  min={0}
                  value={form.beds}
                  onChange={(e) => setField("beds", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Max guests">
                <TextInput
                  inputMode="numeric"
                  type="number"
                  min={1}
                  value={form.maxGuests}
                  onChange={(e) => setField("maxGuests", e.target.value)}
                  placeholder="2"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Size (m²)" hint="Optional">
                <TextInput
                  placeholder="e.g. 85"
                  value={form.size}
                  onChange={(e) => setField("size", e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Description"
              hint="Focus on the experience and quality. Contact details are auto-removed."
            >
              <TextArea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Describe the space, vibe, and what makes it special…"
                maxLength={1000}
              />
              <div className="mt-1 text-right text-[11px] text-white/30">
                {form.description.length}/1000
              </div>
            </Field>
          </Section>

          {/* Location */}
          <Section
            title="Location & map"
            subtitle="Drop a pin close to the property. Guests see only an approximate area before booking."
          >
            <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="space-y-3">
                <Field label="Street address" hint="Shown only to confirmed guests">
                  <TextInput
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="e.g. 12 Bourdillon Road"
                    maxLength={120}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitude" hint="Click map or paste">
                    <TextInput
                      className="text-xs"
                      value={form.lat ?? ""}
                      onChange={(e) =>
                        setField("lat", e.target.value === "" ? null : Number(e.target.value))
                      }
                      placeholder="e.g. 6.435"
                    />
                  </Field>
                  <Field label="Longitude" hint="Click map or paste">
                    <TextInput
                      className="text-xs"
                      value={form.lng ?? ""}
                      onChange={(e) =>
                        setField("lng", e.target.value === "" ? null : Number(e.target.value))
                      }
                      placeholder="e.g. 3.421"
                    />
                  </Field>
                </div>

                <p className="text-[11px] text-white/40 leading-relaxed">
                  Exact street details are only shown to confirmed guests. Use the pin to mark a
                  nearby safe point.
                </p>
              </div>

              <div className="mt-1">
                <ListingMap
                  lat={
                    typeof form.lat === "number" && !Number.isNaN(form.lat) ? form.lat : null
                  }
                  lng={
                    typeof form.lng === "number" && !Number.isNaN(form.lng) ? form.lng : null
                  }
                  editable
                  onChange={(pos) => {
                    setField("lat", pos.lat);
                    setField("lng", pos.lng);
                  }}
                />
              </div>
            </div>
          </Section>

          {/* Amenities */}
          <Section title="Amenities" subtitle="Quick highlights guests care about.">
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
            {amenities.length > 0 && (
              <p className="text-[11px] text-white/40">
                {amenities.length} selected: {amenities.join(", ")}
              </p>
            )}
          </Section>

          {/* Photos */}
          <Section
            title="Photos"
            subtitle="Upload bright, high-quality images that sell the experience. First image becomes the cover."
          >
            <ImageUploader value={images} onChange={setImages} userId={user?.uid} disabled={!user?.uid} />
          </Section>

          {/* Extras */}
          <Section title="Extras">
            <Field label="House rules" hint="Optional — no phone numbers or emails">
              <TextArea
                value={houseRules}
                onChange={(e) => setHouseRules(e.target.value)}
                placeholder="Check-in after 2pm, no smoking indoors, quiet hours 10pm–7am…"
              />
            </Field>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <input
                id="req-featured"
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-400 flex-shrink-0"
                checked={requestFeatured}
                onChange={(e) => setRequestFeatured(e.target.checked)}
              />
              <label htmlFor="req-featured" className="text-[13px] text-white/80 leading-relaxed cursor-pointer">
                Request{" "}
                <span className="font-semibold text-amber-300">Featured placement</span> in the
                homepage carousel — admin will review and approve. A Spotlight fee of ₦20,000 for
                24 hours applies.
              </label>
            </div>
          </Section>

          {/* Submit row */}
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className={[
                "px-6 py-3 rounded-2xl font-semibold text-sm transition-all",
                busy || !canSubmit
                  ? "bg-amber-500/30 text-black/50 cursor-not-allowed"
                  : "bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20",
              ].join(" ")}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Publishing…
                </span>
              ) : (
                "Publish listing"
              )}
            </button>

            <button
              type="button"
              onClick={() => nav(-1)}
              className="px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-all"
            >
              Cancel
            </button>

            {!canSubmit && (
              <span className="text-[12px] text-amber-400/70 ml-1">
                Complete the checklist above to publish
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}