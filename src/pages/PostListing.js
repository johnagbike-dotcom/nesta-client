// src/pages/PostListing.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const TYPES = ["Flat", "House", "Spare Room", "Studio"];

export default function PostListing() {
  const { id } = useParams(); // if present → edit mode
  const isEdit = useMemo(() => Boolean(id), [id]);
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    title: "",
    city: "",
    location: "",
    type: "Flat",
    pricePerNight: "",
    isFeatured: false,
  });

  // Load listing for edit
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
          city: data.city || "",
          location: data.location || "",
          type: data.type || "Flat",
          pricePerNight: data.pricePerNight ?? "",
          isFeatured: !!data.isFeatured,
        });
      } catch (e) {
        console.error(e);
        setErr("Failed to load listing.");
      } finally {
        setBusy(false);
      }
    })();
  }, [isEdit, id]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setErr("");

    // quick validation
    if (!form.title.trim()) return setErr("Please add a title.");
    if (!form.city.trim()) return setErr("Please add a city.");
    if (!form.location.trim()) return setErr("Please add a location.");
    if (!form.pricePerNight || Number(form.pricePerNight) <= 0)
      return setErr("Enter a valid price per night.");

    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        city: form.city.trim(),
        location: form.location.trim(),
        type: form.type,
        pricePerNight: Number(form.pricePerNight),
        isFeatured: !!form.isFeatured,
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        // update existing
        await setDoc(doc(db, "listings", id), payload, { merge: true });
        console.log("Listing updated");
        navigate(`/listing/${id}`);
      } else {
        // create new
        const ref = await addDoc(collection(db, "listings"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        console.log("Listing created", ref.id);
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
        <button className="btn ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <h1 style={{ margin: "16px 0 20px" }}>
          {isEdit ? "Edit listing" : "Post a new listing"}
        </h1>

        <form onSubmit={save} className="form-card" style={{ maxWidth: 720 }}>
          {err && <div className="alert-error" style={{ marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="muted">Title</div>
              <input
                className="input"
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Luxury Apartment Lekki"
              />
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label>
                <div className="muted">City</div>
                <input
                  className="input"
                  name="city"
                  value={form.city}
                  onChange={onChange}
                  placeholder="Lagos"
                />
              </label>

              <label>
                <div className="muted">Location / Area</div>
                <input
                  className="input"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  placeholder="Lekki Phase 1"
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label>
                <div className="muted">Type</div>
                <select
                  className="input"
                  name="type"
                  value={form.type}
                  onChange={onChange}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div className="muted">Price per night (₦)</div>
                <input
                  className="input"
                  name="pricePerNight"
                  type="number"
                  min="0"
                  value={form.pricePerNight}
                  onChange={onChange}
                  placeholder="25000"
                />
              </label>
            </div>

            <label className="checkbox" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                name="isFeatured"
                checked={form.isFeatured}
                onChange={onChange}
              />
              <span>Feature this listing</span>
            </label>

            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Saving…" : isEdit ? "Save changes" : "Create listing"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate(isEdit ? `/listing/${id}` : "/dashboard")}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}