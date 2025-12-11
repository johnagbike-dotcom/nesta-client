// src/pages/SubscribePage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import FeaturedCarousel from "../components/FeaturedCarousel";
import SubscriptionBanner from "../components/SubscriptionBanner";
// Payments
import PaystackPop from "@paystack/inline-js";

/* ---------------- Pricing (edit as you like) ---------------- */
const PLAN_PRICES_NGN = {
  weekly: 2000,
  monthly: 5000,
  annual: 50000,
};
const PLAN_MS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  annual: 365 * 24 * 60 * 60 * 1000,
};
const VALID_PLANS = Object.keys(PLAN_PRICES_NGN);

/* --------------- Firestore helper: activate sub --------------- */
async function activateSubscription(uid, plan = "monthly") {
  const now = Date.now();
  const expiresAtISO = new Date(
    now + (PLAN_MS[plan] || PLAN_MS.monthly)
  ).toISOString();

  await setDoc(
    doc(db, "users", uid),
    {
      activeSubscription: true,
      subscriptionPlan: plan, // weekly | monthly | annual
      subscriptionStartedAt: serverTimestamp(),
      subscriptionExpiresAt: expiresAtISO,
      lastSubscriptionUpdateAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* -------------------------- UI -------------------------- */
function PlanCard({ title, price, note, active, onSelect, featured = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: "left",
        borderRadius: 16,
        padding: 16,
        background: featured
          ? "linear-gradient(135deg, rgba(240,180,41,0.25), rgba(217,154,11,0.1))"
          : "linear-gradient(135deg, rgba(240,180,41,0.15), rgba(217,154,11,0.05))",
        border: featured
          ? "2px solid #f0b429"
          : "1px solid rgba(240,180,41,0.35)",
        boxShadow: featured
          ? "0 14px 28px rgba(0,0,0,0.35)"
          : "0 10px 24px rgba(0,0,0,0.25)",
        transform: featured ? "scale(1.02)" : "none",
        color: "#f3f4f6",
        outline: active ? "2px solid rgba(240,180,41,0.75)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0, color: "#f0b429" }}>{title}</h3>
        {active && (
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid rgba(240,180,41,0.55)",
              color: "#f0b429",
              background: "rgba(240,180,41,0.12)",
            }}
          >
            Selected
          </span>
        )}
      </div>
      <p
        className="muted"
        style={{ margin: "4px 0 10px", color: "#e5e7eb" }}
      >
        {note}
      </p>
      <div
        style={{
          fontSize: "1.4rem",
          fontWeight: 800,
          color: "#f3f4f6",
        }}
      >
        {price}
      </div>
    </button>
  );
}

export default function SubscribePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  // Accept only weekly/monthly/annual from URL. If something else, ignore.
  const rawFromUrl = (params.get("plan") || "").toLowerCase();
  const planFromUrl = VALID_PLANS.includes(rawFromUrl) ? rawFromUrl : "";

  const [plan, setPlan] = useState(planFromUrl || "monthly"); // weekly | monthly | annual

  const amountNGN = useMemo(
    () => PLAN_PRICES_NGN[plan] || PLAN_PRICES_NGN.monthly,
    [plan]
  );

  useEffect(() => {
    if (planFromUrl) setPlan(planFromUrl);
  }, [planFromUrl]);

  // Load user profile to know if they are already subscribed
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.uid) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (!active) return;
        setProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("[SubscribePage] load user failed:", e);
        if (active) setProfile(null);
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const isActive =
    !!profile?.activeSubscription &&
    (!!profile?.subscriptionPlan || !!profile?.subscriptionExpiresAt);

  // Pay handlers
  const payWithPaystack = () => {
    if (!user) {
      alert("Please log in to subscribe.");
      nav("/login");
      return;
    }
    const pub = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    if (!pub) {
      alert("Missing REACT_APP_PAYSTACK_PUBLIC_KEY in .env.local");
      return;
    }
    const paystack = new PaystackPop();
    paystack.newTransaction({
      key: pub,
      email: user.email || "guest@example.com",
      amount: amountNGN * 100, // Kobo
      metadata: {
        plan,
        customer_name: user.displayName || "Nesta User",
        uid: user.uid,
        purpose: "nesta_subscription",
      },
      onSuccess: async () => {
        try {
          await activateSubscription(user.uid, plan);
          alert("✅ Subscription activated");
          nav(-1);
        } catch (e) {
          console.error(e);
          alert("Payment succeeded, but activating subscription failed.");
        }
      },
      onCancel: () => {
        alert("❌ Payment cancelled");
      },
    });
  };

  // Early return for guests (we still show a taste of luxury with the carousel)
  if (!user) {
    return (
      <main className="container section-pad">
        <FeaturedCarousel useDemo />
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.15)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.65))",
            boxShadow:
              "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
            maxWidth: 780,
            margin: "16px auto 0",
            padding: 18,
            color: "#e5e7eb",
          }}
        >
          <h2 style={{ margin: "6px 0 6px" }}>Please log in to subscribe</h2>
          <p className="muted">
            Subscriptions unlock host/partner contact visibility after bookings
            and other premium tools.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container section-pad">
      {/* Sponsored / Featured listings carousel */}
      <FeaturedCarousel />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.15)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.65))",
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          maxWidth: 780,
          margin: "16px auto 0",
          padding: 18,
        }}
      >
        <h1 style={{ margin: "6px 0 2px", color: "#f3f4f6" }}>
          Host subscription
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Boost visibility, unlock contact details after bookings, and enjoy
          priority support on Nesta.
        </p>

        {/* Global subscription status strip */}
        <SubscriptionBanner />

        {loadingProfile ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background:
                "linear-gradient(90deg, rgba(148,163,184,0.18), rgba(15,23,42,0.85))",
              padding: 12,
              fontSize: "0.9rem",
              color: "#e5e7eb",
            }}
          >
            Checking your current subscription…
          </div>
        ) : isActive ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: "1px solid rgba(16,185,129,0.5)",
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,95,70,0.9))",
              padding: 16,
              color: "#ecfdf5",
            }}
          >
            <h2
              style={{
                margin: "0 0 4px",
                fontSize: "1.05rem",
                fontWeight: 600,
              }}
            >
              You&apos;re already covered
            </h2>
            <p
              className="muted"
              style={{ margin: 0, fontSize: "0.9rem", color: "#d1fae5" }}
            >
              Your current plan will remain active until the expiry date shown
              above. You&apos;ll be able to extend or upgrade closer to that
              time. Thank you for partnering with Nesta.
            </p>
          </div>
        ) : (
          <>
            {/* Plan selector */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              <PlanCard
                title="Weekly"
                price={`₦${PLAN_PRICES_NGN.weekly.toLocaleString()}`}
                active={plan === "weekly"}
                onSelect={() => setPlan("weekly")}
                note="Try Nesta Premium for 7 days."
              />
              <PlanCard
                title="Monthly"
                price={`₦${PLAN_PRICES_NGN.monthly.toLocaleString()}`}
                active={plan === "monthly"}
                onSelect={() => setPlan("monthly")}
                note="Best for frequent users."
                featured
              />
              <PlanCard
                title="Annual"
                price={`₦${PLAN_PRICES_NGN.annual.toLocaleString()}`}
                active={plan === "annual"}
                onSelect={() => setPlan("annual")}
                note="Save more with yearly access."
              />
            </div>

            {/* Pay actions */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
                marginTop: 16,
              }}
            >
              <button className="btn btn-gold" onClick={payWithPaystack}>
                Pay with Paystack (₦{amountNGN.toLocaleString()})
              </button>
            </div>

            <p
              className="muted"
              style={{
                marginTop: 18,
                fontSize: "0.85rem",
                color: "#cbd5e1",
              }}
            >
              Your subscription helps us keep Nesta safe, secure, and growing.
              You can upgrade or extend at any time.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
