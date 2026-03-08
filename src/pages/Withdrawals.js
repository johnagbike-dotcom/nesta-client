// src/pages/Withdrawals.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
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

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function extractError(err, fallback = "Something went wrong.") {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    if (typeof iso?.toDate === "function") {
      const d = iso.toDate();
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (typeof iso?.seconds === "number") {
      const d = new Date(iso.seconds * 1000);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function shortId(id) {
  const s = String(id || "");
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s || "—";
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "border-emerald-400/50 bg-emerald-500/10 text-emerald-200";
  if (s === "processing") return "border-sky-400/50 bg-sky-500/10 text-sky-200";
  if (s === "failed") return "border-rose-400/50 bg-rose-500/10 text-rose-200";
  if (s === "cancelled") return "border-white/20 bg-white/5 text-white/70";
  return "border-white/15 bg-white/5 text-white/75";
}

export default function Withdrawals() {
  const { user } = useAuth() || {};
  const { showToast } = useToast();
  const nav = useNavigate();

  const notify = useCallback(
    (msg, type = "info") => {
      try {
        showToast?.(msg, type);
      } catch {
        // no-op
      }
    },
    [showToast]
  );

  const [wallet, setWallet] = useState({
    available: 0,
    pending: 0,
    currency: "NGN",
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

  const [reqLoading, setReqLoading] = useState(false);
  const [requests, setRequests] = useState([]);

  const prevRef = useRef({ available: 0, pending: 0 });
  const [pulse, setPulse] = useState({ available: "", pending: "" });

  const amountN = useMemo(() => {
    const clean = String(amount || "").replace(/[^\d]/g, "");
    return toInt(clean);
  }, [amount]);

  const minWithdrawal = Number(wallet.minWithdrawal || MIN_WITHDRAWAL_N_FALLBACK);
  const payoutVerified = String(wallet.payoutStatus || "").toUpperCase() === "VERIFIED";

  const needsKyc = !isKycApprovedStatus(wallet.kycStatus);
  const needsPayoutSetup = wallet.payoutSetupComplete !== true;
  const needsPayoutVerify = wallet.payoutSetupComplete === true && !payoutVerified;
  const withdrawalsLockedByPolicy = wallet.canWithdraw === false;

  const canSubmit =
    !!user?.uid &&
    !loading &&
    !submitting &&
    !withdrawalsLockedByPolicy &&
    amountN >= minWithdrawal &&
    amountN <= Number(wallet.available || 0);

  const applyWalletState = useCallback((next) => {
    const prev = prevRef.current || { available: 0, pending: 0 };

    const nextAvail = Number(next.available || 0);
    const nextPend = Number(next.pending || 0);

    if (nextAvail !== Number(prev.available || 0)) {
      setPulse((p) => ({
        ...p,
        available: nextAvail > Number(prev.available || 0) ? "pulseGold" : "pulseSoft",
      }));
      setTimeout(() => setPulse((p) => ({ ...p, available: "" })), 520);
    }

    if (nextPend !== Number(prev.pending || 0)) {
      setPulse((p) => ({ ...p, pending: "pulseAmber" }));
      setTimeout(() => setPulse((p) => ({ ...p, pending: "" })), 520);
    }

    prevRef.current = { available: nextAvail, pending: nextPend };

    setWallet((w) => ({
      ...w,
      available: nextAvail,
      pending: nextPend,
    }));
  }, []);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payouts/me/wallet", {
        params: { _t: Date.now() },
      });

      if (data?.ok) {
        const next = {
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
        };

        applyWalletState(next);

        setWallet((w) => ({
          ...w,
          ...next,
        }));
      } else {
        notify(data?.error || "Failed to load wallet.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch wallet data", err);
      notify(extractError(err, "Failed to fetch wallet."), "error");
    } finally {
      setLoading(false);
    }
  }, [applyWalletState, notify]);

  const fetchRequests = useCallback(async () => {
    if (!user?.uid) return;
    setReqLoading(true);
    try {
      const { data } = await api.get("/payouts/me/requests", {
        params: { limit: 20, _t: Date.now() },
      });
      if (data?.ok) {
        setRequests(Array.isArray(data.rows) ? data.rows : []);
      } else {
        setRequests([]);
      }
    } catch (e) {
      console.error("Failed to fetch payout requests", e);
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchWallet();
      fetchRequests();
    } else {
      setWallet((w) => ({
        ...w,
        available: 0,
        pending: 0,
        canWithdraw: false,
        reason: "Please sign in.",
      }));
      setRequests([]);
      setLoading(false);
    }
  }, [user?.uid, fetchWallet, fetchRequests]);

  const primaryCta = useMemo(() => {
    if (submitting) return { label: "Submitting…", action: null, disabled: true };
    if (loading) return { label: "Loading…", action: null, disabled: true };

    if (!user?.uid) {
      return {
        label: "Sign in to continue",
        action: () => nav("/login"),
        disabled: false,
      };
    }

    if (needsKyc) {
      return {
        label: "Complete KYC to withdraw",
        action: () => nav("/onboarding/kyc/gate"),
        disabled: false,
      };
    }

    if (needsPayoutSetup) {
      return {
        label: "Set up payout method",
        action: () => nav("/payout-setup"),
        disabled: false,
      };
    }

    if (needsPayoutVerify) {
      return {
        label: "Payout under review",
        action: () => nav("/payout-setup"),
        disabled: false,
      };
    }

    if (Number(wallet.available || 0) <= 0) {
      return {
        label: "No withdrawable balance",
        action: null,
        disabled: true,
      };
    }

    return {
      label: "Request Withdrawal",
      action: null,
      disabled: !canSubmit,
    };
  }, [
    submitting,
    loading,
    user?.uid,
    needsKyc,
    needsPayoutSetup,
    needsPayoutVerify,
    wallet.available,
    nav,
    canSubmit,
  ]);

  const handleWithdraw = async () => {
    if (!user?.uid) {
      notify("Please log in to request a withdrawal.", "info");
      return;
    }

    if (withdrawalsLockedByPolicy) {
      notify(wallet?.reason || "Withdrawals are currently locked.", "warning");
      return;
    }

    if (amountN < minWithdrawal) {
      notify(`Minimum withdrawal is ${money(minWithdrawal)}.`, "warning");
      return;
    }

    if (amountN > Number(wallet.available || 0)) {
      notify(
        "Insufficient withdrawable balance. Only Available funds can be withdrawn.",
        "error"
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = { amount: toInt(amountN) };

      const { data } = await api.post("/payouts/request", payload);

      if (!data?.ok) {
        notify(data?.error || "Error submitting withdrawal request.", "error");
        return;
      }

      notify("Withdrawal request submitted.", "success");

      if (data.wallet) {
        applyWalletState({
          available: Number(data.wallet.available || 0),
          pending: Number(data.wallet.pending || 0),
        });
      } else {
        await fetchWallet();
      }

      if (data.requestId) {
        setRequests((prev) => [
          {
            id: data.requestId,
            amount: payload.amount,
            status: "pending",
            createdAt: new Date().toISOString(),
            note: "",
            bankName: wallet?.payoutPreview?.bankName || "",
            accountNumberMasked: wallet?.payoutPreview?.accountNumberMasked || "",
          },
          ...prev.filter((x) => String(x.id) !== String(data.requestId)),
        ]);
      }

      setAmount("");

      await Promise.all([fetchWallet(), fetchRequests()]);
    } catch (err) {
      console.error("Error processing payout request:", err);

      const code = err?.response?.data?.code || "";
      const serverMsg =
        err?.response?.data?.error ||
        extractError(err, "Error processing withdrawal request.");

      if (code === "insufficient_available") {
        notify(
          "Only Available funds can be withdrawn. Pending funds unlock after check-in.",
          "warning"
        );
      } else if (code === "min_withdrawal") {
        notify(serverMsg || `Minimum withdrawal is ${money(minWithdrawal)}.`, "warning");
      } else if (code === "withdrawals_locked") {
        notify(serverMsg || "Withdrawals are currently locked.", "warning");
      } else if (code === "invalid_amount") {
        notify(serverMsg || "Invalid amount.", "error");
      } else {
        notify(serverMsg || "Error processing withdrawal request.", "error");
      }
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
    withdrawalsLockedByPolicy;

  const availableN = toInt(wallet.available || 0);
  const pendingN = toInt(wallet.pending || 0);

  return (
    <main className="min-h-screen bg-[#05070a] pt-24 pb-16 px-4 text-white">
      <div className="max-w-xl mx-auto">
        <style>{`
          @keyframes pulseGold {
            0% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); transform: translateY(0); }
            30% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.14); transform: translateY(-1px); }
            100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); transform: translateY(0); }
          }
          @keyframes pulseAmber {
            0% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
            35% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12); }
            100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
          }
          @keyframes pulseSoft {
            0% { box-shadow: 0 0 0 rgba(255,255,255,0); }
            35% { box-shadow: 0 0 0 4px rgba(255,255,255,0.08); }
            100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          }
          .pulseGold { animation: pulseGold 520ms ease-out; border-radius: 16px; }
          .pulseAmber { animation: pulseAmber 520ms ease-out; border-radius: 16px; }
          .pulseSoft { animation: pulseSoft 520ms ease-out; border-radius: 16px; }
        `}</style>

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => nav(-1)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            ← Back
          </button>

          <div className="text-xs text-white/50">{loading ? "Loading wallet…" : "Wallet ready"}</div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-amber-300">Request Withdrawal</h1>

        <p className="mt-2 text-sm text-white/70">
          Minimum: <span className="text-white font-semibold">{money(minWithdrawal)}</span>
        </p>

        {!loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Payout destination</div>
              <span className="text-[11px] text-white/50">
                Status: <span className="text-white/80 font-semibold">{String(wallet.payoutStatus || "—")}</span>
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
            <div className={`flex justify-between text-white/80 ${pulse.available}`}>
              <span>Available (Withdrawable)</span>
              <span className="font-bold text-white">{money(availableN)}</span>
            </div>

            <div className={`flex justify-between text-white/70 ${pulse.pending}`}>
              <span className="flex items-center gap-2">
                Pending (Not withdrawable yet)
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/70"
                  title="Pending funds are released after guest check-in (release)."
                >
                  i
                </span>
              </span>
              <span className="font-semibold">{money(pendingN)}</span>
            </div>
          </div>

          {pendingN > 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70 leading-relaxed">
              <div className="font-semibold text-white/80">About Pending funds</div>
              <div className="mt-1">
                Pending funds are marketplace-protected and become withdrawable after guest check-in
                and release.
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-white/80 mb-1">Amount (₦)</label>

              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={minWithdrawal}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(String(e.target.value || "").replace(/[^\d]/g, ""))}
                  disabled={amountInputDisabled}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ${
                    amountInputDisabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  placeholder={amountInputDisabled ? "Complete the steps above to withdraw" : "e.g. 5000"}
                />

                <button
                  type="button"
                  disabled={amountInputDisabled || availableN <= 0}
                  onClick={() => setAmount(String(availableN))}
                  className={`shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-semibold hover:bg-white/10 ${
                    amountInputDisabled || availableN <= 0 ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  title="Set to maximum withdrawable amount"
                >
                  Max
                </button>
              </div>

              {amountN > 0 && amountN < minWithdrawal ? (
                <p className="mt-1 text-xs text-amber-200/80">
                  Minimum withdrawal is {money(minWithdrawal)}.
                </p>
              ) : null}

              {amountN > availableN ? (
                <p className="mt-1 text-xs text-red-300">
                  Amount exceeds withdrawable balance (Available). Pending funds cannot be withdrawn yet.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="font-semibold text-white mb-1">Premium withdrawal policy</div>
              <ul className="list-disc pl-5 space-y-1 text-white/70">
                <li>Withdrawals are only released to a <b>verified payout method</b> on file.</li>
                <li>
                  <b>Available</b> is withdrawable; <b>Pending</b> unlocks after check-in and release.
                </li>
                <li>This protects guests, hosts, and the Nesta brand.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={async () => {
                await fetchWallet();
                await fetchRequests();
                notify("Wallet refreshed.", "info");
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              type="button"
              disabled={loading || submitting}
            >
              Refresh
            </button>

            <button
              onClick={() => nav("/payout-setup")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              type="button"
            >
              Payout Setup
            </button>

            <Button onClick={primaryCta.action ? primaryCta.action : handleWithdraw} disabled={primaryCta.disabled}>
              {primaryCta.label}
            </Button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-[#090c12] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-semibold text-white">Recent withdrawal requests</h2>
              <p className="text-xs text-white/50 mt-1">
                Track your requests: pending → processing → paid (or failed).
              </p>
            </div>

            <button
              onClick={() => {
                fetchRequests();
                notify("Withdrawal history refreshed.", "info");
              }}
              disabled={reqLoading || !user?.uid}
              className={`rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 ${
                reqLoading || !user?.uid ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {reqLoading ? "Refreshing…" : "Refresh list"}
            </button>
          </div>

          <div className="px-5 py-4">
            {reqLoading ? (
              <div className="text-sm text-white/70">Loading requests…</div>
            ) : !user?.uid ? (
              <div className="text-sm text-white/70">Sign in to view your requests.</div>
            ) : requests.length === 0 ? (
              <div className="text-sm text-white/70">No withdrawal requests yet.</div>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{money(r.amount || 0)}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${statusTone(
                            r.status
                          )}`}
                        >
                          {String(r.status || "pending")}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-white/50">
                        {fmtDateTime(r.createdAt)} · Ref <span className="font-mono">{shortId(r.id)}</span>
                      </div>

                      {r.note ? (
                        <div className="mt-1 text-[11px] text-white/55 truncate">{r.note}</div>
                      ) : null}
                    </div>

                    <div className="text-right text-xs text-white/50">
                      {r.bankName || r.accountNumberMasked ? (
                        <>
                          <div className="text-white/70 font-semibold">{r.bankName || "Bank"}</div>
                          <div className="font-mono">{r.accountNumberMasked || "—"}</div>
                        </>
                      ) : (
                        <div>—</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}