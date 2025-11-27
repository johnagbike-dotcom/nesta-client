import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="container" style={{ maxWidth: 900, margin: "48px auto", color: "#e5e7eb" }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <p><Link to="/homepage">Back to Home</Link></p>
    </main>
  );
} 