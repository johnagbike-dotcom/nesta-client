import React from "react";
import BackButton from "../components/BackButton";

export default function ProfilePage() {
  return (
    <main className="max-w-2xl mx-auto p-4 text-white">
      <BackButton fallback="/dashboard" />
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <p className="text-white/70">Edit your account details here.</p>
    </main>
  );
} 