import React, { useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase"; // adjust if your firebase config is in another path
import { useNavigate } from "react-router-dom";

function PhoneSignInPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const navigate = useNavigate();

  // Setup invisible reCAPTCHA
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "sign-in-button", {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA solved");
        },
      });
    }
  };

  const requestOtp = async () => {
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      alert("OTP sent to your phone!");
    } catch (error) {
      console.error("Error during sign-in:", error);
      alert(error.message);
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResult) return;
    try {
      await confirmationResult.confirm(otp);
      alert("Phone login successful!");
      navigate("/dashboard"); // redirect after login
    } catch (error) {
      console.error("OTP verification failed:", error);
      alert("Invalid OTP. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Phone Sign-In</h2>

        <input
          type="text"
          placeholder="+2349012345678"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full p-3 mb-4 rounded bg-gray-700 text-white"
        />

        {!confirmationResult ? (
          <button
            id="sign-in-button"
            onClick={requestOtp}
            className="w-full bg-yellow-500 text-black py-2 rounded font-semibold"
          >
            Send OTP
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full p-3 mb-4 rounded bg-gray-700 text-white"
            />
            <button
              onClick={verifyOtp}
              className="w-full bg-green-500 text-black py-2 rounded font-semibold"
            >
              Verify OTP
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PhoneSignInPage;