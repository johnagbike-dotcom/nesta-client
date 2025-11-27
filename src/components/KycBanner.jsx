// src/components/KycBanner.js
import React, { useEffect, useState } from "react";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import useUserProfile from "../hooks/useUserProfile";

const OK_STATES = ["approved", "verified", "complete"];

export default function KycBanner({ forceHide = false }) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const [remote, setRemote] = useState({ loading: true, status: null });

  // 1) pull from kyc collection so admin updates reflect
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid) {
        if (alive) setRemote({ loading: false, status: null });
        return;
      }
      try {
        const qref = query(
          collection(db, "kyc"),
          where("userId", "==", user.uid),
          limit(1)
        );
        const snap = await getDocs(qref);
        if (!alive) return;
        if (snap.empty) {
          setRemote({ loading: false, status: null });
        } else {
          const d = snap.docs[0].data() || {};
          const s = (d.status || "").toLowerCase();
          setRemote({ loading: false, status: s });
        }
      } catch (e) {
        console.warn("[KycBanner] kyc fetch failed:", e);
        if (alive) setRemote({ loading: false, status: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // 2) local status from user profile
  const localStatus = (
    profile?.kycStatus ||
    profile?.kyc?.status ||
    ""
  ).toLowerCase();

  // 3) merge all sources
  let merged =
    localStatus ||
    (remote.status ? remote.status : "");

  // if remote says approved, trust remote
  if (OK_STATES.includes(remote.status || "")) {
    merged = remote.status;
  }

  // if local says approved, trust local
  if (OK_STATES.includes(localStatus || "")) {
    merged = localStatus;
  }

  // 4) host/partner page may tell us “don’t show at all”
  if (forceHide) {
    merged = "approved";
  }

  // 5) if finally approved → render nothing
  if (OK_STATES.includes(merged)) {
    return null;
  }

  // 6) show the nice modal/banner
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0f1216] rounded-2xl border border-amber-400/20 w-full max-w-lg shadow-2xl relative overflow-hidden">
        <button
          onClick={() => {
            // if you want ability to close without approving:
            // setForceClosed(true)
            // but for now we keep it strict
            window.location.href = "/kyc";
          }}
          className="absolute top-3 right-3 text-white/40 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-200 grid place-items-center font-bold">
              N
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-200/70">
                KYC required
              </p>
              <h2 className="text-lg font-bold text-white">
                Verify to unlock Host tools
              </h2>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            To keep Nesta luxury-grade and safe, all hosts must complete
            government-ID verification (NIN / BVN / Passport) and provide
            a serviceable address.
          </p>
          <ul className="text-white/60 text-sm space-y-1 mb-5">
            <li>• BVN or valid national identity (NIN, National ID, Passport)</li>
            <li>• Address details (will be validated for format)</li>
          </ul>
          <div className="flex gap-3">
            <button
              onClick={() => (window.location.href = "/kyc")}
              className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-semibold py-2 rounded-xl text-center"
            >
              Complete KYC
            </button>
            <button
              onClick={() => (window.location.href = "/kyc")}
              className="px-4 py-2 rounded-xl border border-white/10 text-white/80 text-sm"
            >
              View form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
