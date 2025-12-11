// src/components/SubscriptionBanner.js
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;

  let date = expiresAt;
  if (expiresAt?.toDate) date = expiresAt.toDate();
  else if (expiresAt?.seconds) date = new Date(expiresAt.seconds * 1000);
  else if (typeof expiresAt === "string" || typeof expiresAt === "number") {
    date = new Date(expiresAt);
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function SubscriptionBanner({ inline = false }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.uid) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (!active) return;
        setProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("[SubscriptionBanner] load user failed:", e);
        if (active) setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  if (loading) return null;
  if (!profile) return null;

  const plan = profile.subscriptionPlan || null;
  const expiresAt = profile.subscriptionExpiresAt || null;
  const isActive = !!profile.activeSubscription && (!!expiresAt || !!plan);
  const dLeft = daysLeft(expiresAt);

  // KYC + verification can be checked here if you want:
  const kycStatus = (profile.kycStatus || "").toLowerCase();
  const kycOk = !kycStatus || kycStatus === "approved";

  // Styling presets
  const base =
    "w-full rounded-2xl border px-4 py-3 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-sm";
  const activeClasses =
    "bg-emerald-900/40 border-emerald-500/40 text-emerald-100";
  const inactiveClasses = "bg-amber-900/40 border-amber-500/40 text-amber-50";

  if (isActive) {
    return (
      <div className={`${base} ${activeClasses} ${inline ? "mt-3" : ""}`}>
        <div className="font-semibold">
          Subscription active
          {plan ? ` · ${plan[0].toUpperCase() + plan.slice(1)} plan` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-emerald-100/90">
          {typeof dLeft === "number" && dLeft >= 0 && (
            <span>
              Your subscription is active{" "}
              <span className="font-semibold">{dLeft}</span> day
              {dLeft === 1 ? "" : "s"} left.
            </span>
          )}
          {expiresAt && (
            <span className="text-emerald-200/90">
              Expires:{" "}
              <span className="font-semibold">
                {new Date(expiresAt?.toDate?.() || expiresAt).toLocaleDateString()}
              </span>
            </span>
          )}
          {!kycOk && (
            <span className="text-amber-200/90">
              KYC under review – some features may be limited.
            </span>
          )}
        </div>
      </div>
    );
  }

  // Inactive / not subscribed
  return (
    <div className={`${base} ${inactiveClasses} ${inline ? "mt-3" : ""}`}>
      <div className="font-semibold">Unlock full Nesta host benefits</div>
      <div className="flex flex-wrap items-center gap-2 text-amber-100/90">
        <span>
          Subscribe to enable guest contact details, higher search visibility &
          priority support.
        </span>
        <a
          href="/subscribe"
          className="ml-0 md:ml-auto inline-flex items-center justify-center rounded-full bg-amber-400 text-black px-4 py-1.5 text-sm font-semibold hover:bg-amber-300"
        >
          View plans
        </a>
      </div>
    </div>
  );
}
