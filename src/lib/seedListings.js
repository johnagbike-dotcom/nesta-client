// src/lib/seedListings.js
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const sampleListings = [
  {
    title: "Luxury Apartment Lekki",
    city: "Lagos",
    location: "Lekki Phase 1",
    pricePerNight: 25000,
    type: "Flat",
    isFeatured: true,
    createdAt: serverTimestamp(),
  },
  {
    title: "Cozy 2-Bedroom in Abuja",
    city: "Abuja",
    location: "Wuse II",
    pricePerNight: 18000,
    type: "Apartment",
    isFeatured: true,
    createdAt: serverTimestamp(),
  },
  {
    title: "Budget Room in Ibadan",
    city: "Ibadan",
    location: "Bodija",
    pricePerNight: 8000,
    type: "Room",
    isFeatured: false, // won’t show on homepage
    createdAt: serverTimestamp(),
  },
  {
    title: "Short-let Studio in VI",
    city: "Lagos",
    location: "Victoria Island",
    pricePerNight: 20000,
    type: "Studio",
    isFeatured: true,
    createdAt: serverTimestamp(),
  },
];

export async function seedListings() {
  try {
    const listingsRef = collection(db, "listings");
    for (let listing of sampleListings) {
      await addDoc(listingsRef, listing);
    }
    console.log("✅ Sample listings seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding listings:", error);
  }
}