// src/auth/MfaSetup.js
import React, { useState, useEffect } from "react";
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  multiFactor,
} from "firebase/auth";
import { auth } from "../firebase";

export default function MfaSetup() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifier, setVerifier] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Initialize reCAPTCHA only once
    if (!verifier) {
      try {
        const recaptchaVerifier = new RecaptchaVerifier(
          "recaptcha-container",
          {
            size: "normal", // "invisible" also works if you prefer
            callback: () => {
              console.log("reCAPTCHA solved");
            },
            "expired-callback": () => {
              setMessage("reCAPTCHA expired, please try again.");
            },
          },
          auth
        );
        recaptchaVerifier.render();
        setVerifier(recaptchaVerifier);
      } catch (err) {
        console.error("Error setting up reCAPTCHA:", err);
      }
    }
  }, [verifier]);

  // Step 1: Send SMS code
  const sendCode = async () => {
    if (!phoneNumber.startsWith("+")) {
      setMessage("Phone number must be in E.164 format, e.g. +234813xxxxxxx");
      return;
    }
    try {
      const session = await multiFactor(auth.currentUser).getSession();
      const phoneOpts = {
        phoneNumber,
        session,
      };
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(phoneOpts, verifier);
      setVerificationId(id);
      setMessage("SMS code sent. Please check your phone.");
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Failed to send SMS code.");
    }
  };

  // Step 2: Enroll factor
  const enrollFactor = async () => {
    if (!verificationId || !verificationCode) {
      setMessage("Enter the code you received by SMS.");
      return;
    }
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      await multiFactor(auth.currentUser).enroll(cred, "Phone number");
      setMessage("✅ Two-factor authentication enabled successfully!");
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Failed to enroll second factor.");
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white px-5 py-10">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Enable 2-step verification</h1>

        <p className="mb-4 text-white/70">
          Add a phone number to protect your account with a verification code.
        </p>

        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Phone number (E.164, e.g. +234813XXXXXXX)"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4"
        />

        <div id="recaptcha-container" className="mb-4"></div>

        <button
          onClick={sendCode}
          className="rounded-xl px-5 py-3 bg-amber-500 text-black font-semibold shadow-md mr-2"
        >
          Send code
        </button>

        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          placeholder="Enter SMS code"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 mt-4"
        />

        <button
          onClick={enrollFactor}
          className="rounded-xl px-5 py-3 bg-green-500 text-black font-semibold shadow-md mt-4"
        >
          Enroll
        </button>

        {message && <p className="mt-4 text-amber-300">{message}</p>}
      </div>
    </main>
  );
}