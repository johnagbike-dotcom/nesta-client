import React from "react";

export default function WelcomeCard({
  children,
  title = "Welcome to Nesta",
  subtitle,
}) {
  return (
    <section
      className="card"
      style={{
        marginTop: 18,
        padding: 26,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "radial-gradient(900px 240px at 20% 0%, rgba(212,175,55,0.10), transparent 60%), linear-gradient(180deg, rgba(30,41,59,0.40), rgba(30,41,59,0.28))",
        boxShadow: "0 26px 60px rgba(0,0,0,0.33), inset 0 1px 0 rgba(255,255,255,0.06)",
        maxWidth: 860,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ margin: 0, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle ? (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.72)",
              maxWidth: 720,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}
