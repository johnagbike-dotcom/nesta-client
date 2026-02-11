// src/components/ListingMap.js
import React, { useEffect, useMemo, useRef, useState } from "react";

// Dark-ish Nesta style
const nestaDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#05070d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#02040a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
];

// ---- simple global loader so we only inject the script once ----
// NOTE: With `loading=async`, Google expects a `callback=` param.
// Without it, you can hit `maps.Map is not a constructor`.
function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));

  // Already fully loaded
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);

  if (window.__nestaGMapsPromise) return window.__nestaGMapsPromise;

  window.__nestaGMapsPromise = new Promise((resolve, reject) => {
    // Ensure we have a stable global callback for Google to invoke
    window.__nestaGMapsOnLoad = () => {
      if (window.google?.maps?.Map) resolve(window.google.maps);
      else reject(new Error("Google Maps loaded but API is incomplete"));
    };

    const existing = document.querySelector('script[data-nesta-gmaps="1"]');
    if (existing) {
      // If script exists but API not ready yet, wait via callback or poll a little
      if (window.google?.maps?.Map) {
        resolve(window.google.maps);
        return;
      }

      // Small fallback polling in case browser cached script and callback timing differs
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.google?.maps?.Map) {
          clearInterval(t);
          resolve(window.google.maps);
        } else if (tries >= 50) {
          clearInterval(t);
          reject(new Error("Google Maps timed out"));
        }
      }, 100);

      existing.addEventListener("error", () => {
        clearInterval(t);
        reject(new Error("Google maps script error"));
      });

      return;
    }

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: "__nestaGMapsOnLoad",
      v: "weekly",
      // libraries: "places", // uncomment if you use Places (autocomplete/search)
    });

    const script = document.createElement("script");
    script.dataset.nestaGmaps = "1";
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;

    script.onerror = () => reject(new Error("Google maps script error"));

    document.head.appendChild(script);
  });

  return window.__nestaGMapsPromise;
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export default function ListingMap({
  lat,
  lng,
  editable = false,
  onChange,
  height = 260,
  zoomWhenHasCoords = 14,
  zoomWhenNoCoords = 11,
}) {
  const apiKey = String(process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

  const hasCoords = isNum(lat) && isNum(lng);
  const fallbackCenter = useMemo(() => ({ lat: 9.0765, lng: 7.3986 }), []);

  const center = useMemo(() => (hasCoords ? { lat, lng } : fallbackCenter), [
    hasCoords,
    lat,
    lng,
    fallbackCenter,
  ]);

  const mapsLink = useMemo(() => {
    const z = hasCoords ? zoomWhenHasCoords : zoomWhenNoCoords;
    const q = hasCoords ? `${lat},${lng}` : `${fallbackCenter.lat},${fallbackCenter.lng}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${encodeURIComponent(String(z))}`;
  }, [hasCoords, lat, lng, fallbackCenter, zoomWhenHasCoords, zoomWhenNoCoords]);

  const containerRef = useRef(null);

  // persistent instances
  const mapsApiRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [status, setStatus] = useState(() => {
    if (!apiKey) return "no-key"; // no-key | loading | ready | error
    return "loading";
  });

  // 1) Init map ONCE (IMPORTANT: do not render children inside map div)
  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setStatus("no-key");
      return;
    }
    if (!containerRef.current) return;

    setStatus("loading");

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled) return;

        mapsApiRef.current = maps;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center,
            zoom: hasCoords ? zoomWhenHasCoords : zoomWhenNoCoords,
            styles: nestaDarkStyle,
            disableDefaultUI: false,
            zoomControl: true,
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            gestureHandling: "greedy",
          });
        }

        setStatus("ready");
      })
      .catch((err) => {
        console.error("[ListingMap] Google Maps load failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // 2) Update center/zoom when coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setCenter(center);
    map.setZoom(hasCoords ? zoomWhenHasCoords : zoomWhenNoCoords);
  }, [center, hasCoords, zoomWhenHasCoords, zoomWhenNoCoords]);

  // 3) Marker: create/update/remove
  useEffect(() => {
    const maps = mapsApiRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (hasCoords) {
      const pos = { lat, lng };
      if (!markerRef.current) {
        markerRef.current = new maps.Marker({ position: pos, map });
      } else {
        markerRef.current.setMap(map);
        markerRef.current.setPosition(pos);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    }
  }, [hasCoords, lat, lng]);

  // 4) Editable: click to set pin
  useEffect(() => {
    const maps = mapsApiRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (clickListenerRef.current) {
      maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (!editable) return;

    clickListenerRef.current = map.addListener("click", (e) => {
      try {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };

        if (!markerRef.current) markerRef.current = new maps.Marker({ position: pos, map });
        else {
          markerRef.current.setMap(map);
          markerRef.current.setPosition(pos);
        }

        map.panTo(pos);
        if (typeof onChange === "function") onChange(pos);
      } catch (err) {
        console.warn("[ListingMap] click handler failed:", err);
      }
    });

    return () => {
      if (clickListenerRef.current) {
        maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [editable, onChange]);

  // 5) Cleanup listeners/marker on unmount
  useEffect(() => {
    return () => {
      const maps = mapsApiRef.current;

      if (maps && clickListenerRef.current) {
        maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }

      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }

      mapRef.current = null;
    };
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
      {/* Wrapper must be relative so overlay can sit ABOVE the map div */}
      <div className="relative" style={{ height: typeof height === "number" ? `${height}px` : height }}>
        {/* ✅ Map container must be EMPTY (no React children) */}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* ✅ Overlay sits ABOVE map container */}
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[1px] px-4 text-center">
            <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/75">
              {status === "no-key" && (
                <>
                  Google Maps API key missing. Add{" "}
                  <span className="text-white/90 font-semibold">REACT_APP_GOOGLE_MAPS_API_KEY</span>.
                </>
              )}
              {status === "loading" && <>Loading map…</>}
              {status === "error" && (
                <>Map failed to load. Check API key + Google Maps billing / referrer restrictions.</>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/10 bg-black/20">
        <div className="text-[11px] text-white/55 truncate">
          {editable ? "Tip: click on the map to set the pin." : "Exact details are shared after confirmation."}
        </div>

        <a
          href={mapsLink}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
          title="Open in Google Maps"
        >
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
