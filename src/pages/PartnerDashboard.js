import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import ListingCard from "../components/ListingCard";

export default function PartnerDashboard() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError("");
    setUsingFallback(false);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setListings([]);
        setLoading(false);
        return;
      }

      // Preferred (needs composite index): ownerId + updatedAt desc
      const base = collection(db, "listings");
      const q = query(
        base,
        where("ownerId", "==", uid),
        orderBy("updatedAt", "desc")
      );

      let snap;
      try {
        snap = await getDocs(q);
      } catch (e) {
        // If index is missing, fall back to a safe order
        setUsingFallback(true);
        const q2 = query(base, where("ownerId", "==", uid), orderBy("__name__"));
        snap = await getDocs(q2);
      }

      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setListings(rows);
    } catch (e) {
      setError(e?.message || "Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onDelete = async (l) => {
    // eslint-disable-next-line no-restricted-globals
    const ok = confirm(`Delete “${l.title}”? This can’t be undone.`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "listings", l.id));
      setListings((prev) => prev.filter((x) => x.id !== l.id));
    } catch (e) {
      alert(e?.message || "Delete failed.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Partner Dashboard</h1>
      </div>

      <div className="mb-4">
        <Link
          to="/create"
          className="text-sm text-indigo-300 hover:text-indigo-200 underline"
        >
          + Create new listing
        </Link>
      </div>

      {usingFallback && (
        <p className="text-xs text-amber-300 mb-3">
          Using fallback order until the Firestore index finishes building.
        </p>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-300">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-gray-300">
          You don’t have any listings yet.{" "}
          <Link to="/create" className="underline">
            Create your first listing →
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              actions={[
                { label: "View", to: `/listing/${l.id}` },
                { label: "Edit", to: `/edit/${l.id}` },
                { label: "Delete", onClick: () => onDelete(l), variant: "danger" },
              ]}
            />
          ))}
        </div>
      )}
    </div>
  );
}