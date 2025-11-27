/** @type {import('tailwindcss').Config} */
module.exports = {
  // Files Tailwind should scan for class names
  content: ["./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],

  // Use class strategy so you can add/remove dark mode with a class on <html>
  darkMode: "class",

  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { lg: "1100px" }, // matches your layout width
    },

    extend: {
      // Brand palette (subtle luxe)
      colors: {
        charcoal: {
          DEFAULT: "#0f172a", // main bg
          light: "#1e293b",
          softer: "#111827",
        },
        gold: {
          DEFAULT: "#f0b429",
          dark: "#d99a0b",
        },
        orchid: {
          DEFAULT: "#d946ef",
          soft: "#f0abfc",
        },
        mint: {
          DEFAULT: "#14b8a6",
          soft: "#99f6e4",
        },
      },

      fontFamily: {
        // Body
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
        ],
        // Headlines / hero
        display: [
          "Playfair Display",
          "ui-serif",
          "Georgia",
          "Times New Roman",
          "Times",
          "serif",
        ],
      },

      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },

      boxShadow: {
        card: "0 10px 28px rgba(0,0,0,0.10)",
        glow: "0 8px 30px rgba(217,70,239,0.25)", // orchid glow
      },

      // Nice micro-motion for hero/CTA
      keyframes: {
        "subtle-fade-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "subtle-fade-up .6s ease-out both",
      },

      // Utility for hero gradient bg if you need it
      backgroundImage: {
        "nesta-hero":
          "radial-gradient(1200px 600px at 50% 10%, rgba(217,70,239,0.12), transparent 60%)",
      },
    },
  },

  // Keep plugins light; make sure @tailwindcss/forms is installed
  plugins: [require("@tailwindcss/forms")],
}; 
