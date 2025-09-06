// src/pages/SubscribePage.js
import React from "react";
import { useNavigate } from "react-router-dom";

export default function SubscribePage() {
  const navigate = useNavigate();

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <button className="btn ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div
          className="card"
          style={{
            marginTop: 30,
            padding: 32,
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.15)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.65))",
            boxShadow:
              "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
            maxWidth: 780,
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginBottom: 10, color: "#f3f4f6" }}>
            Unlock Host Contact Details
          </h1>
          <p className="muted" style={{ marginBottom: 30 }}>
            Choose a subscription plan to view phone numbers and emails of hosts
            and agents. Chat is always free.
          </p>

          {/* Subscription Options */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {/* Weekly */}
            <div
              style={{
                borderRadius: 16,
                padding: 20,
                background:
                  "linear-gradient(135deg, rgba(240,180,41,0.15), rgba(217,154,11,0.05))",
                border: "1px solid rgba(240,180,41,0.35)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
              }}
            >
              <h3 style={{ color: "#f0b429", marginBottom: 8 }}>Weekly</h3>
              <p style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>
                Try Nesta Premium for a week.
              </p>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  margin: "14px 0",
                  color: "#f3f4f6",
                }}
              >
                ₦2,000
              </div>
              <button
                className="btn"
                style={{ width: "100%" }}
                onClick={() => alert("Connect to Paystack/Flutterwave here")}
              >
                Subscribe
              </button>
            </div>

            {/* Monthly */}
            <div
              style={{
                borderRadius: 16,
                padding: 20,
                background:
                  "linear-gradient(135deg, rgba(240,180,41,0.25), rgba(217,154,11,0.1))",
                border: "2px solid #f0b429",
                boxShadow: "0 14px 28px rgba(0,0,0,0.35)",
                transform: "scale(1.05)",
              }}
            >
              <h3 style={{ color: "#f0b429", marginBottom: 8 }}>Monthly</h3>
              <p style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>
                Best for frequent users.
              </p>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: "700",
                  margin: "14px 0",
                  color: "#f3f4f6",
                }}
              >
                ₦5,000
              </div>
              <button
                className="btn"
                style={{
                  width: "100%",
                  background: "linear-gradient(90deg, #f0b429, #d99a0b)",
                  color: "#1f2937",
                  fontWeight: 700,
                }}
                onClick={() => alert("Connect to Paystack/Flutterwave here")}
              >
                Subscribe
              </button>
            </div>

            {/* Annual */}
            <div
              style={{
                borderRadius: 16,
                padding: 20,
                background:
                  "linear-gradient(135deg, rgba(240,180,41,0.15), rgba(217,154,11,0.05))",
                border: "1px solid rgba(240,180,41,0.35)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
              }}
            >
              <h3 style={{ color: "#f0b429", marginBottom: 8 }}>Annual</h3>
              <p style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>
                Save more with yearly access.
              </p>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  margin: "14px 0",
                  color: "#f3f4f6",
                }}
              >
                ₦50,000
              </div>
              <button
                className="btn"
                style={{ width: "100%" }}
                onClick={() => alert("Connect to Paystack/Flutterwave here")}
              >
                Subscribe
              </button>
            </div>
          </div>

          {/* Note */}
          <p
            className="muted"
            style={{ marginTop: 28, fontSize: "0.85rem", color: "#cbd5e1" }}
          >
            Your subscription helps us keep Nesta safe, secure, and growing.
          </p>
        </div>
      </div>
    </main>
  );
}