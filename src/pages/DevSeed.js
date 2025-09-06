// src/pages/DevSeed.js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const demo = [
  {
    title: "Modern Apartment in Lagos",
    city: "Lagos",
    area: "Victoria Island",
    type: "Flat",
    pricePerNight: 35000,
    isFeatured: true,
  },
  {
    title: "Cozy Flat in Abuja",
    city: "Abuja",
    area: "Gwarinpa",
    type: "Flat",
    pricePerNight: 25000,
    isFeatured: true,
  },
  {
    title: "Guest House in Port Harcourt",
    city: "Port Harcourt",
    area: "Woji",
    type: "Spare Room",
    pricePerNight: 18000,
    isFeatured: true,
  },
  {
    title: "Luxury Suite in Ibadan",
    city: "Ibadan",
    area: "Bodija",
    type: "House",
    pricePerNight: 40000,
    isFeatured: true,
  },
  // add a few non-featured so the grid looks real
  {
    title: "Studio in Lekki",
    city: "Lagos",
    area: "Lekki",
    type: "Flat",
    pricePerNight: 30000,
    isFeatured: false,
  },
  {
    title: "Room in Ikeja GRA",
    city: "Lagos",
    area: "Ikeja",
    type: "Spare Room",
    pricePerNight: 20000,
    isFeatured: false,
  },
  {
    title: "Mini flat in Wuse",
    city: "Abuja",
    area: "Wuse",
    type: "Flat",
    pricePerNight: 28000,
    isFeatured: false,
  },
  {
    title: "Bungalow in Port Harcourt",
    city: "Port Harcourt",
    area: "Rumuola",
    type: "House",
    pricePerNight: 42000,
    isFeatured: false,
  },
];

export default function DevSeed() {
  const [msg, setMsg] = useState("");

  const seed = async () => {
    setMsg("");
    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) {
      setMsg("You must be signed in before seeding (rules require ownerId == your uid).");
      return;
    }

    try {
      const col = collection(db, "listings");
      await Promise.all(
        demo.map((d) =>
          addDoc(col, {
            ...d,
            ownerId: u.uid,                // 🔑 satisfies your rules
            createdAt: serverTimestamp(),  // used by Home ordering
            updatedAt: serverTimestamp(),
          })
        )
      );
      setMsg("✅ Seeded demo listings successfully.");
    } catch (e) {
      console.error(e);
      setMsg("❌ Failed to seed: " + (e?.message || "Unknown error"));
    }
  };

  const clearAllDemoForMe = async () => {
    setMsg("");
    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) {
      setMsg("Sign in first to clear your seeded docs.");
      return;
    }
    try {
      const q = query(collection(db, "listings"), where("ownerId", "==", u.uid));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "listings", d.id))));
      setMsg("🗑️ Cleared all listings you own.");
    } catch (e) {
      console.error(e);
      setMsg("❌ Failed to clear: " + (e?.message || "Unknown error"));
    }
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <h1>Dev Seeder</h1>
        <p>One-time helper to populate Firestore with demo listings. Remove this page after you’re done.</p>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={seed}>Seed 8 listings</button>
          <button className="btn ghost" onClick={clearAllDemoForMe}>Clear ALL demo listings</button>
        </div>

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

        <p style={{ marginTop: 16 }}>
          Tip: for the best Home page ordering, create a Firestore composite index on
          <code> listings: isFeatured == true</code> (filter) + <code>createdAt desc</code> (order).
        </p>

        <p style={{ marginTop: 16 }}>
          <Link to="/">&larr; Back to Home</Link>
        </p>

        <footer className="footer">
          <nav className="footer-links">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/help">Help</Link>
          </nav>
          <p>© 2025 Nesta. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}