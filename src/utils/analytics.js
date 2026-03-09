// src/utils/analytics.js
// Google Analytics 4 — Measurement ID: G-PYS8BZYXFE
// Usage: import { initGA, trackPageView, trackEvent } from './utils/analytics';

const GA_ID = process.env.REACT_APP_GA_ID || "G-PYS8BZYXFE";

/* ── Load the GA4 script once ── */
export function initGA() {
  if (typeof window === "undefined") return;
  if (window.__ga_initialized) return;
  window.__ga_initialized = true;

  // Inject gtag script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  // Init dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, {
    send_page_view: false, // we fire manually on route change
    anonymize_ip: true,
  });
}

/* ── Fire on every route change ── */
export function trackPageView(path) {
  if (typeof window?.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path || window.location.pathname,
    page_title: document.title,
  });
}

/* ── Optional: custom events ── */
// trackEvent("booking_started", { listing_id: "abc123", amount: 50000 })
export function trackEvent(eventName, params = {}) {
  if (typeof window?.gtag !== "function") return;
  window.gtag("event", eventName, params);
}