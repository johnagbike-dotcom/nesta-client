// src/pages/DashboardRouter.js
import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";

import AdminDashboard from "./admin/AdminDashboard";
import ManageListings from "./admin/ManageListings";
import ManageUsers from "./admin/ManageUsers";
import Transactions from "./admin/Transactions";
import AdminFeatureRequests from "./admin/AdminFeatureRequests";
import Settings from "./admin/Settings";
import AdminDataTools from "./admin/AdminDataTools";

export default function DashboardRouter() {
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <h1>Admin</h1>

      {/* Simple admin nav */}
      <nav
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          margin: "12px 0 20px",
        }}
      >
        <Tab to="dashboard" label="Dashboard" />
        <Tab to="listings" label="Manage Listings" />
        <Tab to="users" label="Manage Users" />
        <Tab to="transactions" label="Transactions" />
        <Tab to="features" label="Feature Requests" />
        <Tab to="settings" label="Settings" />
        <Tab to="tools" label="Data Tools" />
      </nav>

      <div className="card" style={{ padding: 16 }}>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="listings" element={<ManageListings />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="features" element={<AdminFeatureRequests />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tools" element={<AdminDataTools />} />

          {/* 404 within /admin */}
          <Route path="*" element={<div>Not found (admin)</div>} />
        </Routes>
      </div>
    </div>
  );
}

function Tab({ to, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        textDecoration: "none",
        color: "inherit",
        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
      })}
      end
    >
      {label}
    </NavLink>
  );
}
