// src/pages/SignUpPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import OfficialLogo from "../assets/Official-Logo.jpg";

/* ---------------- Password policy helpers ---------------- */

const MIN_LEN = 10;

const COMMON_WEAK = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty",
  "qwerty123",
  "111111",
  "000000",
  "iloveyou",
  "admin",
  "welcome",
  "letmein",
]);

function normalizePw(pw) {
  return String(pw || "").trim();
}

function getPwChecks(pwRaw, emailRaw = "", nameRaw = "") {
  const pw = normalizePw(pwRaw);
  const email = String(emailRaw || "").trim().toLowerCase();
  const name = String(nameRaw || "").trim().toLowerCase();

  const hasMin = pw.length >= MIN_LEN;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);

  const pwLower = pw.toLowerCase();
  const isCommon = COMMON_WEAK.has(pwLower);

  const emailUser = email.includes("@") ? email.split("@")[0] : "";
  const includesEmailUser = emailUser && pwLower.includes(emailUser);
  const includesEmailFull = email && pwLower.includes(email);
  const includesName =
    name && name.length >= 3 && pwLower.includes(name.replace(/\s+/g, ""));

  const noPersonal = !includesEmailUser && !includesEmailFull && !includesName;

  const ok =
    hasMin &&
    hasUpper &&
    hasLower &&
    hasNum &&
    hasSpecial &&
    !isCommon &&
    noPersonal;

  let firstFail = "";
  if (!hasMin) firstFail = `Password must be at least ${MIN_LEN} characters.`;
  else if (!hasUpper) firstFail = "Add at least 1 uppercase letter (A–Z).";
  else if (!hasLower) firstFail = "Add at least 1 lowercase letter (a–z).";
  else if (!hasNum) firstFail = "Add at least 1 number (0–9).";
  else if (!hasSpecial) firstFail = "Add at least 1 special character (e.g. !@#£$).";
  else if (isCommon) firstFail = "Please choose a less predictable password.";
  else if (!noPersonal) firstFail = "Avoid using personal information in your password.";

  return { ok, hasMin, hasUpper, hasLower, hasNum, hasSpecial, firstFail };
}

function CheckLine({ status, label }) {
  const isOk = status === "ok";
  const isIdle = status === "idle";

  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        className={[
          "inline-flex h-4 w-4 items-center justify-center rounded-full border",
          isOk
            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
            : "border-white/15 bg-white/5 text-white/40",
        ].join(" ")}
      >
        {isOk ? "✓" : "•"}
      </span>
      <span className={isOk ? "text-emerald-200" : isIdle ? "text-white/55" : "text-white/55"}>
        {label}
      </span>
    </div>
  );
}

function stripFirebasePrefix(msg) {
  return String(msg || "").replace(/^Firebase:\s*/i, "").trim();
}

/* ---------------- Page ---------------- */

export default function SignUpPage() {
  const nav = useNavigate();
  const { state } = useLocation(); // optional { next: "/dashboard" }

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [stage, setStage] = useState("form"); // form | success
  const [okMsg, setOkMsg] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const pwStarted = normalizePw(pw).length > 0;

  const cooldownTimerRef = useRef(null);
  const nextAfterRole = useMemo(() => state?.next || "/dashboard", [state]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  async function ensureUserProfile(uid, emailVal, displayName, emailVerified = false) {
    const userRef = doc(db, "users", uid);
    const pubRef = doc(db, "users_public", uid);

    const snap = await getDoc(userRef);
    const now = serverTimestamp();

    const emailLower = String(emailVal || "").trim().toLowerCase();

    if (!snap.exists()) {
      // Create (private)
      await setDoc(
        userRef,
        {
          email: String(emailVal || "").trim(),
          emailLower,
          displayName: displayName || null,
          role: "guest",
          isAdmin: false,
          plan: "free",
          emailVerified: !!emailVerified,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      // Create (public)
      await setDoc(
        pubRef,
        {
          displayName: displayName || "User",
          email: String(emailVal || "").trim(), // optional; remove if you want stricter privacy
          role: "guest",
          photoURL: null,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      // Update only what matters (don’t overwrite createdAt)
      await setDoc(
        userRef,
        {
          email: String(emailVal || "").trim(),
          emailLower,
          displayName: displayName || null,
          emailVerified: !!emailVerified,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        pubRef,
        {
          displayName: displayName || "User",
          updatedAt: now,
        },
        { merge: true }
      );
    }
  }

  function humanizeFirebaseError(e) {
    const code = e?.code || "";
    if (code === "auth/email-already-in-use") return "That email is already in use.";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/weak-password") return "Password is too weak. Please use a stronger password.";
    if (code === "auth/network-request-failed")
      return "Network error. Please check your internet connection and try again.";
    if (code === "auth/too-many-requests")
      return "Too many attempts. Please wait a moment and try again.";
    return stripFirebasePrefix(e?.message) || "Could not create your account.";
  }

  const pwChecks = useMemo(() => getPwChecks(pw, email, name), [pw, email, name]);
  const confirmOk = pw2.length > 0 && pw === pw2;

  const canSubmit = useMemo(() => {
    const cleanEmail = email.trim();
    return (
      !loading &&
      cleanEmail.length > 3 &&
      cleanEmail.includes("@") &&
      pwChecks.ok &&
      confirmOk
    );
  }, [email, pwChecks.ok, confirmOk, loading]);

  function startCooldown(seconds = 30) {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCooldown(seconds);

    cooldownTimerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function sendVerificationForCurrentUser() {
    const u = auth.currentUser;
    if (!u) throw new Error("no_current_user");

    const actionCodeSettings = {
      url: `${window.location.origin}/action`,
      handleCodeInApp: false,
    };

    await sendEmailVerification(u, actionCodeSettings);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    const cleanEmail = email.trim();
    const emailLower = cleanEmail.toLowerCase();

    if (!cleanEmail) return setErr("Please enter an email address.");
    if (!pw) return setErr("Please enter a password.");
    if (!pwChecks.ok) return setErr(pwChecks.firstFail || "Please choose a stronger password.");
    if (pw !== pw2) return setErr("Passwords do not match.");

    try {
      setLoading(true);

      // Use lowercased email to avoid duplicate-case accounts in your own DB.
      // Firebase treats emails case-insensitively anyway.
      const cred = await createUserWithEmailAndPassword(auth, emailLower, pw);

      const displayName = (name.trim() || emailLower.split("@")[0]).slice(0, 60);

      try {
        await updateProfile(cred.user, { displayName });
      } catch {}

      await ensureUserProfile(
        cred.user.uid,
        cred.user.email || emailLower,
        displayName,
        cred.user.emailVerified
      );

      try {
        await sendVerificationForCurrentUser();
      } catch (ve) {
        console.warn("[SignUpPage] sendEmailVerification failed:", ve);
      }

      setSuccessEmail(emailLower);
      setOkMsg("Account created. Please verify your email to continue.");
      setStage("success");
      startCooldown(30);
    } catch (e2) {
      console.error(e2);
      setErr(humanizeFirebaseError(e2));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setErr("");
    setOkMsg("");
    if (cooldown > 0) return;

    try {
      setResendBusy(true);
      await sendVerificationForCurrentUser();
      setOkMsg("Verification email sent again. Please check inbox/spam.");
      startCooldown(30);
    } catch (e) {
      console.error(e);
      const msg = e?.message === "no_current_user"
        ? "Please continue to login, then resend verification from there."
        : stripFirebasePrefix(e?.message) || "Could not resend verification email.";
      setErr(msg);
    } finally {
      setResendBusy(false);
    }
  }

  async function goToLogin() {
    try {
      await signOut(auth);
    } catch {}

    nav("/login", {
      replace: true,
      state: {
        info: "Please verify your email (check inbox/spam). After verifying, come back and sign in.",
        next: nextAfterRole,
      },
    });
  }

  // ✅ Success screen
  if (stage === "success") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#070b12] to-[#05070d] text-white px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center overflow-hidden">
              <img src={OfficialLogo} alt="Nesta" className="h-full w-full object-cover" />
            </div>
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{
                fontFamily:
                  'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
              }}
            >
              Verify your email
            </h1>
            <p className="text-sm text-white/60 mt-2">
              We’ve sent a verification link to{" "}
              <span className="text-white/80 font-semibold">{successEmail}</span>.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
            {err && (
              <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100 text-sm">
                {err}
              </div>
            )}

            {okMsg && (
              <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-emerald-100 text-sm">
                {okMsg}
              </div>
            )}

            <div className="text-sm text-white/70 leading-relaxed">
              Open your email, click <span className="text-white/90 font-semibold">Verify</span>, then return to sign in.
              <div className="mt-2 text-xs text-white/55">Tip: Check spam/junk.</div>
            </div>

            <button
              type="button"
              onClick={onResend}
              disabled={resendBusy || cooldown > 0}
              className={`mt-5 w-full py-3 rounded-2xl font-semibold transition ${
                resendBusy || cooldown > 0
                  ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                  : "bg-white/5 border border-white/15 hover:bg-white/10 text-white"
              }`}
            >
              {resendBusy
                ? "Resending…"
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend verification email"}
            </button>

            <button
              type="button"
              onClick={goToLogin}
              className="mt-3 w-full py-3 rounded-2xl font-semibold transition bg-gradient-to-b from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-500 shadow-[0_18px_50px_rgba(0,0,0,.55)]"
            >
              Continue to login
            </button>

            <div className="mt-4 text-center text-xs text-white/55">
              Used the wrong email?{" "}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut(auth);
                  } catch {}
                  setStage("form");
                  setOkMsg("");
                  setErr("");
                  setPw("");
                  setPw2("");
                }}
                className="underline decoration-dotted hover:text-amber-200"
              >
                Create again
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-white/50">
            <Link to="/" className="underline decoration-dotted hover:text-amber-200">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ✅ Form stage
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#070b12] to-[#05070d] text-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center overflow-hidden">
            <img src={OfficialLogo} alt="Nesta" className="h-full w-full object-cover" />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{
              fontFamily:
                'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
            }}
          >
            Create your Nesta account
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Join Nigeria’s home of luxury stays — trusted, verified, and secure.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,.7)]"
        >
          {err && (
            <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100 text-sm">
              {err}
            </div>
          )}

          <label className="block mb-4">
            <span className="block text-sm text-white/70 mb-1">Full name (optional)</span>
            <input
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-sm text-white/70 mb-1">Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
            />
          </label>

          <label className="block mb-2">
            <span className="block text-sm text-white/70 mb-1">Password</span>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Create a strong password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 pr-12 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/55 mb-2">
                Password requirements
              </div>

              <div className="grid gap-1">
                <CheckLine status={!pwStarted ? "idle" : pwChecks.hasMin ? "ok" : "bad"} label={`At least ${MIN_LEN} characters`} />
                <CheckLine status={!pwStarted ? "idle" : pwChecks.hasUpper ? "ok" : "bad"} label="1 uppercase letter" />
                <CheckLine status={!pwStarted ? "idle" : pwChecks.hasLower ? "ok" : "bad"} label="1 lowercase letter" />
                <CheckLine status={!pwStarted ? "idle" : pwChecks.hasNum ? "ok" : "bad"} label="1 number" />
                <CheckLine status={!pwStarted ? "idle" : pwChecks.hasSpecial ? "ok" : "bad"} label="1 special character" />
              </div>
            </div>
          </label>

          <label className="block mb-5 mt-4">
            <span className="block text-sm text-white/70 mb-1">Confirm password</span>
            <div className="relative">
              <input
                type={showPw2 ? "text" : "password"}
                placeholder="Re-enter password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 pr-12 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPw2((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
              >
                {showPw2 ? "Hide" : "Show"}
              </button>
            </div>

            {pw2.length > 0 && (
              <div className={["mt-2 text-xs", confirmOk ? "text-emerald-200" : "text-rose-200"].join(" ")}>
                {confirmOk ? "✓ Passwords match" : "Passwords do not match"}
              </div>
            )}
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 rounded-2xl font-semibold transition shadow-[0_18px_50px_rgba(0,0,0,.55)] ${
              !canSubmit
                ? "bg-white/10 border border-white/10 text-white/40 cursor-not-allowed"
                : "bg-gradient-to-b from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-500"
            }`}
          >
            {loading ? "Creating…" : "Sign up"}
          </button>

          <p className="mt-4 text-center text-sm text-white/60">
            Already have an account?{" "}
            <Link to="/login" className="underline decoration-dotted hover:text-amber-200">
              Sign in
            </Link>
          </p>

          <p className="mt-2 text-center text-[11px] text-white/45 leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="underline decoration-dotted hover:text-amber-200">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline decoration-dotted hover:text-amber-200">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <div className="mt-5 text-center text-xs text-white/50">
          <Link to="/" className="underline decoration-dotted hover:text-amber-200">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
