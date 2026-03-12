// src/pages/SignUpPage.js
import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword, updateProfile,
  sendEmailVerification, signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import OfficialLogo from "../assets/Official-Logo.jpg";

/* ─── Password policy helpers ─── */
const MIN_LEN   = 10;
const COMMON_WEAK = new Set([
  "123456","1234567","12345678","123456789","1234567890",
  "password","password1","qwerty","qwerty123","111111",
  "000000","iloveyou","admin","welcome","letmein",
]);

function normalizePw(pw) { return String(pw || "").trim(); }

function getPwChecks(pwRaw, emailRaw = "", nameRaw = "") {
  const pw    = normalizePw(pwRaw);
  const email = String(emailRaw || "").trim().toLowerCase();
  const name  = String(nameRaw || "").trim().toLowerCase();

  const hasMin     = pw.length >= MIN_LEN;
  const hasUpper   = /[A-Z]/.test(pw);
  const hasLower   = /[a-z]/.test(pw);
  const hasNum     = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const pwLower    = pw.toLowerCase();

  const isCommon        = COMMON_WEAK.has(pwLower);
  const emailUser       = email.includes("@") ? email.split("@")[0] : "";
  const includesEmailU  = emailUser && pwLower.includes(emailUser);
  const includesEmailF  = email && pwLower.includes(email);
  const includesName    = name && name.length >= 3 && pwLower.includes(name.replace(/\s+/g, ""));
  const noPersonal      = !includesEmailU && !includesEmailF && !includesName;

  const ok = hasMin && hasUpper && hasLower && hasNum && hasSpecial && !isCommon && noPersonal;

  let firstFail = "";
  if (!hasMin)          firstFail = `Password must be at least ${MIN_LEN} characters.`;
  else if (!hasUpper)   firstFail = "Add at least 1 uppercase letter (A–Z).";
  else if (!hasLower)   firstFail = "Add at least 1 lowercase letter (a–z).";
  else if (!hasNum)     firstFail = "Add at least 1 number (0–9).";
  else if (!hasSpecial) firstFail = "Add at least 1 special character (e.g. !@#£$).";
  else if (isCommon)    firstFail = "Please choose a less predictable password.";
  else if (!noPersonal) firstFail = "Avoid using personal information in your password.";

  return { ok, hasMin, hasUpper, hasLower, hasNum, hasSpecial, firstFail };
}

function CheckLine({ status, label }) {
  const isOk = status === "ok";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{
        width:16, height:16, borderRadius:"50%", display:"inline-flex",
        alignItems:"center", justifyContent:"center",
        fontSize:10, fontWeight:700, flexShrink:0,
        border:`1px solid ${isOk ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.12)"}`,
        background: isOk ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.04)",
        color: isOk ? "#6ee7b7" : "rgba(255,255,255,0.3)",
      }}>
        {isOk ? "✓" : "•"}
      </span>
      <span style={{ fontSize:12, color: isOk ? "#6ee7b7" : "rgba(255,255,255,0.45)" }}>{label}</span>
    </div>
  );
}

function stripFirebasePrefix(msg) {
  return String(msg || "").replace(/^Firebase:\s*/i, "").trim();
}

const CORMORANT = "'Cormorant Garamond', Georgia, serif";

export default function SignUpPage() {
  const nav      = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    if (!from) return "/role-selection";
    if (typeof from === "string") return from;
    if (typeof from?.pathname === "string") return from.pathname;
    return "/role-selection";
  }, [location.state]);

  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [phone,           setPhone]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPw,       setConfirmPw]       = useState("");
  const [showPw,          setShowPw]          = useState(false);
  const [pwTouched,       setPwTouched]       = useState(false);
  const [agreed,          setAgreed]          = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const [sent,            setSent]            = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const pwChecks     = useMemo(() => getPwChecks(password, email, name), [password, email, name]);
  const pwMatchOk    = confirmPw === "" || password === confirmPw;
  const strengthScore = [pwChecks.hasMin, pwChecks.hasUpper, pwChecks.hasLower, pwChecks.hasNum, pwChecks.hasSpecial].filter(Boolean).length;
  const strengthLabel = strengthScore <= 2 ? "Weak" : strengthScore <= 3 ? "Fair" : strengthScore <= 4 ? "Good" : "Strong";
  const strengthColor = strengthScore <= 2 ? "#f87171" : strengthScore <= 3 ? "#fb923c" : strengthScore <= 4 ? "#facc15" : "#4ade80";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!agreed)               { setError("Please accept the terms to continue."); return; }
    if (!pwChecks.ok)          { setError(pwChecks.firstFail); return; }
    if (password !== confirmPw){ setError("Passwords don't match."); return; }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = name.trim();

    setSubmitting(true);
    try {
      // 1) Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = cred.user;
      const uid  = user.uid;

      // 2) Update display name
      await updateProfile(user, { displayName: cleanName });

      // FIX: force token refresh so request.auth is populated when
      // Firestore rules evaluate the write below. Without this,
      // the token may not be ready yet and isSelf(userId) fails.
      await user.getIdToken(true);

      // 3) Create Firestore user profile
      // This now succeeds because request.auth.uid === uid (isSelf check passes)
      await setDoc(doc(db, "users", uid), {
        uid,
        displayName: cleanName,
        email:       cleanEmail,
        phone:       phone.trim() || null,
        role:        "guest",
        createdAt:   serverTimestamp(),
        agreedToTerms:   true,
        agreedToTermsAt: serverTimestamp(),
      });

      // 4) Send verification email
      await sendEmailVerification(user);
      setRegisteredEmail(cleanEmail);
      setSent(true);

      // 5) Sign out — user must verify email before accessing the app
      try { await signOut(auth); } catch { /* non-critical */ }

    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please sign in.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/weak-password") {
        setError("Password too weak. Use at least 10 characters.");
      } else {
        setError(stripFirebasePrefix(err?.message) || "Sign-up failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Verification sent state ── */
  if (sent) {
    return (
      <main style={pageWrap}>
        <div style={{ width:"100%", maxWidth:460, margin:"0 auto", padding:"40px 16px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={logoWrap}>
              <img src={OfficialLogo} alt="NestaNg" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✉</div>
              <h1 style={{ fontFamily:CORMORANT, fontSize:28, fontWeight:600, color:"#f5f0e8", margin:"0 0 8px" }}>
                Check your inbox
              </h1>
              <p style={{ fontSize:14, fontWeight:300, color:"rgba(255,255,255,0.5)", lineHeight:1.65 }}>
                We sent a verification link to<br />
                <span style={{ color:"rgba(255,255,255,0.85)", fontWeight:500 }}>{registeredEmail}</span>.
              </p>
            </div>
            <div style={{
              borderRadius:14, border:"1px solid rgba(201,168,76,0.20)",
              background:"rgba(201,168,76,0.06)", padding:"14px 16px",
              fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.65, marginBottom:20,
            }}>
              Open the link in that email, then return here to sign in.
              If you don't see it, check your spam folder.
            </div>
            <Link to="/login" style={{ ...btnGoldLink, display:"block", textAlign:"center", textDecoration:"none" }}>
              Go to sign in →
            </Link>
          </div>
          <div style={{ textAlign:"center", marginTop:20 }}>
            <Link to="/" style={{ fontSize:13, color:"rgba(255,255,255,0.35)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
              ← Back to NestaNg
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        .su-input {
          width:100%; border-radius:14px; border:1px solid rgba(255,255,255,0.10);
          background:rgba(0,0,0,0.35); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:14px;
          padding:12px 16px; outline:none; transition:border-color 0.15s;
          box-sizing:border-box;
        }
        .su-input:focus { border-color:rgba(201,168,76,0.55); box-shadow:0 0 0 3px rgba(201,168,76,0.08); }
        .su-input::placeholder { color:rgba(255,255,255,0.30); }
        .su-btn-gold {
          width:100%; padding:13px; border-radius:14px; border:none; cursor:pointer;
          font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600;
          background:linear-gradient(135deg,#e8c96b,#c9a84c); color:#120d02;
          box-shadow:0 6px 20px rgba(201,168,76,0.3);
          transition:filter 0.15s, transform 0.1s;
        }
        .su-btn-gold:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); }
        .su-btn-gold:disabled { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); box-shadow:none; cursor:not-allowed; }
        .su-check { width:16px; height:16px; accent-color:#c9a84c; cursor:pointer; flex-shrink:0; }
      `}</style>

      <main style={pageWrap}>
        <div style={{ width:"100%", maxWidth:480, margin:"0 auto", padding:"32px 16px 48px" }}>

          {/* Logo + heading */}
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={logoWrap}>
              <img src={OfficialLogo} alt="NestaNg" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
            <h1 style={{ fontFamily:CORMORANT, fontSize:30, fontWeight:600, color:"#f5f0e8", margin:"0 0 6px" }}>
              Create your account
            </h1>
            <p style={{ fontSize:14, fontWeight:300, color:"rgba(255,255,255,0.45)" }}>
              Join Nigeria's premium short-let marketplace
            </p>
          </div>

          {/* Card */}
          <div style={cardStyle}>
            {error && (
              <div style={{
                borderRadius:12, border:"1px solid rgba(239,68,68,0.3)",
                background:"rgba(239,68,68,0.08)", padding:"10px 14px",
                fontSize:13, color:"#fca5a5", marginBottom:16,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display:"grid", gap:14 }}>

              {/* Full name */}
              <label style={{ display:"grid", gap:6 }}>
                <span style={labelStyle}>Full name</span>
                <input className="su-input" type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name" autoComplete="name" required />
              </label>

              {/* Email */}
              <label style={{ display:"grid", gap:6 }}>
                <span style={labelStyle}>Email</span>
                <input className="su-input" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" required />
              </label>

              {/* Phone */}
              <label style={{ display:"grid", gap:6 }}>
                <span style={labelStyle}>
                  Phone <span style={{ color:"rgba(255,255,255,0.25)", fontWeight:300 }}>(optional)</span>
                </span>
                <input className="su-input" type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000" autoComplete="tel" />
              </label>

              {/* Password */}
              <div style={{ display:"grid", gap:6 }}>
                <span style={labelStyle}>Password</span>
                <div style={{ position:"relative" }}>
                  <input
                    className="su-input" style={{ paddingRight:72 }}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (!pwTouched) setPwTouched(true); }}
                    placeholder="At least 10 characters"
                    autoComplete="new-password" required
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    style={{
                      position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                      fontSize:11, padding:"4px 10px", borderRadius:8, cursor:"pointer",
                      border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.06)",
                      color:"rgba(255,255,255,0.6)",
                    }}
                    aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>

                {/* Strength bar */}
                {pwTouched && password && (
                  <div>
                    <div style={{ height:3, borderRadius:999, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
                      <div style={{
                        height:"100%", width:`${(strengthScore/5)*100}%`,
                        background:strengthColor, borderRadius:999,
                        transition:"width 0.3s, background 0.3s",
                      }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>Strength</span>
                      <span style={{ fontSize:11, color:strengthColor, fontWeight:600 }}>{strengthLabel}</span>
                    </div>
                  </div>
                )}

                {/* Requirements checklist */}
                {pwTouched && (
                  <div style={{
                    borderRadius:14, border:"1px solid rgba(255,255,255,0.07)",
                    background:"rgba(255,255,255,0.03)", padding:"12px 14px",
                    display:"grid", gap:7,
                  }}>
                    <CheckLine status={pwChecks.hasMin     ? "ok":"idle"} label={`At least ${MIN_LEN} characters`} />
                    <CheckLine status={pwChecks.hasUpper   ? "ok":"idle"} label="One uppercase letter (A–Z)" />
                    <CheckLine status={pwChecks.hasLower   ? "ok":"idle"} label="One lowercase letter (a–z)" />
                    <CheckLine status={pwChecks.hasNum     ? "ok":"idle"} label="One number (0–9)" />
                    <CheckLine status={pwChecks.hasSpecial ? "ok":"idle"} label="One special character (!@#£$)" />
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div style={{ display:"grid", gap:6 }}>
                <span style={labelStyle}>Confirm password</span>
                <input
                  className="su-input"
                  style={{ borderColor: !pwMatchOk && confirmPw ? "rgba(239,68,68,0.45)" : undefined }}
                  type={showPw ? "text" : "password"}
                  value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat password" autoComplete="new-password" required
                />
                {!pwMatchOk && confirmPw && (
                  <span style={{ fontSize:12, color:"#fca5a5" }}>Passwords don't match</span>
                )}
              </div>

              {/* Terms */}
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer" }}>
                <input type="checkbox" className="su-check" checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)} required />
                <span style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.65, marginTop:1 }}>
                  I agree to NestaNg's{" "}
                  <Link to="/terms" target="_blank" style={{ color:"#c9a84c", textDecoration:"none", borderBottom:"1px solid rgba(201,168,76,0.3)" }}>
                    Terms of Use
                  </Link>{" "}and{" "}
                  <Link to="/privacy" target="_blank" style={{ color:"#c9a84c", textDecoration:"none", borderBottom:"1px solid rgba(201,168,76,0.3)" }}>
                    Privacy Policy
                  </Link>.
                </span>
              </label>

              <button type="submit" className="su-btn-gold" disabled={submitting}>
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            {/* Sign in link */}
            <div style={{ marginTop:20, textAlign:"center", fontSize:13 }}>
              <span style={{ color:"rgba(255,255,255,0.4)" }}>Already have an account? </span>
              <Link to="/login" style={{ color:"#c9a84c", textDecoration:"none", borderBottom:"1px solid rgba(201,168,76,0.3)" }}>
                Sign in
              </Link>
            </div>
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

/* ─── Shared styles ─── */
const pageWrap = {
  minHeight:"100vh",
  background:"radial-gradient(1400px 700px at 50% 0%, rgba(201,168,76,0.05), transparent 55%), #05070a",
  color:"#fff",
  fontFamily:"'DM Sans', system-ui, sans-serif",
  display:"flex", alignItems:"flex-start", justifyContent:"center",
};
const logoWrap = {
  width:56, height:56, borderRadius:18, overflow:"hidden",
  border:"1px solid rgba(255,255,255,0.10)", margin:"0 auto 16px",
  background:"rgba(255,255,255,0.04)",
};
const cardStyle = {
  borderRadius:24, border:"1px solid rgba(255,255,255,0.09)",
  background:"linear-gradient(160deg,rgba(14,18,28,0.96),rgba(8,11,18,0.92))",
  padding:"26px 26px 22px",
  boxShadow:"0 32px 80px rgba(0,0,0,0.65)",
};
const labelStyle = { fontSize:12, color:"rgba(255,255,255,0.5)", letterSpacing:"0.03em" };
const btnGoldLink = {
  padding:"13px", borderRadius:14,
  background:"linear-gradient(135deg,#e8c96b,#c9a84c)", color:"#120d02",
  fontWeight:600, fontSize:14,
  boxShadow:"0 6px 20px rgba(201,168,76,0.3)",
};