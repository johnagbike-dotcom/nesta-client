// src/components/ReviewsPanel.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import StarRating from "./StarRating";

/**
 * Reviews live under:
 * listings/{listingId}/reviews/{uid}
 *
 * Review doc shape:
 * {
 *   uid, displayName, rating (1..5), text,
 *   createdAt, updatedAt
 * }
 */
export default function ReviewsPanel({
  listingId,
  user,
  onRequireLogin,
  onAggregateUpdate,
}) {
  const uid = user?.uid || null;

  const [rows, setRows] = useState([]);
  const [myReview, setMyReview] = useState(null);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Live load reviews
  useEffect(() => {
    if (!listingId) return;

    const qRef = query(
      collection(db, "listings", listingId, "reviews"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(list);

        const mine = uid ? list.find((x) => x.id === uid) : null;
        setMyReview(mine || null);

        // Push aggregates up for instant UI refresh
        const ratings = list.map((x) => Number(x.rating || 0)).filter((n) => n > 0);
        const count = ratings.length;
        const avg = count ? ratings.reduce((a, b) => a + b, 0) / count : 0;

        if (typeof onAggregateUpdate === "function") {
          onAggregateUpdate({
            ratingAvg: count ? Math.round(avg * 10) / 10 : 0,
            ratingCount: count,
          });
        }
      },
      () => {
        setRows([]);
        setMyReview(null);
        if (typeof onAggregateUpdate === "function") {
          onAggregateUpdate({ ratingAvg: 0, ratingCount: 0 });
        }
      }
    );

    return () => unsub();
  }, [listingId, uid, onAggregateUpdate]);

  // If user already has a review, prefill editor
  useEffect(() => {
    if (!myReview) return;
    setRating(Number(myReview.rating || 0));
    setText(String(myReview.text || ""));
  }, [myReview]);

  const agg = useMemo(() => {
    const ratings = rows.map((x) => Number(x.rating || 0)).filter((n) => n > 0);
    const count = ratings.length;
    const avg = count ? ratings.reduce((a, b) => a + b, 0) / count : 0;
    return { avg: count ? Math.round(avg * 10) / 10 : 0, count };
  }, [rows]);

  const fireMsg = useCallback((t) => {
    setMsg(t);
    window.clearTimeout(fireMsg._t);
    fireMsg._t = window.setTimeout(() => setMsg(""), 2200);
  }, []);
  // eslint-disable-next-line
  fireMsg._t = fireMsg._t || null;

  const submit = useCallback(async () => {
    if (!listingId) return;

    if (!uid) {
      if (typeof onRequireLogin === "function") onRequireLogin();
      else fireMsg("Please log in to leave a review.");
      return;
    }

    const r = Number(rating || 0);
    if (r < 1 || r > 5) {
      fireMsg("Please select a star rating (1–5).");
      return;
    }

    const cleaned = String(text || "").trim();
    if (cleaned.length < 6) {
      fireMsg("Please write a short review (at least 6 characters).");
      return;
    }

    try {
      setSaving(true);

      const ref = doc(db, "listings", listingId, "reviews", uid);

      // createAt only once; updatedAt always
      await setDoc(
        ref,
        {
          uid,
          displayName: user?.displayName || user?.email || "Guest",
          rating: r,
          text: cleaned,
          createdAt: myReview?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      fireMsg(myReview ? "Review updated ✅" : "Review posted ✅");
    } catch (e) {
      console.error("[ReviewsPanel] submit failed:", e);
      fireMsg("Could not save your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [listingId, uid, rating, text, user, myReview, onRequireLogin, fireMsg]);

  const canEdit = !!uid;

  return (
    <section className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
            {agg.count > 0 ? `${agg.avg.toFixed(1)} • ${agg.count} review${agg.count === 1 ? "" : "s"}` : "No reviews yet"}
          </p>
        </div>
      </div>

      {/* editor */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-white/85">
            {myReview ? "Update your review" : "Leave a review"}
          </div>

          <div className="flex items-center gap-2">
            <StarRating
              value={rating}
              onChange={(v) => canEdit && setRating(v)}
              readOnly={!canEdit}
              size={16}
              showValue={false}
            />
            <span className="text-xs text-white/55">
              {rating ? `${rating}/5` : "Select"}
            </span>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            uid
              ? "Share a quick, honest experience…"
              : "Log in to write a review…"
          }
          disabled={!uid}
          rows={3}
          className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-amber-400/60 disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-white/55">{msg}</div>

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-60 text-sm"
          >
            {saving ? "Saving…" : myReview ? "Update review" : "Post review"}
          </button>
        </div>
      </div>

      {/* list */}
      {rows.length === 0 ? (
        <div className="text-sm text-white/60">
          Be the first to review this stay.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 8).map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-white/10 bg-black/15 p-3 md:p-4"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold text-white/85 truncate">
                  {r.displayName || "Guest"}
                </div>
                <StarRating value={Number(r.rating || 0)} readOnly size={14} showValue />
              </div>
              <p className="text-sm text-white/75 mt-2 whitespace-pre-wrap">
                {String(r.text || "").trim()}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
