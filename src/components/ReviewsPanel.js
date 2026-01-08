// src/components/ReviewsPanel.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import StarRating from "./StarRating";
import "../styles/polish.css";
import "../styles/motion.css";

/**
 * ReviewsPanel (Luxury-safe)
 * - Public can READ reviews (no users_public dependency).
 * - Only signed-in users can POST.
 * - Enforces one-review-per-user (docId = uid) for subcollection.
 * - Tries Subcollection first: listings/{listingId}/reviews
 *   then falls back to Top-level: reviews (listingId field)
 *
 * IMPORTANT: Make sure Firestore rules allow:
 * - read: true for reviews
 * - write: signedIn + constraints
 */

function fmtTime(ts) {
  try {
    if (!ts) return "";
    const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function clampRating(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 5;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function safeName(user) {
  const raw =
    user?.displayName ||
    user?.name ||
    (typeof user?.email === "string" ? user.email.split("@")[0] : "") ||
    "";
  const s = String(raw || "").trim();
  if (!s) return "Verified Guest";
  // luxury privacy: first name + initial only
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase() + parts[0].slice(1);
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

export default function ReviewsPanel({
  listingId,
  user,
  onRequireLogin,
  onAggregateUpdate,
}) {
  const uid = user?.uid || null;

  const [loading, setLoading] = useState(true);
  const [loadPath, setLoadPath] = useState("subcollection"); // subcollection | top
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  // form state
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState("");

  const canPost = useMemo(() => !!uid, [uid]);

  const aliveRef = useRef(true);
  const unsubRef = useRef(null);
  const timeoutRef = useRef(null);

  const stopLoading = useCallback(() => {
    if (!aliveRef.current) return;
    setLoading(false);
  }, []);

  const clearPostMsgSoon = useCallback(() => {
    window.clearTimeout(clearPostMsgSoon._t);
    clearPostMsgSoon._t = window.setTimeout(() => setPostMsg(""), 2400);
  }, []);
  // eslint-disable-next-line
  clearPostMsgSoon._t = clearPostMsgSoon._t || null;

  // ─────────────────────────────────────────────────────────────
  // Load reviews (subcollection first, fallback to top-level)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;

    if (!listingId) {
      setRows([]);
      setError("Missing listingId.");
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError("");
    setRows([]);

    // cleanup old listener + timeout
    try {
      unsubRef.current && unsubRef.current();
    } catch {}
    unsubRef.current = null;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    const attachTopLevel = (subErr) => {
      if (!aliveRef.current) return;
      setLoadPath("top");

      const qRef = query(
        collection(db, "reviews"),
        where("listingId", "==", listingId),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubRef.current = onSnapshot(
        qRef,
        (snap) => {
          if (!aliveRef.current) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRows(list);
          stopLoading();
        },
        (e) => {
          console.error("[ReviewsPanel] top-level listener failed:", e);

          const msg = String(e?.message || "");
          const friendly =
            msg.includes("Missing or insufficient permissions")
              ? "Reviews can’t load due to Firestore permissions. Please update rules to allow public review reads."
              : msg.toLowerCase().includes("index")
              ? "This reviews query needs a Firestore index. Open the console error and create the suggested index."
              : "Reviews failed to load. Check Firestore rules/indexes and network.";

          setError(friendly);
          stopLoading();

          if (subErr) console.warn("[ReviewsPanel] subcollection error was:", subErr);
        }
      );
    };

    const attachSubcollection = () => {
      if (!aliveRef.current) return;
      setLoadPath("subcollection");

      const qRef = query(
        collection(db, "listings", listingId, "reviews"),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubRef.current = onSnapshot(
        qRef,
        (snap) => {
          if (!aliveRef.current) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRows(list);
          stopLoading();
        },
        (e) => {
          console.warn("[ReviewsPanel] subcollection listener failed:", e);
          attachTopLevel(e);
        }
      );
    };

    attachSubcollection();

    // hard-stop safety timeout
    timeoutRef.current = window.setTimeout(() => {
      if (!aliveRef.current) return;
      setLoading((prev) => {
        if (!prev) return prev;
        setError((curr) => curr || "Reviews are taking too long to load. Check Firestore console errors.");
        return false;
      });
    }, 8000);

    return () => {
      aliveRef.current = false;
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      try {
        unsubRef.current && unsubRef.current();
      } catch {}
      unsubRef.current = null;
    };
  }, [listingId, stopLoading]);

  // ─────────────────────────────────────────────────────────────
  // Aggregate rating (avg + count) -> notify parent
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const valid = (rows || [])
      .map((r) => Number(r?.rating || 0))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

    const count = valid.length;
    const avg = count ? valid.reduce((a, b) => a + b, 0) / count : 0;

    if (typeof onAggregateUpdate === "function") {
      onAggregateUpdate({
        ratingAvg: count ? Number(avg.toFixed(2)) : 0,
        ratingCount: count,
      });
    }
  }, [rows, onAggregateUpdate]);

  // ─────────────────────────────────────────────────────────────
  // Post review (one-review-per-user)
  // ─────────────────────────────────────────────────────────────
  const onPost = useCallback(async () => {
    try {
      setPostMsg("");

      if (!listingId) return;

      if (!uid) {
        if (typeof onRequireLogin === "function") onRequireLogin();
        return;
      }

      const r = clampRating(rating);
      const body = String(text || "").trim();

      if (!body) {
        setPostMsg("Please write a short review.");
        clearPostMsgSoon();
        return;
      }

      setPosting(true);

      const payload = {
        listingId,
        userId: uid,
        rating: r,
        text: body,
        displayName: safeName(user), // ✅ keeps visitor view private; no users_public needed
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (loadPath === "top") {
        // deterministic id avoids duplicates across sessions
        const topId = `${listingId}_${uid}`;
        await setDoc(doc(db, "reviews", topId), payload, { merge: true });
      } else {
        // enforce one-review-per-user for subcollection
        await setDoc(doc(db, "listings", listingId, "reviews", uid), payload, { merge: true });
      }

      setText("");
      setRating(5);
      setPostMsg("Review posted ✅");
      clearPostMsgSoon();
    } catch (e) {
      console.error("[ReviewsPanel] post failed:", e);
      const msg = String(e?.message || "");
      setPostMsg(
        msg.includes("Missing or insufficient permissions")
          ? "You don’t have permission to post reviews (Firestore rules)."
          : "Couldn’t post review. Please try again."
      );
      clearPostMsgSoon();
    } finally {
      setPosting(false);
    }
  }, [listingId, uid, rating, text, user, onRequireLogin, clearPostMsgSoon, loadPath]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  const count = rows.length;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 motion-pop">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily:
                'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", serif',
            }}
          >
            Reviews
          </h2>
          <p className="text-xs text-white/55 mt-1">
            {count ? `${count} review${count === 1 ? "" : "s"}` : "No reviews yet"}
          </p>
        </div>

        <div className="text-[10px] text-white/35">
          Source: {loadPath === "top" ? "reviews" : `listings/${listingId}/reviews`}
        </div>
      </div>

      {/* Luxury best practice: visitors can READ, but only signed-in can WRITE */}
      {!canPost ? (
        <div className="mt-4 rounded-2xl px-4 py-3 text-xs border border-white/10 bg-black/20 text-white/70">
          You can read reviews as a visitor. Sign in to leave a review after a confirmed booking.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl px-4 py-3 text-xs border border-white/10 bg-black/20 text-white/70">
          Reviews can be posted after a confirmed booking.
        </div>
      )}

      {/* Form: keep visible but disabled for visitors (you can hide if you prefer) */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-sm text-white/75">Your rating</div>
          <div className="flex items-center gap-2">
            <StarRating value={rating} onChange={setRating} size={18} />
            <div className="text-sm text-white/75">{Number(rating).toFixed(1)}</div>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={!canPost || posting}
          placeholder={canPost ? "Share what you loved (or what can improve)..." : "Sign in to write a review."}
          className={`w-full rounded-2xl px-4 py-3 outline-none border ${
            !canPost ? "bg-black/10 border-white/5 text-white/30" : "bg-black/20 border-white/10 text-white/80"
          }`}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-white/55">Keep it helpful and respectful.</div>

          <button
            onClick={onPost}
            disabled={!canPost || posting || !text.trim()}
            className={`px-5 py-2 rounded-full text-sm font-semibold border ${
              !canPost || posting || !text.trim()
                ? "bg-white/5 border-white/10 text-white/35 cursor-not-allowed"
                : "bg-amber-500 border-amber-400/40 text-black hover:bg-amber-400 btn-amber"
            }`}
          >
            {posting ? "Posting…" : "Post review"}
          </button>
        </div>

        {postMsg ? <div className="text-xs text-amber-200/90">{postMsg}</div> : null}
      </div>

      {/* List */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="text-sm text-white/60">Loading reviews…</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : count === 0 ? (
          <div className="text-sm text-white/60">No reviews yet.</div>
        ) : (
          rows.map((r) => {
            const who = String(r?.displayName || "Verified Guest").trim() || "Verified Guest";
            const when = fmtTime(r?.createdAt);
            const rate = clampRating(r?.rating || 0);

            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-white/85">{who}</div>
                    <div className="text-[11px] text-white/45">{when}</div>
                  </div>
                  <div className="shrink-0">
                    <StarRating value={rate} readOnly size={14} />
                  </div>
                </div>

                <div className="mt-2 text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                  {String(r?.text || "").trim() || "—"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
