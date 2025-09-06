// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        return;
      }
      setUser(u);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setRole(snap.data().role || null);
      } catch (e) {
        console.warn("Failed to fetch role:", e);
      }
    });
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0b0f14] text-white flex items-center justify-center">
        <p className="text-white/70">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-extrabold text-amber-400">
            Welcome back, {user.displayName || "Guest"}!
          </h1>
          <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-white/15 bg-white/5">
            Role: {role || "not set"}
          </span>
        </div>
        <p className="mt-2 text-white/70">
          Your Nesta dashboard — manage your listings, subscriptions, and chats all in one place.
        </p>

        {/* Role section */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard
            title="I’m a Guest"
            desc="Browse listings, chat with hosts and agents, and make bookings."
            link="/browse"
            action="Start exploring"
          />
          <DashboardCard
            title="I’m a Host"
            desc="Post listings, manage bookings, and upgrade to feature your property."
            link="/post"
            action="Post a listing"
          />
          <DashboardCard
            title="I’m an Agent"
            desc="Bulk upload listings, track commissions, and manage your clients."
            link="/agent"
            action="Go to Agent Tools"
          />
        </section>

        {/* Extra quick links */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DashboardCard
            title="My Chats"
            desc="Conversations with hosts, agents, and guests — all in one place."
            link="/chat"
            action="Open Chat"
          />
          <DashboardCard
            title="My Profile"
            desc="View and update your account details, role, and settings."
            link="/profile"
            action="Edit Profile"
          />
        </section>
      </div>
    </main>
  );
}

function DashboardCard({ title, desc, link, action }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col">
      <h3 className="font-bold text-lg text-amber-300">{title}</h3>
      <p className="mt-2 text-sm text-white/80 flex-1">{desc}</p>
      <Link
        to={link}
        className="mt-4 inline-block rounded-lg bg-amber-400 text-black font-semibold px-4 py-2 hover:bg-amber-300 transition"
      >
        {action}
      </Link>
    </div>
  );
}