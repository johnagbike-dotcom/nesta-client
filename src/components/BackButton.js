// src/components/BackButton.js
import React from "react";
import { useNavigate } from "react-router-dom";

export default function BackButton({ to = -1, label = "Back" }) {
  const navigate = useNavigate();
  const onClick = () => (typeof to === "number" ? navigate(to) : navigate(to));
  return (
    <button className="btn ghost" onClick={onClick}>
      ← {label}
    </button>
  );
} 