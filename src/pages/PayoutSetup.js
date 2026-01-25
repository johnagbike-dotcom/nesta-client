// src/pages/PayoutSetup.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const nf = new Intl.NumberFormat("en-NG");
const ngn = (n) => `₦${nf.format(Math.round(Number(n || 0)))}`;

function maskBVN(v) {
  const s = String(v || "").replace(/\D/g, "");
  if (s.length <= 4) return s;
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeBankName(v) {
  return String(v || "").trim().replace(/\s+/g, " ");
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function Pill({ tone = "amber", children }) {
  const cls =
    tone === "amber"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
      : tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function FieldShell({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</label>
        {hint ? <span className="text-[11px] text-white/40">{hint}</span> : null}
      </div>
      <div className="rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white/90 focus-within:border-amber-400/70 transition-colors">
        {children}
      </div>
    </div>
  );
}

export default function PayoutSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  // KYC status
  const kycStatusRaw = profile?.kycStatus || profile?.kyc?.status || profile?.kyc?.state || "";
  const kycStatus = String(kycStatusRaw).toLowerCase();
  const isKycApproved = ["approved", "verified", "complete"].includes(kycStatus);

  // Wallet (optional: helps show “withdrawable” context)
  const [wallet, setWallet] = useState({ loading: true, availableN: 0, pendingN: 0 });

  // payout fields
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bvn, setBvn] = useState("");

  // display-only (optional)
  const [accountName, setAccountName] = useState("");

  // loading/saving
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // whether payout exists
  const [existing, setExisting] = useState({
    hasPayout: false,
    lastUpdatedAt: null,
    bvnMasked: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        setErr("");
        setOk("");

        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.exists() ? snap.data() || {} : {};

        // wallet (best-effort)
        const availableN = Number(d.walletAvailableN ?? d.availableBalanceN ?? d.availableN ?? d.wallet?.availableN ?? 0);
        const pendingN = Number(d.walletPendingN ?? d.pendingBalanceN ?? d.pendingN ?? d.wallet?.pendingN ?? 0);

        const payout = d.payout || d.payoutSetup || d.withdrawal || {};

        const loadedBankName = normalizeBankName(payout.bankName || "");
        const loadedAccNo = onlyDigits(payout.accountNumber || "");
        const loadedBvn = onlyDigits(payout.bvn || "");

        const loadedAccName = String(payout.accountName || "");

        const hasPayout = !!loadedBankName && loadedAccNo.length >= 10 && loadedBvn.length >= 11;

        if (!alive) return;

        setWallet({
          loading: false,
          availableN: Number.isFinite(availableN) ? availableN : 0,
          pendingN: Number.isFinite(pendingN) ? pendingN : 0,
        });

        setBankName(loadedBankName);
        setAccountNumber(loadedAccNo);
        setBvn(loadedBvn);
        setAccountName(loadedAccName);

        setExisting({
          hasPayout,
          lastUpdatedAt: payout.updatedAt?.toDate?.() || payout.updatedAt || null,
          bvnMasked: maskBVN(loadedBvn),
        });
      } catch (e) {
        console.error("PayoutSetup load error:", e);
        if (alive) setErr("Could not load payout setup. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const walletAvailable = Number(wallet.availableN || 0);
  const walletPending = Number(wallet.pendingN || 0);

  const validations = useMemo(() => {
    const bn = normalizeBankName(bankName);
    const acc = onlyDigits(accountNumber);
    const bv = onlyDigits(bvn);

    const problems = [];
    if (!bn || bn.length < 3) problems.push("Enter your bank name.");
    if (acc.length !== 10) problems.push("Account number must be 10 digits (Nigeria).");
    if (bv.length !== 11) problems.push("BVN must be 11 digits.");
    return { ok: problems.length === 0, problems, bn, acc, bv };
  }, [bankName, accountNumber, bvn]);

  const payoutComplete = validations.ok;

  // This page is for payout setup; withdrawal is typically gated by:
  //  - KYC approved
  //  - payoutComplete
  //  - walletAvailable > 0
  const canWithdrawSoon = isKycApproved && payoutComplete && walletAvailable > 0;

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!user?.uid) {
      setErr("You must be logged in.");
      return;
    }

    if (!validations.ok) {
      setErr(validations.problems[0] || "Please review your payout details.");
      return;
    }

    try {
      setSaving(true);

      // Minimal payload — keep it clean for compliance & audits
      const payload = {
        payout: {
          bankName: validations.bn,
          accountNumber: validations.acc,
          bvn: validations.bv,
          accountName: String(accountName || "").trim(), // optional display field
          country: "NG",
          currency: "NGN",
          status: "PENDING_REVIEW", // luxury/compliance tone: you can flip to VERIFIED later
          updatedAt: serverTimestamp(),
        },
        payoutSetupComplete: true,
        updatedAt: serverTimestamp(),
      };

      // Merge into users/{uid}
      await setDoc(doc(db, "users", user.uid), payload, { merge: true });

      setExisting((p) => ({
        ...p,
        hasPayout: true,
        bvnMasked: maskBVN(validations.bv),
        lastUpdatedAt: new Date(),
      }));

      setOk("Payout details saved. You can now proceed to withdrawals when eligible.");
    } catch (e) {
      console.error("PayoutSetup save error:", e);
      setErr("Could not save payout details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const statusTone = !isKycApproved ? "amber" : payoutComplete ? "emerald" : "amber";

  return (
    <main className="min-h-screen bg-[#05070a] pt-20 pb-12 px-4 text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300">
              Payout Setup
            </h1>

            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone={statusTone}>
                🔒 Withdrawal Gate
                <span className="opacity-80">
                  {!isKycApproved
                    ? "KYC required"
                    : payoutComplete
                    ? "Payout details ready"
                    : "Payout details required"}
                </span>
              </Pill>

              {existing.hasPayout ? (
                <Pill tone="emerald">✓ Saved</Pill>
              ) : (
                <Pill tone="amber">Setup pending</Pill>
              )}
            </div>
          </div>

          <p className="text-white/70 max-w-2xl text-sm md:text-base">
            For a premium marketplace, we only release payouts to{" "}
            <span className="font-semibold">verified hosts</span> and{" "}
            <span className="font-semibold">validated payout accounts</span>.
            This protects guests, hosts, and the Nesta brand.
          </p>

          <div className="rounded-3xl border border-white/5 bg-[#090c12] p-4 md:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Eligibility preview</div>
                <div className="text-sm text-white/80">
                  {canWithdrawSoon
                    ? "You’re eligible to withdraw now."
                    : "Withdrawals unlock when KYC + payout details are complete and available balance is > ₦0."}
                </div>
                <div className="text-[11px] text-white/45">
                  Available: <span className="text-white/80 font-semibold">{wallet.loading ? "—" : ngn(walletAvailable)}</span>
                  {"  "}•{"  "}
                  Pending: <span className="text-white/80 font-semibold">{wallet.loading ? "—" : ngn(walletPending)}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Keep consistent with your badge system */}
                <div className="opacity-95">
                  {/* Not required, but keeps brand consistency if you want */}
                  {/* If VerifiedRoleBadge expects role=Host, you can use it here too */}
                </div>

                {!isKycApproved && (
                  <button
                    onClick={() => navigate("/onboarding/kyc/gate")}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300"
                  >
                    Continue KYC →
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {ok}
          </div>
        )}

        <section className="rounded-3xl bg-[#090c12] border border-white/5 p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-sm md:text-base font-semibold">Bank & identity details</h2>
            <div className="text-[11px] text-white/45">
              BVN: <span className="text-white/70 font-semibold">{existing.bvnMasked || "—"}</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Bank name" hint="As on your bank record">
                <input
                  value={bankName}
                  onChange={(e) => setBankName(normalizeBankName(e.target.value))}
                  placeholder="e.g., GTBank, Access Bank, Zenith…"
                  className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
                  autoComplete="organization"
                />
              </FieldShell>

              <FieldShell label="Account number" hint="10 digits">
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(onlyDigits(e.target.value).slice(0, 10))}
                  placeholder="0123456789"
                  inputMode="numeric"
                  className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
                  autoComplete="off"
                />
              </FieldShell>

              <FieldShell label="BVN" hint="11 digits (Nigeria)">
                <input
                  value={bvn}
                  onChange={(e) => setBvn(onlyDigits(e.target.value).slice(0, 11))}
                  placeholder="***********"
                  inputMode="numeric"
                  className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
                  autoComplete="off"
                />
              </FieldShell>

              <FieldShell label="Account name (optional)" hint="Optional display only">
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
                  autoComplete="name"
                />
              </FieldShell>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="font-semibold text-white mb-1">Compliance note</div>
              <ul className="list-disc pl-5 space-y-1 text-white/70">
                <li>We require BVN + bank details to reduce fraud and protect payouts.</li>
                <li>Withdrawals remain locked until KYC is approved.</li>
                <li>For luxury trust, payout changes may be reviewed.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={saving || loading}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  saving || loading
                    ? "bg-white/10 text-white/50 cursor-not-allowed"
                    : "bg-amber-500 text-black hover:bg-amber-400"
                }`}
                title={!validations.ok ? validations.problems[0] : "Save payout details"}
              >
                {saving ? "Saving…" : "Save payout details"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/withdrawals")}
                className="px-5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm font-semibold hover:bg-white/10"
              >
                Go to withdrawals →
              </button>

              <div className="ml-auto text-[11px] text-white/45">
                {existing.lastUpdatedAt ? (
                  <>
                    Last updated:{" "}
                    <span className="text-white/70 font-semibold">
                      {new Date(existing.lastUpdatedAt).toLocaleString()}
                    </span>
                  </>
                ) : (
                  "Not saved yet"
                )}
              </div>
            </div>

            {!validations.ok && (
              <div className="text-[11px] text-amber-200/90">
                🔒 {validations.problems[0]}
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
