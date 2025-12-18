import React from "react";

/**
 * Adds safe top padding so fixed Header doesn't cover page content.
 * 96px works well with your current Header (logo + nav + buttons).
 */
export default function PageShell({ children, style }) {
  return (
    <main
      className="max-w-6xl mx-auto px-6"
      style={{ paddingTop: 96, paddingBottom: 32, ...style }}
    >
      {children}
    </main>
  );
}
