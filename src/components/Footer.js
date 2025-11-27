// src/components/Footer.jsx
import React from "react";

export default function Footer() {
  return (
    <footer className="mt-10 mb-6 text-center text-xs text-slate-500">
      © 2025 Nesta. All rights reserved.{" "}
      <a href="/terms" className="underline">
        Terms
      </a>{" "}
      <a href="/privacy" className="underline">
        Privacy
      </a>{" "}
      <a href="/help" className="underline">
        Help
      </a>
    </footer>
  );
} 


