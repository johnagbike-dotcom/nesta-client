import React from "react";
import { Link } from "react-router-dom";

export default function NotAuthorized() {
  return (
    <main className="container" style={{ maxWidth: 900, margin: "48px auto", color: "#e5e7eb" }}>
      <h1>Access Denied</h1>
      <p>You don’t have permission to view this page.</p>
      <p><Link to="/homepage">Back to Home</Link></p>
    </main>
  );
} 