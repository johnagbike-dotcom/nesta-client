// src/auth/MfaVerifyPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function MfaVerifyPage() {
  const {
    mfaRequired,
    mfaHints,
    mfaError,
    mfaPending,
    sendMfaCode,
    verifyMfa,
    clearMfaState,
  } = useAuth();

  const nav = useNavigate();
  const location = useLocation();

  const redirectTo =
    location.state?.redirectTo ||
    location.state?.from?.pathname ||
    "/role-selection";

  const [code, setCode] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [sent, setSent] = useState(false);

  const masked = useMemo(() => {
    const h = mfaHints?.[0];
    const p = h?.phoneNumber || "";
    return p ? p : "your phone";
  }, [mfaHints]);

  // If user landed here without an active MFA challenge, bounce back to login
  useEffect(() => {
    if (mfaRequired === false) return;
    // send code once
    if (sent) return;

    (async () => {
      const res = await sendMfaCode({ recaptchaContainerId: "mfa-recaptcha" });
      if (res?.ok) setSent(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaRequired]);

  useEffect(() => {
    // If there's no MFA challenge active, don't let them stay here.
    if (mfaRequired === false) {
      nav("/login", { replace: true });
    }
  }, [mfaRequired, nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalErr("");
    const v = String(code || "").trim();
    if (v.length < 4) return setLocalErr("Enter the code sent to your phone.");

    const res = await verifyMfa(v);
    if (res?.ok) {
      nav(redirectTo, { replace: true });
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white grid place-items-center px-4">
      {/* Invisible reCAPTCHA mount point */}
      <div id="mfa-recaptcha" />

      <div className="w-full max-w-md p-7 rounded-2xl bg-white/5 border border-amber-400/30 backdrop-blur">
        <h1 className="text-2xl font-extrabold text-amber-300">Security check</h1>
        <p className="text-gray-300 mt-1">
          Enter the verification code sent to <span className="text-gray-100">{masked}</span>.
        </p>

        {(localErr || mfaError) && (
          <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-red-200">
            {localErr || mfaError}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-sm text-gray-300 mb-1">Verification code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-yellow-400"
            />
          </label>

          <button
            type="submit"
            disabled={mfaPending || !code.trim()}
            className="w-full py-3 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60"
          >
            {mfaPending ? "Verifying…" : "Verify & continue"}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
            <button
              type="button"
              onClick={async () => {
                setLocalErr("");
                await sendMfaCode({ recaptchaContainerId: "mfa-recaptcha" });
              }}
              className="underline"
              disabled={mfaPending}
            >
              Resend code
            </button>

            <button
              type="button"
              onClick={() => {
                clearMfaState();
                nav("/login", { replace: true });
              }}
              className="underline"
            >
              Use another account
            </button>
          </div>
        </form>

        <div className="mt-5 text-center text-xs text-gray-500">
          Need help? <Link to="/help" className="underline">Visit support</Link>
        </div>
      </div>
    </main>
  );
}
