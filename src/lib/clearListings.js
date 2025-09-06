import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase"; // adjust if your firebase.js is not directly in src/

export const clearListings = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "listings"));
    const deletions = querySnapshot.docs.map((document) =>
      deleteDoc(doc(db, "listings", document.id))
    );
    await Promise.all(deletions);
    toast.success("Listing created 🎉");
    console.log("✅ All listings cleared.");
  } catch (error) {
    console.error("❌ Error clearing listings:", error);
  }
};