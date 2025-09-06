import React from "react";

export default function WelcomeCard({ children, title = "Welcome to Nesta", subtitle }) {
  return (
    <div
      className="card"
      style={{
        marginTop: 18,
        padding: 26,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(30,41,59,0.40), rgba(30,41,59,0.30))",
        boxShadow: "0 24px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
        maxWidth: 840,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle ? (
          <p
            className="muted"
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}