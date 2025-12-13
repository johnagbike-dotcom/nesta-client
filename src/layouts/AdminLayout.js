// src/layouts/AdminLayout.js
import React from "react";
import AdminHeader from "../components/AdminHeader";

const TOP_BAR_OFFSET = 96; // adjust to 88–104 if needed

export default function AdminLayout({ title, subtitle, rightActions = null, children }) {
  return (
    <main
      className="container mx-auto px-4 py-5 text-white"
      style={{ paddingTop: TOP_BAR_OFFSET }}
    >
      <AdminHeader
        back
        title={title}
        subtitle={subtitle}
        rightActions={rightActions}
      />

      {children}
    </main>
  );
}
