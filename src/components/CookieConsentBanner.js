// src/components/CookieConsentBanner.js
//
// NDPR-compliant cookie consent banner.
// - Shows on first visit if no consent record exists
// - Granular: Strictly Necessary (always on) + Functional + Analytics + Marketing
// - Persists choice to localStorage under "nesta_cookie_consent"
// - Exposes window.__nestaCookieConsent for use by analytics/marketing scripts
// - "Manage preferences" panel for granular control
// - Re-shows if consent record is older than 12 months
//
// Usage: Place <CookieConsentBanner /> once inside <BrowserRouter> in AppRouter.js
// It renders null if consent is already given.

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "nesta_cookie_consent";
const CONSENT_VERSION = "1.0";
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

const DEFAULT_PREFS = {
  strictly_necessary: true,   // always true, cannot be toggled
  functional: false,
  analytics: false,
  marketing: false,
};

// ─── Persist + broadcast consent ─────────────────────────────────────────────
function saveConsent(prefs) {
  const record = {
    version: CONSENT_VERSION,
    savedAt: Date.now(),
    prefs: { ...prefs, strictly_necessary: true },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
  // Make available globally for GTM / analytics bootstrap
  window.__nestaCookieConsent = record.prefs;
  // Dispatch event so other scripts can react
  window.dispatchEvent(new CustomEvent("nestaCookieConsent", { detail: record.prefs }));
}

// ─── Load existing consent ────────────────────────────────────────────────────
function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    // Expire after 12 months
    if (!record?.savedAt || Date.now() - record.savedAt > CONSENT_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none ${
        disabled
          ? "border-emerald-500/50 bg-emerald-500/30 cursor-not-allowed"
          : checked
          ? "border-amber-400 bg-amber-400 cursor-pointer"
          : "border-white/20 bg-white/10 cursor-pointer"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
          checked || disabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Main banner ──────────────────────────────────────────────────────────────
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      // Small delay so the banner doesn't flash during initial hydration
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    } else {
      // Restore prefs for window global even if banner is hidden
      window.__nestaCookieConsent = existing.prefs;
    }
  }, []);

  const dismiss = useCallback((finalPrefs) => {
    saveConsent(finalPrefs);
    setAnimateOut(true);
    setTimeout(() => setVisible(false), 350);
  }, []);

  const acceptAll = useCallback(() => {
    dismiss({ strictly_necessary: true, functional: true, analytics: true, marketing: true });
  }, [dismiss]);

  const rejectAll = useCallback(() => {
    dismiss({ ...DEFAULT_PREFS, strictly_necessary: true });
  }, [dismiss]);

  const savePreferences = useCallback(() => {
    dismiss(prefs);
  }, [dismiss, prefs]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-350 ${
        animateOut ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ transition: "transform 350ms cubic-bezier(0.4,0,0.2,1)" }}
    >
      {/* Backdrop blur strip */}
      <div className="bg-[#05070a]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">

        {/* ── Manage preferences panel ── */}
        {showManage && (
          <div className="border-b border-white/10 px-4 md:px-8 py-5">
            <div className="max-w-4xl mx-auto space-y-4">
              <h3 className="text-sm font-bold text-white">Cookie preferences</h3>

              {[
                {
                  key: "strictly_necessary",
                  label: "Strictly Necessary",
                  desc: "Required for login, checkout, and KYC. Cannot be disabled.",
                  locked: true,
                },
                {
                  key: "functional",
                  label: "Functional",
                  desc: "Keeps you signed in across browser sessions and handles payment redirects.",
                  locked: false,
                },
                {
                  key: "analytics",
                  label: "Analytics",
                  desc: "Helps us understand how the platform is used so we can improve it. Data is anonymised.",
                  locked: false,
                },
                {
                  key: "marketing",
                  label: "Marketing",
                  desc: "Used to show relevant ads on third-party platforms like Facebook.",
                  locked: false,
                },
              ].map(({ key, label, desc, locked }) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">{label}</span>
                      {locked && (
                        <span className="text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wider">
                          Always on
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <Toggle
                    checked={locked ? true : prefs[key]}
                    disabled={locked}
                    onChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={savePreferences}
                  className="px-5 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors"
                >
                  Save preferences
                </button>
                <button
                  onClick={() => setShowManage(false)}
                  className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-white/70 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main banner row ── */}
        <div className="px-4 md:px-8 py-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-4">

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/75 leading-relaxed">
                <span className="font-semibold text-white">NestaNg uses cookies</span> to
                keep the platform secure, remember your preferences, and (with your
                consent) improve the service and show relevant ads. Read our{" "}
                <Link
                  to="/cookie-policy"
                  className="underline text-amber-300/80 hover:text-amber-300"
                >
                  Cookie Policy
                </Link>{" "}
                for full details.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowManage((v) => !v)}
                className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white/70 hover:bg-white/10 transition-colors"
              >
                {showManage ? "Hide options" : "Manage"}
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white/70 hover:bg-white/10 transition-colors"
              >
                Reject optional
              </button>
              <button
                onClick={acceptAll}
                className="px-5 py-2 rounded-xl bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-colors"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Hook for consuming consent state in other components ─────────────────────
// Usage: const { analytics, marketing } = useCookieConsent();
export function useCookieConsent() {
  const [consent, setConsent] = useState(() => {
    const existing = loadConsent();
    return existing?.prefs || DEFAULT_PREFS;
  });

  useEffect(() => {
    function onConsent(e) {
      setConsent(e.detail || DEFAULT_PREFS);
    }
    window.addEventListener("nestaCookieConsent", onConsent);
    return () => window.removeEventListener("nestaCookieConsent", onConsent);
  }, []);

  return consent;
}