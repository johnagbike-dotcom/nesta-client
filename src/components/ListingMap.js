// src/components/ListingMap.js
import React, { useEffect, useRef } from "react";

const containerStyle = {
  width: "100%",
  height: "260px",
};

// Dark-ish Nesta style
const nestaDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#05070d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#02040a" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#111827" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca3af" }],
  },
];

// ---- simple global loader so we only inject the script once ----
function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__nestaGMapsPromise) return window.__nestaGMapsPromise;

  window.__nestaGMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google maps failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Google maps script error"));
    document.head.appendChild(script);
  });

  return window.__nestaGMapsPromise;
}

export default function ListingMap({ lat, lng, editable = false, onChange }) {
  const ref = useRef(null);

  // Abuja fallback centre if no coords yet
  const center =
    typeof lat === "number" && typeof lng === "number"
      ? { lat, lng }
      : { lat: 9.0765, lng: 7.3986 };

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("REACT_APP_GOOGLE_MAPS_API_KEY is missing.");
      return;
    }
    if (!ref.current) return;

    let map;
    let marker;
    let mapsApi;
    let clickListener;

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled) return;
        mapsApi = maps;

        map = new mapsApi.Map(ref.current, {
          center,
          zoom:
            typeof lat === "number" && typeof lng === "number" ? 14 : 11,
          styles: nestaDarkStyle,
          disableDefaultUI: !editable,
          zoomControl: true,
        });

        if (typeof lat === "number" && typeof lng === "number") {
          marker = new mapsApi.Marker({
            position: { lat, lng },
            map,
          });
        }

        if (editable) {
          clickListener = map.addListener("click", (e) => {
            const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            if (!marker) {
              marker = new mapsApi.Marker({ position: pos, map });
            } else {
              marker.setPosition(pos);
            }
            if (onChange) onChange(pos);
          });
        }
      })
      .catch((err) => {
        console.error("[ListingMap] Google Maps load failed:", err);
      });

    return () => {
      cancelled = true;
      if (mapsApi && map && clickListener) {
        mapsApi.event.removeListener(clickListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, editable]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10">
      <div style={containerStyle} ref={ref}>
        {!process.env.REACT_APP_GOOGLE_MAPS_API_KEY && (
          <div className="w-full h-full grid place-items-center text-xs text-white/60 bg-black/30">
            Google Maps API key missing
          </div>
        )}
      </div>
    </div>
  );
}
