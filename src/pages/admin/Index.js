// src/pages/admin/Index.js
import React from "react";
import { Link } from "react-router-dom";

export default function AdminIndex() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-extrabold text-yellow-400 mb-2">Admin Dashboard</h1>
      <p className="text-gray-300 mb-8">
        Review activity, manage users & listings, and configure platform settings.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Listings & Bookings */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Listings &amp; Bookings</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link className="hover:underline" to="/admin/listings">
                Listings admin
              </Link>
              <span className="ml-2 text-xs text-gray-400">approve, flag, or remove</span>
            </li>
            <li>
              <Link className="hover:underline" to="/admin/bookings">
                Bookings admin
              </Link>
              <span className="ml-2 text-xs text-gray-400">refunds, disputes, status</span>
            </li>
          </ul>
        </section>

        {/* Configuration */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Configuration</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link className="hover:underline" to="/admin/settings">
                Settings
              </Link>
              <span className="ml-2 text-xs text-gray-400">fees, payout rules, theme</span>
            </li>
            <li>
              <Link className="hover:underline" to="/admin/feature-requests">
                Feature requests
              </Link>
              <span className="ml-2 text-xs text-gray-400">triage roadmap ideas</span>
            </li>
          </ul>
        </section>

        {/* Users */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Users</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              {/* ✅ route matches AdminRouter: manage-users */}
              <Link className="hover:underline" to="/admin/manage-users">
                User directory
              </Link>
              <span className="ml-2 text-xs text-gray-400">roles, KYC, flags</span>
            </li>
            <li>
              {/* For now this also goes to manage-users; later we can deep–link ?role=partner */}
              <Link className="hover:underline" to="/admin/manage-users">
                Verified partners
              </Link>
              <span className="ml-2 text-xs text-gray-400">applications &amp; reviews</span>
            </li>
          </ul>
        </section>

        {/* Money */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Financials</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link className="hover:underline" to="/admin/payouts">
                Payouts
              </Link>
              <span className="ml-2 text-xs text-gray-400">hosts &amp; partners</span>
            </li>
            <li>
              <Link className="hover:underline" to="/admin/reports">
                Reports &amp; exports
              </Link>
              <span className="ml-2 text-xs text-gray-400">CSV, monthly summaries</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
