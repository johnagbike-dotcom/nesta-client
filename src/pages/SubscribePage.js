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

const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

/* ---------------- Pricing ---------------- */
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
  const expiresAtISO = new Date(now + (PLAN_MS[plan] || PLAN_MS.monthly)).toISOString();

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
        border: featured ? "2px solid #f0b429" : "1px solid rgba(240,180,41,0.35)",
        boxShadow: featured ? "0 14px 28px rgba(0,0,0,0.35)" : "0 10px 24px rgba(0,0,0,0.25)",
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

      <p className="muted" style={{ margin: "4px 0 10px", color: "#e5e7eb" }}>
        {note}
      </p>

      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f3f4f6" }}>{price}</div>
    </button>
  );
}
function loadFlutterwaveScript() {
  return new Promise((resolve, reject) => {
    if (window.FlutterwaveCheckout) return resolve(true);

    const existing = document.querySelector('script[data-flw="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", reject);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://checkout.flutterwave.com/v3.js";
    s.async = true;
    s.dataset.flw = "1";
    s.onload = () => resolve(true);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export default function SubscribePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  // Accept only weekly/monthly/annual from URL. If something else, ignore.
  const rawFromUrl = (params.get("plan") || "").toLowerCase();
  const planFromUrl = VALID_PLANS.includes(rawFromUrl) ? rawFromUrl : "";

  const [plan, setPlan] = useState(planFromUrl || "monthly");
  const amountNGN = useMemo(() => PLAN_PRICES_NGN[plan] || PLAN_PRICES_NGN.monthly, [plan]);

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
    !!profile?.activeSubscription && (!!profile?.subscriptionPlan || !!profile?.subscriptionExpiresAt);

  /* ---------------- Paystack ---------------- */
  const payWithPaystack = () => {
    if (!user) {
      alert("Please log in to subscribe.");
      nav("/login");
      return;
    }

    const pub = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    if (!pub) {
      alert("Missing REACT_APP_PAYSTACK_PUBLIC_KEY in env");
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

  /* ---------------- Flutterwave ---------------- */
  const payWithFlutterwave = async () => {
    if (!user) {
      alert("Please log in to subscribe.");
      nav("/login");
      return;
    }

    const pub = process.env.REACT_APP_FLW_PUBLIC_KEY;
    if (!pub) {
      alert("Missing REACT_APP_FLW_PUBLIC_KEY in env");
      return;
    }

    if (!window.FlutterwaveCheckout) {
      alert("Flutterwave script not loaded. Add it in index.html.");
      return;
    }

    const tx_ref = `nesta_sub_${user.uid}_${plan}_${Date.now()}`;
    await loadFlutterwaveScript();
if (!window.FlutterwaveCheckout) {
  alert("Flutterwave failed to load.");
  return;
}
    window.FlutterwaveCheckout({
      public_key: pub,
      tx_ref,
      amount: amountNGN,
      currency: "NGN",
      payment_options: "card,banktransfer,ussd",
      customer: {
        email: user.email || "guest@example.com",
        name: user.displayName || "Nesta User",
      },
      customizations: {
        title: "Nesta Subscription",
        description: `Host subscription (${plan})`,
        logo: "https://your-logo-url-if-you-have-one",
      },
      meta: { uid: user.uid, plan, purpose: "nesta_subscription" },

      callback: async (response) => {
        try {
          const transaction_id =
            response?.transaction_id ||
            response?.transactionId ||
            response?.id ||
            "";

          if (!transaction_id) {
            alert("Missing Flutterwave transaction id. Subscription not activated.");
            return;
          }

          // ✅ Send Firebase ID token so server can enforce uid match
          const token = await user.getIdToken();

          // ✅ verify on server BEFORE activating
          const res = await fetch(`${API_BASE}/flutterwave/verify-subscription`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tx_ref,
              transaction_id,
              uid: user.uid,
              plan,
            }),
          });

          const payload = await res.json().catch(() => null);

          if (!res.ok || !payload?.ok) {
            alert(payload?.message || "Verification failed. Subscription not activated.");
            return;
          }

          await activateSubscription(user.uid, plan);
          alert("✅ Subscription activated");
          nav(-1);
        } catch (e) {
          console.error(e);
          alert("Payment succeeded, but subscription activation failed.");
        }
      },

      onclose: () => {
        // user closed modal
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
            background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.65))",
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
            Subscriptions unlock host/partner contact visibility after bookings and other premium
            tools.
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
          background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.65))",
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          maxWidth: 780,
          margin: "16px auto 0",
          padding: 18,
        }}
      >
        <h1 style={{ margin: "6px 0 2px", color: "#f3f4f6" }}>Host subscription</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Boost visibility, unlock contact details after bookings, and enjoy priority support on
          Nesta.
        </p>

        {/* Global subscription status strip */}
        <SubscriptionBanner />

        {loadingProfile ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "linear-gradient(90deg, rgba(148,163,184,0.18), rgba(15,23,42,0.85))",
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
              background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,95,70,0.9))",
              padding: 16,
              color: "#ecfdf5",
            }}
          >
            <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 600 }}>
              You&apos;re already covered
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem", color: "#d1fae5" }}>
              Your current plan will remain active until the expiry date shown above. You&apos;ll be
              able to extend or upgrade closer to that time. Thank you for partnering with Nesta.
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

              <button className="btn btn-outline" onClick={payWithFlutterwave}>
                Pay with Flutterwave (₦{amountNGN.toLocaleString()})
              </button>
            </div>

            <p className="muted" style={{ marginTop: 18, fontSize: "0.85rem", color: "#cbd5e1" }}>
              Your subscription helps us keep Nesta safe, secure, and growing. You can upgrade or
              extend at any time.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
