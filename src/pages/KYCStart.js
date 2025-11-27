// src/pages/KYCStart.js
import React, { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function KYCStart() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please choose a file");
    setLoading(true);

    const fileRef = ref(storage, `kyc/${user.uid}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await updateDoc(doc(db, "users", user.uid), {
      "kyc.fileUrl": url,
      "kyc.status": "pending",
      "kyc.updatedAt": serverTimestamp(),
    });

    setLoading(false);
    alert("KYC submitted for review.");
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Start KYC Verification</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="px-4 py-2 bg-black text-white rounded mt-2"
      >
        {loading ? "Uploading..." : "Submit KYC"}
      </button>
    </div>
  );
} 
