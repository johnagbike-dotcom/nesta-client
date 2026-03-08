// src/pages/PayoutSetup.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";
import BankAutocomplete from "../components/BankAutocomplete";

const nf = new Intl.NumberFormat("en-NG");
const ngn = (n) => `₦${nf.format(Math.round(Number(n || 0)))}`;

function maskBVN(v) {
  const s = String(v || "").replace(/\D/g, "");
  if (!s) return "";
  if (s.length <= 4) return s;
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeBankName(v) {
  return String(v || "").trim().replace(/\s+/g, " ");
}

function fmtAnyDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function Pill({ tone = "amber", children }) {
  const cls =
    tone === "amber"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
      : tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "slate"
      ? "border-white/10 bg-white/5 text-white/80"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function FieldShell({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">
          {label}
        </label>
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
  const { profile } = useUserProfile();

  const kycStatusRaw =
    profile?.kycStatus ||
    profile?.kyc?.status ||
    profile?.kyc?.state ||
    "";

  const kycStatus = String(kycStatusRaw).toLowerCase();
  const isKycApproved = ["approved", "verified", "complete"].includes(kycStatus);

  const [wallet, setWallet] = useState({
    loading: true,
    availableN: 0,
    pendingN: 0,
  });

  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bvn, setBvn] = useState("");
  const [accountName, setAccountName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [existing, setExisting] = useState({
    hasPayout: false,
    lastUpdatedAt: null,
    bvnMasked: "",
    payoutStatus: "PENDING_REVIEW",
  });

  const [bankSelected, setBankSelected] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.uid) {
        if (alive) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErr("");
        setOk("");

        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.exists() ? snap.data() || {} : {};

        const availableN = Number(
          d.walletAvailableN ??
            d.availableBalanceN ??
            d.availableN ??
            d.wallet?.availableN ??
            0
        );

        const pendingN = Number(
          d.walletPendingN ??
            d.pendingBalanceN ??
            d.pendingN ??
            d.wallet?.pendingN ??
            0
        );

        const payout = d.payout || d.payoutSetup || d.withdrawal || {};

        const loadedBankName = normalizeBankName(payout.bankName || "");
        const loadedBankCode = String(payout.bankCode || "").trim();
        const loadedAccNo = onlyDigits(payout.accountNumber || "");
        const loadedBvn = onlyDigits(payout.bvn || "");
        const loadedAccName = String(payout.accountName || "");
        const loadedStatus = String(payout.status || "PENDING_REVIEW").toUpperCase();

        const hasPayout =
          !!loadedBankName &&
          !!loadedBankCode &&
          loadedAccNo.length === 10 &&
          loadedBvn.length === 11;

        if (!alive) return;

        setWallet({
          loading: false,
          availableN: Number.isFinite(availableN) ? availableN : 0,
          pendingN: Number.isFinite(pendingN) ? pendingN : 0,
        });

        setBankName(loadedBankName);
        setBankCode(loadedBankCode);
        setBankSelected(!!loadedBankCode);
        setAccountNumber(loadedAccNo);
        setBvn(loadedBvn);
        setAccountName(loadedAccName);

        setExisting({
          hasPayout,
          lastUpdatedAt: fmtAnyDate(payout.updatedAt),
          bvnMasked: maskBVN(loadedBvn),
          payoutStatus: loadedStatus,
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
    const bc = String(bankCode || "").trim();
    const acc = onlyDigits(accountNumber);
    const bv = onlyDigits(bvn);

    const problems = [];

    if (!bn || bn.length < 3) problems.push("Enter your bank name.");
    if (!bc || !bankSelected) problems.push("Please select a bank from the list.");
    if (acc.length !== 10) problems.push("Account number must be 10 digits (Nigeria).");
    if (bv.length !== 11) problems.push("BVN must be 11 digits.");

    return { ok: problems.length === 0, problems, bn, bc, acc, bv };
  }, [bankName, bankCode, bankSelected, accountNumber, bvn]);

  const payoutComplete = validations.ok;
  const canWithdrawSoon = isKycApproved && payoutComplete && walletAvailable > 0;
  const savedPayoutStatus = String(existing.payoutStatus || "PENDING_REVIEW").toUpperCase();

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

      const payload = {
        payout: {
          bankName: validations.bn,
          bankCode: validations.bc,
          accountNumber: validations.acc,
          bvn: validations.bv,
          accountName: String(accountName || "").trim(),
          country: "NG",
          currency: "NGN",
          status: "PENDING_REVIEW",
          updatedAt: serverTimestamp(),
        },
        payoutSetupComplete: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });

      setExisting((p) => ({
        ...p,
        hasPayout: true,
        bvnMasked: maskBVN(validations.bv),
        lastUpdatedAt: new Date(),
        payoutStatus: "PENDING_REVIEW",
      }));

      setOk("Payout details saved. They are now pending admin review before withdrawals can be released.");
    } catch (e) {
      console.error("PayoutSetup save error:", e);
      setErr("Could not save payout details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const gateTone = !isKycApproved ? "amber" : payoutComplete ? "emerald" : "amber";

  const payoutStatusTone =
    savedPayoutStatus === "VERIFIED"
      ? "emerald"
      : savedPayoutStatus === "REJECTED"
      ? "amber"
      : "slate";

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
              <Pill tone={gateTone}>
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
                <Pill tone={payoutStatusTone}>
                  {savedPayoutStatus === "VERIFIED"
                    ? "✓ Verified"
                    : savedPayoutStatus === "REJECTED"
                    ? "Needs update"
                    : "Under review"}
                </Pill>
              ) : (
                <Pill tone="amber">Setup pending</Pill>
              )}
            </div>
          </div>

          <p className="text-white/70 max-w-2xl text-sm md:text-base">
            For a premium marketplace, we only release payouts to{" "}
            <span className="font-semibold">verified hosts</span> and{" "}
            <span className="font-semibold">validated payout accounts</span>. This protects guests, hosts, and the Nesta brand.
          </p>

          <div className="rounded-3xl border border-white/5 bg-[#090c12] p-4 md:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Eligibility preview
                </div>

                <div className="text-sm text-white/80">
                  {canWithdrawSoon
                    ? "You’re eligible to withdraw now."
                    : !isKycApproved
                    ? "Complete KYC first before withdrawals can be unlocked."
                    : savedPayoutStatus === "VERIFIED"
                    ? "Your payout method is verified. Withdrawals unlock once available balance is above ₦0."
                    : existing.hasPayout
                    ? "Your payout details are saved and pending admin review."
                    : "Add payout details to prepare for withdrawals."}
                </div>

                <div className="text-[11px] text-white/45">
                  Available:{" "}
                  <span className="text-white/80 font-semibold">
                    {wallet.loading ? "—" : ngn(walletAvailable)}
                  </span>
                  {"  "}•{"  "}
                  Pending:{" "}
                  <span className="text-white/80 font-semibold">
                    {wallet.loading ? "—" : ngn(walletPending)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
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
            <h2 className="text-sm md:text-base font-semibold">
              Bank & identity details
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[11px] text-white/45">
                BVN:{" "}
                <span className="text-white/70 font-semibold">
                  {existing.bvnMasked || "—"}
                </span>
              </div>

              {existing.hasPayout ? (
                <Pill tone={payoutStatusTone}>
                  Status: {savedPayoutStatus.replace(/_/g, " ")}
                </Pill>
              ) : null}
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Bank name" hint="Select from list (Nigeria)">
                <BankAutocomplete
                  value={bankName}
                  onChangeValue={(v) => {
                    setBankName(normalizeBankName(v));
                    setBankSelected(false);
                    setBankCode("");
                  }}
                  onSelectBank={(b) => {
                    setBankName(normalizeBankName(b?.name || ""));
                    setBankCode(String(b?.code || ""));
                    setBankSelected(true);
                  }}
                  disabled={saving || loading}
                  placeholder="Start typing: GTBank, Access Bank, Zenith…"
                />
              </FieldShell>

              <FieldShell label="Account number" hint="10 digits">
                <input
                  value={accountNumber}
                  onChange={(e) =>
                    setAccountNumber(onlyDigits(e.target.value).slice(0, 10))
                  }
                  placeholder="0123456789"
                  inputMode="numeric"
                  className="w-full bg-transparent outline-none placeholder-white/30 text-sm"
                  autoComplete="off"
                />
              </FieldShell>

              <FieldShell label="BVN" hint="11 digits (Nigeria)">
                <input
                  value={bvn}
                  onChange={(e) =>
                    setBvn(onlyDigits(e.target.value).slice(0, 11))
                  }
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

            <div className="text-[11px] text-white/45">
              Bank selection:{" "}
              {bankSelected && bankCode ? (
                <span className="text-emerald-200 font-semibold">
                  ✓ Selected (code: {bankCode})
                </span>
              ) : (
                <span className="text-amber-200/90">
                  Please select a bank from the dropdown
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="font-semibold text-white mb-1">Compliance note</div>
              <ul className="list-disc pl-5 space-y-1 text-white/70">
                <li>We require BVN + bank details to reduce fraud and protect payouts.</li>
                <li>Withdrawals remain locked until KYC is approved.</li>
                <li>Your payout setup may be reviewed before funds can be released.</li>
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
                {saving ? "Saving…" : existing.hasPayout ? "Update payout details" : "Save payout details"}
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
                      {existing.lastUpdatedAt.toLocaleString()}
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