// src/pages/ChatStart.js
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function ChatStart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const listingId = params.get("listing") || "";
  const hostUid = params.get("host") || "";

  const [err, setErr] = useState("");

  useEffect(() => {
    const go = async () => {
      if (!user) {
        navigate("/signup", { replace: true, state: { next: `/chat/new?listing=${listingId}&host=${hostUid}` } });
        return;
      }
      if (!listingId || !hostUid) {
        setErr("Missing listing or host information.");
        return;
      }

      try {
        // Try to find an existing thread
        const q = query(
          collection(db, "threads"),
          where("listingId", "==", listingId),
          where("participants", "array-contains", user.uid),
          limit(10)
        );
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => {
          const data = d.data();
          return Array.isArray(data.participants) && data.participants.includes(hostUid);
        });

        if (existing) {
          navigate(`/chat/${existing.id}`, { replace: true });
          return;
        }

        // Create a new thread
        const docRef = await addDoc(collection(db, "threads"), {
          listingId,
          participants: [user.uid, hostUid].filter(Boolean),
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: "",
        });

        navigate(`/chat/${docRef.id}`, { replace: true });
      } catch (e) {
        console.error(e);
        setErr("Could not start chat.");
      }
    };
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <div className="form-card" style={{ textAlign: "center" }}>
          <h1>Preparing your chat…</h1>
          {err ? <p className="alert-error" style={{ marginTop: 10 }}>{err}</p> : <p className="muted">Just a moment.</p>}
        </div>
      </div>
    </main>
  );
}