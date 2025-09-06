// src/components/ListingForm.js
import React, { useState, useEffect } from "react";

export default function ListingForm({
  initial = {},
  onSubmit,
  submitting = false,
  submitLabel = "Save",
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState("Flat");
  const [pricePerNight, setPricePerNight] = useState("");
  const [liveInHost, setLiveInHost] = useState(false);
  const [billsIncluded, setBillsIncluded] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false); // partners can leave false

  const [err, setErr] = useState("");

  useEffect(() => {
    setTitle(initial.title || "");
    setDescription(initial.description || "");
    setCity(initial.city || initial.location || "");
    setArea(initial.area || "");
    setType(initial.type || "Flat");
    setPricePerNight(
      initial.pricePerNight != null ? String(initial.pricePerNight) : ""
    );
    setLiveInHost(!!(initial.liveInHost ?? initial.liveIn));
    setBillsIncluded(!!(initial.billsIncluded ?? initial.bills));
    setIsFeatured(!!initial.isFeatured);
  }, [initial]);

  function validate() {
    if (!title.trim()) return "Please add a title.";
    if (!city.trim() && !area.trim())
      return "Add at least a city or area/landmark.";
    const price = Number(pricePerNight);
    if (!price || price < 0) return "Enter a valid price per night.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setErr("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      city: city.trim(),
      area: area.trim(),
      type,
      pricePerNight: Number(pricePerNight),
      liveInHost,
      billsIncluded,
      isFeatured,
    };

    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5">
      {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/80 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            placeholder="Modern Apartment in Lagos"
          />
        </div>

        <div>
          <label className="block text-sm text-white/80 mb-1">Price per night (₦)</label>
          <input
            type="number"
            min="0"
            value={pricePerNight}
            onChange={(e) => setPricePerNight(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            placeholder="35000"
          />
        </div>

        <div>
          <label className="block text-sm text-white/80 mb-1">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            placeholder="Lagos"
          />
        </div>

        <div>
          <label className="block text-sm text-white/80 mb-1">Area / Landmark</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            placeholder="Victoria Island"
          />
        </div>

        <div>
          <label className="block text-sm text-white/80 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          >
            <option>Spare Room</option>
            <option>Flat</option>
            <option>House</option>
          </select>
        </div>

        <div className="sm:pt-6 flex items-center gap-6">
          <label className="flex items-center gap-2 text-white/90">
            <input
              type="checkbox"
              checked={liveInHost}
              onChange={(e) => setLiveInHost(e.target.checked)}
            />
            <span>Live-in host</span>
          </label>
          <label className="flex items-center gap-2 text-white/90">
            <input
              type="checkbox"
              checked={billsIncluded}
              onChange={(e) => setBillsIncluded(e.target.checked)}
            />
            <span>Bills included</span>
          </label>
          <label className="flex items-center gap-2 text-white/90">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            <span>Featured</span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm text-white/80 mb-1">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
            placeholder="Tell guests about the space…"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl px-4 py-2 bg-amber-400 text-black font-semibold shadow hover:brightness-105 disabled:opacity-60"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}