// src/pages/PostAdRouter.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createListing } from "../lib/listings";
import { useAuth } from "../auth/AuthContext";

export default function PostAdRouter() {
  const { user } = useAuth(); // route should be protected, but we keep a guard
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    location: "",
    type: "Flat",          // Flat | House | Spare Room | Studio
    pricePerNight: "",
    status: "active",      // active | paused | archived
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/signup", { replace: true, state: { next: "/post" } });
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const id = await createListing(user, form); // stamps ownerId + timestamps
      navigate(`/listing/${id}`);
    } catch (error) {
      console.error(error);
      setErr(error.message || "Could not create listing.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>
          <h1 style={{ margin: 0 }}>Post a new listing</h1>
        </div>

        {err && (
          <div className="alert-error" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginTop: 16 }}>
          {/* Form Card */}
          <form className="form-card" onSubmit={onSubmit} style={{ alignSelf: "start" }}>
            <label>
              Title
              <input
                className="input"
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Luxury Apartment — Lekki Phase 1"
                required
              />
            </label>

            <label style={{ marginTop: 12 }}>
              Description
              <textarea
                className="input"
                name="description"
                rows={5}
                value={form.description}
                onChange={onChange}
                placeholder="Stylish 2-bed apartment, 24/7 power, parking, concierge…"
                style={{ resize: "vertical", paddingTop: 10 }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <label>
                City
                <input
                  className="input"
                  name="city"
                  value={form.city}
                  onChange={onChange}
                  placeholder="Lagos"
                />
              </label>
              <label>
                Area / Location
                <input
                  className="input"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  placeholder="Lekki Phase 1"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <label>
                Type
                <select className="input" name="type" value={form.type} onChange={onChange}>
                  <option>Flat</option>
                  <option>House</option>
                  <option>Spare Room</option>
                  <option>Studio</option>
                </select>
              </label>

              <label>
                Price per night (₦)
                <input
                  className="input"
                  type="number"
                  name="pricePerNight"
                  min="0"
                  step="100"
                  value={form.pricePerNight}
                  onChange={onChange}
                  placeholder="25000"
                />
              </label>

              <label>
                Status
                <select className="input" name="status" value={form.status} onChange={onChange}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            <label className="checkbox" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                name="isFeatured"
                checked={form.isFeatured}
                onChange={onChange}
              />
              <span>Feature this listing (appears on the home page)</span>
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Publishing…" : "Publish"}
              </button>
              <button className="btn ghost" type="button" onClick={() => navigate("/browse")}>
                Cancel
              </button>
            </div>
          </form>

          {/* Tips / Policy Card */}
          <aside className="card" style={{ alignSelf: "start" }}>
            <h3 style={{ marginTop: 0 }}>Quality & policy tips</h3>
            <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Use clear, premium photos (well-lit, landscape).</li>
              <li>Describe amenities: Wi-Fi, power, parking, security, etc.</li>
              <li>Be honest about live-in vs live-out host expectations.</li>
              <li>Short-lets allowed; nightly/weekly/monthly pricing welcome.</li>
              <li>Contact details are released only per your subscription rules.</li>
            </ul>
            <p className="muted" style={{ marginTop: 8 }}>
              Featured listings gain priority exposure on the home page.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}