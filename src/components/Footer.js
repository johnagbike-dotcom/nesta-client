// src/components/Footer.js
import React from "react";
import { Link } from "react-router-dom";
import LogoWordmark from "./LogoWordmark";

export default function Footer() {
  return (
    <footer className="site-footer bg-[#0f172a] text-gray-300 py-8 mt-12">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0">
       
        {/* Logo and brand */}
        <div className="flex items-center space-x-3">
          <LogoWordmark />
          <span className="text-sm text-gray-400">© {new Date().getFullYear()} Nesta. All rights reserved.</span>
        </div>

        {/* Footer Links */}
        <div className="flex space-x-6 text-sm">
          <Link to="/terms" className="hover:text-white transition">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-white transition">
            Privacy
          </Link>
          <Link to="/help" className="hover:text-white transition">
            Help
          </Link>
        </div>
      </div>
    </footer>
  );
}