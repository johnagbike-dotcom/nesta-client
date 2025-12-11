// src/pages/ProfilePage.js
import React from "react";
import BackButton from "../components/BackButton";
import Profile from "./Profile";

export default function ProfilePage() {
  return (
    <main className="max-w-3xl mx-auto p-4 text-white">
      <BackButton fallback="/dashboard" />
      <div className="mt-4">
        <h1 className="text-2xl font-bold mb-1">Profile</h1>
        <p className="text-white/70 mb-4">
          Tune your Nesta identity. Contact details are surfaced to guests only
          through our secure booking flow.
        </p>
      </div>
      <Profile />
    </main>
  );
}
