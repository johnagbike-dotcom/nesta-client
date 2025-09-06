import React from "react";
import { Link } from "react-router-dom";
import { formatNaira, firstPhoto } from "../utils/format";

export default function ListingCard({
  listing,
  actions = [], // e.g. [{label:'View', to:'/listing/123'}, {label:'Edit', to:'/edit/123'}, {label:'Delete', onClick: fn}]
  badge,         // e.g. "Featured"
}) {
  const { id, title, city, area, type, pricePerNight, photoUrls } = listing;
  const cover = firstPhoto(photoUrls);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-800 bg-[#0b0f14] shadow-md hover:shadow-lg transition-shadow">
      {/* media */}
      {cover ? (
        <Link to={`/listing/${id}`}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={cover} className="w-full h-40 sm:h-48 object-cover" />
        </Link>
      ) : (
        <div className="w-full h-40 sm:h-48 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm uppercase tracking-wider text-gray-400">Photo</div>
            <div className="text-lg font-semibold text-gray-300">coming soon</div>
          </div>
        </div>
      )}

      {/* body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold leading-snug">
            <Link to={`/listing/${id}`} className="hover:underline">{title}</Link>
          </h3>
          {badge && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded
                              bg-indigo-600/20 border border-indigo-600/40 text-indigo-300">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-gray-300">
          {formatNaira(pricePerNight)}/night • {city}{area ? ` • ${area}` : ""}
        </div>
        <div className="mt-0.5 text-xs text-gray-400">{type}</div>

        {/* actions */}
        {actions?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((a, i) =>
              a.to ? (
                <Link
                  key={i}
                  to={a.to}
                  className="px-3 py-1.5 text-sm rounded border border-gray-700 hover:border-gray-600"
                >
                  {a.label}
                </Link>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    a.variant === "danger"
                      ? "border-red-700 text-red-300 hover:border-red-600"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {a.label}
                </button>
              )
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}