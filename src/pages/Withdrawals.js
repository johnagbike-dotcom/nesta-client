// src/pages/Withdrawals.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";

/* ===================== API ===================== */
const RAW_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:4000").replace(/\/+$/, "");
const API_BASE = /\/api$/i.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const u = getAuth().currentUser;
  if (u) {
    const token = await u.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ===================== helpers ===================== */
const money = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });

const MIN_WITHDRAWAL_N_FALLBACK = 1000;

function isKycApprovedStatus(s) {
  const v = String(s || "").toLowerCase();
  return ["approved", "verified", "complete"].includes(v);
}

export default function Withdrawals() {
  const { user } = useAuth() || {};
  const nav = useNavigate();

  const [wallet, setWallet] = useState({
    available: 0,
    pending: 0,
    currency: "NGN",

    // policy flags from server
    canWithdraw: false,
    reason: "",
    role: "",
    kycStatus: "",
    payoutSetupComplete: false,
    payoutStatus: "",
    payoutPreview: null,
    minWithdrawal: MIN_WITHDRAWAL_N_FALLBACK,
  });

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const amountN = useMemo(() => {
    const v = Math.round(Number(String(amount || "").replace(/[^\d.]/g, "")));
    return Number.isFinite(v) ? v : 0;
  }, [amount]);

  const minWithdrawal = Number(wallet.minWithdrawal || MIN_WITHDRAWAL_N_FALLBACK);

  const payoutVerified = String(wallet.payoutStatus || "").toUpperCase() === "VERIFIED";

  const needsKyc = !isKycApprovedStatus(wallet.kycStatus);
  const needsPayoutSetup = wallet.payoutSetupComplete !== true;
  const needsPayoutVerify = wallet.payoutSetupComplete === true && !payoutVerified;

  // Server policy is the source-of-truth
  const withdrawalsLockedByPolicy = wallet.canWithdraw === false;

  // UI gating (luxury UX: disable amount input when user cannot proceed)
  const canProceedToSubmit =
    !!user?.uid &&
    !loading &&
    !submitting &&
    !withdrawalsLockedByPolicy &&
    amountN >= minWithdrawal &&
    amountN <= Number(wallet.available || 0);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payouts/me/wallet");

      if (data?.ok) {
        setWallet({
          available: Number(data.wallet?.available || 0),
          pending: Number(data.wallet?.pending || 0),
          currency: data.wallet?.currency || "NGN",

          canWithdraw: data.canWithdraw !== false,
          reason: data.reason || "",
          role: data.role || "",
          kycStatus: data.kycStatus || "",

          payoutSetupComplete: data.payoutSetupComplete === true,
          payoutStatus: data.payoutStatus || "",
          payoutPreview: data.payoutPreview || null,

          minWithdrawal: Number(data.minWithdrawal || MIN_WITHDRAWAL_N_FALLBACK),
        });
      } else {
        toast.error(data?.error || "Failed to load wallet.");
      }
    } catch (err) {
      console.error("Failed to fetch wallet data", err);
      const msg = err?.response?.data?.error || "Failed to fetch wallet.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid) fetchWallet();
    else {
      setWallet((w) => ({
        ...w,
        available: 0,
        pending: 0,
        canWithdraw: false,
        reason: "Please sign in.",
      }));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const primaryCta = useMemo(() => {
    if (submitting) return { label: "Submitting…", action: null, disabled: true };
    if (loading) return { label: "Loading…", action: null, disabled: true };

    if (!user?.uid) {
      return { label: "Sign in to continue", action: () => nav("/login"), disabled: false };
    }

    if (needsKyc) {
      return { label: "Complete KYC to withdraw", action: () => nav("/onboarding/kyc/gate"), disabled: false };
    }

    if (needsPayoutSetup) {
      return { label: "Set up payout method", action: () => nav("/payout-setup"), disabled: false };
    }

    if (needsPayoutVerify) {
      return { label: "Payout under review", action: () => nav("/payout-setup"), disabled: false };
    }

    if (Number(wallet.available || 0) <= 0) {
      return { label: "No withdrawable balance", action: null, disabled: true };
    }

    return { label: "Request Withdrawal", action: null, disabled: !canProceedToSubmit };
  }, [
    submitting,
    loading,
    user?.uid,
    needsKyc,
    needsPayoutSetup,
    needsPayoutVerify,
    wallet.available,
    nav,
    canProceedToSubmit,
  ]);

  const handleWithdraw = async () => {
    if (!user?.uid) return toast.info("Please log in to request a withdrawal.");

    if (wallet?.canWithdraw === false) {
      return toast.error(wallet?.reason || "Withdrawals are currently locked.");
    }

    if (amountN < minWithdrawal) {
      return toast.error(`Minimum withdrawal is ${money(minWithdrawal)}.`);
    }

    if (amountN > Number(wallet.available || 0)) {
      return toast.error("Insufficient available balance.");
    }

    setSubmitting(true);
    try {
      // ✅ amount-only (bank details pulled from VERIFIED payout method in users/{uid}.payout)
      const { data } = await api.post("/payouts/request", { amount: amountN });

      if (data?.ok) {
        toast.success("Payout request submitted.");

        // refresh wallet
        if (data.wallet) {
          setWallet((w) => ({
            ...w,
            available: Number(data.wallet.available || 0),
            pending: Number(data.wallet.pending || 0),
          }));
        } else {
          await fetchWallet();
        }

        nav(-1);
      } else {
        toast.error(data?.error || "Error submitting payout request.");
      }
    } catch (err) {
      console.error("Error processing payout request:", err);
      const msg = err?.response?.data?.error || "Error processing payout request.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const amountInputDisabled =
    loading ||
    submitting ||
    !user?.uid ||
    needsKyc ||
    needsPayoutSetup ||
    needsPayoutVerify ||
    withdrawalsLockedByPolicy ||
    Number(wallet.available || 0) <= 0;

  return (
    <main className="min-h-screen bg-[#05070a] pt-24 pb-16 px-4 text-white">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => nav(-1)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold"
          >
            ← Back
          </button>

          <div className="text-xs text-white/50">{loading ? "Loading wallet…" : "Wallet ready"}</div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-amber-300">Request Withdrawal</h1>

        <p className="mt-2 text-sm text-white/70">
          Minimum: <span className="text-white font-semibold">{money(minWithdrawal)}</span>
        </p>

        {/* Policy status box */}
        {!loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Payout destination</div>
              <span className="text-[11px] text-white/50">
                Status:{" "}
                <span className="text-white/80 font-semibold">{String(wallet.payoutStatus || "—")}</span>
              </span>
            </div>

            <div className="mt-2 text-white/70">
              {wallet.payoutPreview?.bankName ? (
                <>
                  <div>{wallet.payoutPreview.bankName}</div>
                  <div className="text-xs text-white/50">{wallet.payoutPreview.accountNumberMasked || ""}</div>
                </>
              ) : (
                <div className="text-xs text-white/50">No payout method on file yet.</div>
              )}
            </div>

            {withdrawalsLockedByPolicy ? (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                <div className="font-semibold">Withdrawals locked</div>
                <div className="opacity-90 mt-1">{wallet.reason || "Please complete the required checks."}</div>
              </div>
            ) : null}

            {/* luxury UX: always provide a clear route */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => nav("/payout-setup")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
              >
                Manage payout setup →
              </button>

              {needsKyc ? (
                <button
                  onClick={() => nav("/onboarding/kyc/gate")}
                  className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                >
                  Continue KYC →
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0a0e14] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/80">
              <span>Available</span>
              <span className="font-bold text-white">{money(wallet.available)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Pending</span>
              <span className="font-semibold">{money(wallet.pending)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-white/80 mb-1">Amount (₦)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={amountInputDisabled}
                className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ${
                  amountInputDisabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
                placeholder={amountInputDisabled ? "Complete the steps above to withdraw" : "e.g. 5000"}
              />

              {amountN > 0 && amountN < minWithdrawal ? (
                <p className="mt-1 text-xs text-amber-200/80">Minimum withdrawal is {money(minWithdrawal)}.</p>
              ) : null}

              {amountN > Number(wallet.available || 0) ? (
                <p className="mt-1 text-xs text-red-300">Amount exceeds available balance.</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="font-semibold text-white mb-1">Premium withdrawal policy</div>
              <ul className="list-disc pl-5 space-y-1 text-white/70">
                <li>Withdrawals are only released to a <b>verified payout method</b> on file.</li>
                <li>BVN + bank details are collected once in <b>Payout Setup</b> and reviewed.</li>
                <li>This protects guests, hosts, and the Nesta brand.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
            {/* secondary: always give a safe path */}
            <button
              onClick={() => nav("/payout-setup")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              type="button"
            >
              Payout Setup
            </button>

            <Button
              onClick={primaryCta.action ? primaryCta.action : handleWithdraw}
              disabled={primaryCta.disabled}
            >
              {primaryCta.label}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
