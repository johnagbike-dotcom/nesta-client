// src/auth/ResetPassword.js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter the email you used for your account.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Reset link sent. Check your inbox and spam.");
    } catch (err) {
      // Common Firebase auth codes mapped to friendly text
      const map = {
        "auth/invalid-email": "That email address is not valid.",
        "auth/user-not-found": "No account found with that email.",
        "auth/too-many-requests":
          "Too many attempts. Please wait a minute and try again.",
      };
      toast.error(map[err.code] || "Could not send reset email. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-extrabold">Reset password</h1>
        <p className="mt-3 text-white/80">
          Enter the email you used to create your account. We’ll send a secure
          link to reset your password.
        </p>

        {/* Policy helper so users know the rules (matches your Firebase policy) */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <div className="font-semibold mb-1">Password rules</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>At least 10 characters</li>
            <li>Includes uppercase and lowercase letters</li>
            <li>Includes a number and a special character</li>
          </ul>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 max-w-md">
          <label className="grid gap-2">
            <span className="text-white/80">Email address</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl px-5 py-3 bg-gradient-to-b from-amber-400 to-amber-500 text-black font-semibold shadow-[0_6px_0_#c47e00] hover:translate-y-[1px] hover:shadow-[0_5px_0_#c47e00] active:translate-y-[2px] active:shadow-[0_4px_0_#c47e00] disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>

          <div className="text-sm text-white/70">
            Remembered your password?{" "}
            <Link to="/login" className="text-amber-300 hover:text-amber-200">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

