// src/pages/Withdrawals.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";

// ===================== API =====================
const api = axios.create({
  // IMPORTANT: should resolve to ".../api" (your fix)
  baseURL: (process.env.REACT_APP_API_BASE || "http://localhost:4000/api").replace(
    /\/$/,
    ""
  ),
  timeout: 20000,
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

const money = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });

const MIN_WITHDRAWAL_N = 1000;

export default function Withdrawals() {
  const { user } = useAuth() || {};
  const nav = useNavigate();

  const [wallet, setWallet] = useState({
    available: 0,
    pending: 0,
    currency: "NGN",
    canWithdraw: true,
    reason: "",
    role: "",
    kycStatus: "",
  });

  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const amountN = useMemo(() => {
    const v = Math.round(Number(String(amount || "").replace(/[^\d.]/g, "")));
    return Number.isFinite(v) ? v : 0;
  }, [amount]);

  const canSubmit =
    !!user &&
    !loading &&
    !submitting &&
    wallet?.canWithdraw !== false &&
    amountN >= MIN_WITHDRAWAL_N &&
    amountN <= Number(wallet.available || 0) &&
    /^\d{10}$/.test(String(accountNumber || "").trim()) &&
    String(bankCode || "").trim().length >= 3;

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payouts/me/wallet");

      if (data?.ok) {
        setWallet({
          available: Number(data.wallet?.available || 0),
          pending: Number(data.wallet?.pending || 0),
          currency: data.wallet?.currency || "NGN",
          // policy flags (optional but we now return them from server)
          canWithdraw: data.canWithdraw !== false,
          reason: data.reason || "",
          role: data.role || "",
          kycStatus: data.kycStatus || "",
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
      setWallet({
        available: 0,
        pending: 0,
        currency: "NGN",
        canWithdraw: false,
        reason: "Please sign in.",
        role: "",
        kycStatus: "",
      });
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleWithdraw = async () => {
    if (!user?.uid) return toast.info("Please log in to request a withdrawal.");

    if (wallet?.canWithdraw === false) {
      return toast.error(wallet?.reason || "Withdrawals are currently locked.");
    }

    if (amountN < MIN_WITHDRAWAL_N) {
      return toast.error(`Minimum withdrawal is ${money(MIN_WITHDRAWAL_N)}.`);
    }

    if (amountN > Number(wallet.available || 0)) {
      return toast.error("Insufficient available balance.");
    }

    if (!/^\d{10}$/.test(String(accountNumber || "").trim())) {
      return toast.error("Account number must be 10 digits.");
    }

    if (String(bankCode || "").trim().length < 3) {
      return toast.error("Enter a valid bank code.");
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/payouts/request", {
        amount: amountN,
        bankCode: String(bankCode).trim(),
        accountNumber: String(accountNumber).trim(),
      });

      if (data?.ok) {
        toast.success("Payout request submitted.");

        // refresh wallet (server returns it too, but we also refetch for certainty)
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

          <div className="text-xs text-white/50">
            {loading ? "Loading wallet…" : "Wallet ready"}
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-amber-300">
          Request Withdrawal
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Withdraw your available balance. Minimum:{" "}
          <span className="text-white font-semibold">{money(MIN_WITHDRAWAL_N)}</span>
        </p>

        {wallet?.canWithdraw === false && !loading ? (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="font-semibold">Withdrawals locked</div>
            <div className="opacity-90 mt-1">
              {wallet?.reason || "Please complete the required checks."}
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                placeholder="e.g. 5000"
              />

              {amountN > 0 && amountN < MIN_WITHDRAWAL_N ? (
                <p className="mt-1 text-xs text-amber-200/80">
                  Minimum withdrawal is {money(MIN_WITHDRAWAL_N)}.
                </p>
              ) : null}

              {amountN > Number(wallet.available || 0) ? (
                <p className="mt-1 text-xs text-red-300">
                  Amount exceeds available balance.
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm text-white/80 mb-1">Bank Code</label>
              <input
                type="text"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                placeholder="e.g. 058"
              />
              <p className="mt-1 text-[11px] text-white/50">
                In production we’ll replace this with a bank dropdown + account resolve.
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/80 mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                placeholder="10 digits"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleWithdraw} disabled={!canSubmit}>
              {submitting ? "Submitting…" : "Request Withdrawal"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
