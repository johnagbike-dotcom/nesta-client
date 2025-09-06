// src/lib/listings.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
* Create a listing and stamp ownership + timestamps.
* @param {firebase.User} user - current signed-in user
* @param {object} data - fields from your form
* @returns {Promise<string>} - new document id
*/
export async function createListing(user, data) {
  if (!user) throw new Error("You must be signed in to post.");
  const payload = {
    // Required/primary fields (adjust to your form)
    title: data.title || "",
    description: data.description || "",
    city: data.city || "",
    location: data.location || "",
    type: data.type || "Flat", // Flat | House | Spare Room | Studio
    pricePerNight: data.pricePerNight ? Number(data.pricePerNight) : null,

    // Status/flags
    status: data.status || "active",   // active | paused | archived
    isFeatured: !!data.isFeatured,

    // 🔐 Ownership (CRITICAL for rules)
    ownerId: user.uid,

    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "listings"), payload);
  return ref.id;
}