// src/pages/PostListing.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Navigate, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const TYPES = ["Flat", "House", "Spare Room", "Studio"];

function roleOk(raw) {
  const r = String(raw || "").toLowerCase();
  return ["host", "verified_host", "partner", "verified_partner", "admin"].includes(r);
}
function kycOk(raw) {
  const s = String(raw || "").toLowerCase();
  return s === "approved" || s === "verified" || s === "complete";
}

export default function PostListing() {
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const navigate = useNavigate();
  const location = useLocation();

  // ---- hooks FIRST (no early returns before these) ----
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.uid);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    location: "",
    type: "Flat",
    pricePerNight: "",
    isFeatured: false,
    status: "active",
  });

  // Load listing (edit mode)
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setBusy(true);
        const ref = doc(db, "listings", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setErr("Listing not found.");
          return;
        }
        const data = snap.data();
        setForm({
          title: data.title || "",
          description: data.description || "",
          city: data.city || "",
          location: data.location || "",
          type: data.type || "Flat",
          pricePerNight: data.pricePerNight ?? "",
          isFeatured: !!data.isFeatured,
          status: data.status || "active",
        });
      } catch (e) {
        console.error(e);
        setErr("Failed to load listing.");
      } finally {
        setBusy(false);
      }
    })();
  }, [isEdit, id]);

  // ---- guards AFTER hooks are declared ----
  if (profileLoading) return null;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!kycOk(profile?.kycStatus)) {
    return <Navigate to={`/onboarding/kyc?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!roleOk(profile?.role)) {
    return <Navigate to="/post" replace />;
  }

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.title.trim()) return setErr("Please add a title.");
    if (!form.city.trim()) return setErr("Please add a city.");
    if (!form.location.trim()) return setErr("Please add a location.");
    if (!form.pricePerNight || Number(form.pricePerNight) <= 0)
      return setErr("Enter a valid price per night.");

    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: (form.description || "").trim(),
        city: form.city.trim(),
        location: form.location.trim(),
        type: form.type,
        pricePerNight: Number(form.pricePerNight),
        isFeatured: !!form.isFeatured,
        status: form.status || "active",
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        await setDoc(doc(db, "listings", id), payload, { merge: true });
        navigate(`/listing/${id}`);
      } else {
        const ref = await addDoc(collection(db, "listings"), {
          ...payload,
          ownerId: user.uid, // stamp owner
          createdAt: serverTimestamp(),
        });
        navigate(`/listing/${ref.id}`);
      }
    } catch (e) {
      console.error(e);
      setErr("Failed to save listing. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>
          <h1 style={{ margin: 0 }}>{isEdit ? "Edit listing" : "Post a new listing"}</h1>
        </div>

        {err && <div className="alert-error" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginTop: 16 }}>
          {/* Form Card */}
          <form className="form-card" onSubmit={save} style={{ alignSelf: "start" }}>
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
                  required
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
                  required
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <label>
                Type
                <select className="input" name="type" value={form.type} onChange={onChange}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
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
                  required
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
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Publishing…" : isEdit ? "Save changes" : "Publish"}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => navigate(isEdit ? `/listing/${id}` : "/explore")}
                disabled={busy}
              >
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
              <li>Featured listings gain priority exposure on the home page.</li>
            </ul>
            <p className="muted" style={{ marginTop: 8 }}>
              Listings may be reviewed for quality standards before promotion.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
