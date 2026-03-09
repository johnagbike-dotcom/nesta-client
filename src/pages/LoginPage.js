// src/pages/LoginPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../firebase";
import OfficialLogo from "../assets/Official-Logo.jpg";

/* ─── Helpers (unchanged — all logic preserved) ─── */
function safeRedirectFromState(state) {
  const from = state?.from;
  if (!from) return null;
  if (typeof from === "string") return from;
  if (typeof from?.pathname === "string") return from.pathname;
  return null;
}

function stripFirebasePrefix(msg) {
  return String(msg || "").replace(/^Firebase:\s*/i, "").trim();
}

function humanizeAuthError(e) {
  const code = e?.code || "";
  const msg  = stripFirebasePrefix(e?.message || "");
  if (code === "auth/wrong-password")         return "Incorrect password.";
  if (code === "auth/user-not-found")         return "No account found with that email.";
  if (code === "auth/invalid-email")          return "Please enter a valid email address.";
  if (code === "auth/too-many-requests")      return "Too many attempts. Please wait and try again.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  return msg || "Login failed";
}

async function refreshVerifiedStateWithRetry(user, { retries = 6, delayMs = 450 } = {}) {
  if (!user) return null;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < retries; i++) {
    try { await user.reload(); } catch {}
    if (user.emailVerified) return user;
    try { await user.getIdToken(true); } catch {}
    try { await user.reload(); } catch {}
    if (user.emailVerified) return user;
    await wait(delayMs);
  }
  return user;
}

const CORMORANT = "'Cormorant Garamond', Georgia, serif";

export default function LoginPage() {
  const { beginLogin, loginWithGoogle, loading, authError } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const [needsVerify,          setNeedsVerify]          = useState(false);
  const [verifyEmailToResend,  setVerifyEmailToResend]  = useState("");
  const [resendBusy,           setResendBusy]           = useState(false);
  const [refreshBusy,          setRefreshBusy]          = useState(false);
  const [infoMsg,              setInfoMsg]              = useState("");

  const nav      = useNavigate();
  const location = useLocation();
  const incomingInfo = location.state?.info || "";

  const redirectTo = useMemo(() => {
    const from = safeRedirectFromState(location.state);
    return from || "/role-selection";
  }, [location.state]);

  useEffect(() => {
    if (incomingInfo) setInfoMsg(String(incomingInfo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disabled = submitting || loading;

  const runVerifiedGate = async (signedInUser, cleanEmail) => {
    if (!signedInUser) return { ok: false, reason: "no-user" };
    const fresh = await refreshVerifiedStateWithRetry(signedInUser);
    const providerIds    = (fresh?.providerData || []).map((p) => p?.providerId).filter(Boolean);
    const isPasswordUser = providerIds.includes("password") || providerIds.length === 0;
    if (isPasswordUser && fresh?.emailVerified === false) {
      setNeedsVerify(true);
      setVerifyEmailToResend(cleanEmail);
      setError("Your email is not verified yet. Please check your inbox (and spam) for the verification link, then sign in again.");
      try { await signOut(auth); } catch {}
      return { ok: false, reason: "not-verified" };
    }
    return { ok: true };
  };

  const resetMessages = () => {
    setError(""); setInfoMsg(""); setNeedsVerify(false); setVerifyEmailToResend("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    const cleanEmail = email.trim().toLowerCase();
    try {
      setSubmitting(true);
      const res = await beginLogin(cleanEmail, password);
      if (res?.mfaRequired) { nav("/mfa", { replace:true, state:{ redirectTo } }); return; }
      const gate = await runVerifiedGate(res?.user, cleanEmail);
      if (!gate.ok) return;
      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err); setError(humanizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    resetMessages();
    try {
      setSubmitting(true);
      await loginWithGoogle();
      nav(redirectTo, { replace: true });
    } catch (err) {
      console.error(err); setError(stripFirebasePrefix(err?.message) || "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    setError(""); setInfoMsg("");
    const cleanEmail = verifyEmailToResend || email.trim().toLowerCase();
    if (!cleanEmail || !password) { setError("Enter your email and password, then tap Resend verification."); return; }
    try {
      setResendBusy(true);
      const res = await beginLogin(cleanEmail, password);
      if (res?.mfaRequired) { setError("This account has MFA enabled. Please finish sign-in first."); return; }
      const fresh = await refreshVerifiedStateWithRetry(res?.user, { retries:3, delayMs:250 });
      if (fresh?.emailVerified) {
        setInfoMsg("✓ Your email is already verified. Please sign in.");
        setNeedsVerify(false);
        try { await signOut(auth); } catch {}
        return;
      }
      await sendEmailVerification(res?.user);
      setInfoMsg("✓ Verification email sent. Please check inbox/spam.");
      try { await signOut(auth); } catch {}
    } catch (e) {
      console.error(e); setError(stripFirebasePrefix(e?.message) || "Could not resend verification email.");
    } finally {
      setResendBusy(false);
    }
  };

  const refreshVerificationStatus = async () => {
    setError(""); setInfoMsg("");
    const cleanEmail = verifyEmailToResend || email.trim().toLowerCase();
    if (!cleanEmail || !password) { setError("Enter your email and password, then tap Refresh status."); return; }
    try {
      setRefreshBusy(true);
      const res = await beginLogin(cleanEmail, password);
      if (res?.mfaRequired) { setError("This account has MFA enabled. Please finish sign-in first."); return; }
      const gate = await runVerifiedGate(res?.user, cleanEmail);
      if (!gate.ok) return;
      setInfoMsg("✓ Verification detected. You can now sign in.");
      try { await signOut(auth); } catch {}
    } catch (e) {
      console.error(e); setError(stripFirebasePrefix(e?.message) || "Could not refresh status.");
      try { await signOut(auth); } catch {}
    } finally {
      setRefreshBusy(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .lp-input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.35);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          padding: 12px 16px;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .lp-input:focus { border-color: rgba(201,168,76,0.55); box-shadow: 0 0 0 3px rgba(201,168,76,0.08); }
        .lp-input::placeholder { color: rgba(255,255,255,0.30); }
        .lp-btn-gold {
          width:100%; padding:13px; border-radius:14px; border:none; cursor:pointer;
          font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600;
          background: linear-gradient(135deg,#e8c96b,#c9a84c);
          color: #120d02;
          box-shadow: 0 6px 20px rgba(201,168,76,0.3);
          transition: filter 0.15s, transform 0.1s;
        }
        .lp-btn-gold:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); }
        .lp-btn-gold:disabled { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); box-shadow:none; cursor:not-allowed; }
        .lp-btn-ghost {
          width:100%; padding:12px; border-radius:14px; cursor:pointer;
          font-family:'DM Sans',sans-serif; font-size:14px; font-weight:400;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.80);
          transition: background 0.15s, border-color 0.15s;
        }
        .lp-btn-ghost:hover:not(:disabled) { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.22); }
        .lp-btn-ghost:disabled { opacity:0.4; cursor:not-allowed; }
        .lp-btn-sm {
          padding:8px 14px; border-radius:12px; cursor:pointer; font-size:13px; font-weight:500;
          font-family:'DM Sans',sans-serif;
          border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.75);
          transition:background 0.15s;
        }
        .lp-btn-sm:hover:not(:disabled) { background:rgba(255,255,255,0.09); }
        .lp-btn-sm:disabled { opacity:0.4; cursor:not-allowed; }
      `}</style>

      <main style={{
        minHeight: "100vh",
        background: "radial-gradient(1400px 700px at 60% 0%, rgba(201,168,76,0.05), transparent 55%), #05070a",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#fff",
      }}>
        <div style={{ width: "100%", maxWidth: 440 }}>

          {/* Logo + heading */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width:56, height:56, borderRadius:18, overflow:"hidden",
              border:"1px solid rgba(255,255,255,0.10)", margin:"0 auto 16px",
              background:"rgba(255,255,255,0.04)",
            }}>
              <img src={OfficialLogo} alt="NestaNg" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
            <h1 style={{ fontFamily:CORMORANT, fontSize:32, fontWeight:600, color:"#f5f0e8", margin:"0 0 6px" }}>
              Welcome back
            </h1>
            <p style={{ fontSize:14, fontWeight:300, color:"rgba(255,255,255,0.45)" }}>
              Sign in to your NestaNg account
            </p>
          </div>

          {/* Card */}
          <div style={{
            borderRadius:24, border:"1px solid rgba(255,255,255,0.09)",
            background:"linear-gradient(160deg,rgba(14,18,28,0.96),rgba(8,11,18,0.92))",
            padding:"28px 28px 24px",
            boxShadow:"0 32px 80px rgba(0,0,0,0.65)",
          }}>

            {/* Info message */}
            {infoMsg && (
              <div style={{ borderRadius:12, border:"1px solid rgba(52,211,153,0.3)", background:"rgba(52,211,153,0.08)", padding:"10px 14px", fontSize:13, color:"#6ee7b7", marginBottom:16 }}>
                {infoMsg}
              </div>
            )}

            {/* Error message */}
            {(error || authError) && (
              <div style={{ borderRadius:12, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", padding:"10px 14px", fontSize:13, color:"#fca5a5", marginBottom:16 }}>
                {error || authError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} style={{ display:"grid", gap:14 }}>
              <label style={{ display:"grid", gap:6 }}>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)", letterSpacing:"0.03em" }}>Email</span>
                <input
                  type="email" className="lp-input"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" required
                />
              </label>

              <label style={{ display:"grid", gap:6 }}>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)", letterSpacing:"0.03em" }}>Password</span>
                <div style={{ position:"relative" }}>
                  <input
                    type={showPw ? "text" : "password"} className="lp-input"
                    style={{ paddingRight:72 }}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" required
                  />
                  <button
                    type="button" onClick={() => setShowPw((v) => !v)}
                    style={{
                      position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                      fontSize:11, padding:"4px 10px", borderRadius:8, cursor:"pointer",
                      border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.06)",
                      color:"rgba(255,255,255,0.6)",
                    }}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" className="lp-btn-gold" disabled={disabled}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Email verification panel */}
            {needsVerify && (
              <div style={{ marginTop:16, borderRadius:16, border:"1px solid rgba(201,168,76,0.25)", background:"rgba(201,168,76,0.06)", padding:"16px" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#c9a84c", marginBottom:4 }}>Email verification required</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", lineHeight:1.6, marginBottom:12 }}>
                  Can't find the link? Resend it below. Already verified? Refresh your status.
                </div>
                <div style={{ display:"grid", gap:8 }}>
                  <button className="lp-btn-ghost" onClick={resendVerification} disabled={resendBusy || disabled}>
                    {resendBusy ? "Resending…" : "Resend verification email"}
                  </button>
                  <button className="lp-btn-ghost" onClick={refreshVerificationStatus} disabled={refreshBusy || disabled}>
                    {refreshBusy ? "Refreshing…" : "Refresh verification status"}
                  </button>
                </div>
                <div style={{ marginTop:10, fontSize:11, color:"rgba(255,255,255,0.35)", lineHeight:1.6 }}>
                  Tip: Gmail may open the link in an in-app browser. After verifying, come back and tap Refresh status.
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"18px 0" }}>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>or</span>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
            </div>

            {/* Google */}
            <button className="lp-btn-ghost" onClick={onGoogle} disabled={disabled}>
              Continue with Google
            </button>

            {/* Footer links */}
            <div style={{ marginTop:20, display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <Link to="/reset"  style={{ color:"rgba(255,255,255,0.5)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.15)" }}>Forgot password?</Link>
              <Link to="/signup" style={{ color:"rgba(255,255,255,0.5)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.15)" }}>Create account</Link>
            </div>

            {/* Security note */}
            <p style={{ marginTop:18, fontSize:11, color:"rgba(255,255,255,0.25)", lineHeight:1.6, textAlign:"center" }}>
              Contact details are hidden by policy and only revealed when your booking status permits.
            </p>
          </div>

          {/* Back link */}
          <div style={{ textAlign:"center", marginTop:20 }}>
            <Link to="/" style={{ fontSize:13, color:"rgba(255,255,255,0.35)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
              ← Back to NestaNg
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}