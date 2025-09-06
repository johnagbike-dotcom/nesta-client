import React from "react";

const LogoMark = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className="w-10 h-10"
    >
      {/* Circle outline */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="#D4AF37"   // Primary luxury gold
        strokeWidth="6"
        fill="#0f0f0f"     // Deep black background
      />

      {/* Stylized N */}
      <path
        d="M30 70 L30 30 L70 70 L70 30"
        stroke="#FFD700"   // Brighter gold accent
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default LogoMark; 