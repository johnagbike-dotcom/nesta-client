// src/pages/admin/Index.js
import React from "react";
import { Link } from "react-router-dom";

export default function AdminIndex() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-extrabold text-yellow-400 mb-2">
        Admin Control Centre
      </h1>
      <p className="text-gray-300 mb-8">
        Monitor activity, manage listings & users, and configure the Nesta platform.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Listings & Bookings */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">
            Listings &amp; Bookings
          </h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link to="/admin/listings" className="hover:underline">
                Listings admin
              </Link>
              <span className="ml-2 text-xs text-gray-400">approve, flag, remove</span>
            </li>
            <li>
              <Link to="/admin/bookings-admin" className="hover:underline">
                Bookings admin
              </Link>
              <span className="ml-2 text-xs text-gray-400">refunds, disputes, status</span>
            </li>
          </ul>
        </section>

        {/* Configuration */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">
            Configuration
          </h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link to="/admin/settings" className="hover:underline">
                Settings
              </Link>
              <span className="ml-2 text-xs text-gray-400">platform rules & switches</span>
            </li>
            <li>
              <Link to="/admin/feature-requests" className="hover:underline">
                Feature requests
              </Link>
              <span className="ml-2 text-xs text-gray-400">spotlight & premium</span>
            </li>
          </ul>
        </section>

        {/* Users */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Users</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link to="/admin/manage-users" className="hover:underline">
                User directory
              </Link>
              <span className="ml-2 text-xs text-gray-400">roles, KYC, flags</span>
            </li>
          </ul>
        </section>

        {/* Financials */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Financials</h2>
          <ul className="space-y-2 text-gray-200">
            <li>
              <Link to="/admin/payouts" className="hover:underline">
                Payouts
              </Link>
              <span className="ml-2 text-xs text-gray-400">hosts & partners</span>
            </li>
            <li>
              <Link to="/admin/reports" className="hover:underline">
                Reports &amp; exports
              </Link>
              <span className="ml-2 text-xs text-gray-400">CSV & analytics</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
