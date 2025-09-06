import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc
} from "firebase/firestore";
import { db } from "../firebase";

export default function ChatPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const threadId = useMemo(() => {
    if (!user || !listingId) return null;
    return `${listingId}_${user.uid}`;
  }, [user, listingId]);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true, state: { next: `/chat/${listingId}` } });
      return;
    }
  }, [user, listingId, navigate]);

  // Load listing
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "listings", listingId));
        if (snap.exists()) setListing({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.warn("Failed to load listing:", e);
      }
    })();
  }, [listingId]);

  // Ensure thread exists and subscribe to messages
  useEffect(() => {
    if (!threadId || !user) return;

    (async () => {
      try {
        // create thread doc if missing
        await setDoc(
          doc(db, "threads", threadId),
          {
            listingId,
            participants: [user.uid], // add host uid when you have it
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Failed to create thread:", e);
      }
    })();

    const q = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setMessages(rows);
    });
    return () => unsub();
  }, [threadId, user, listingId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !threadId) return;
    try {
      await addDoc(collection(db, "threads", threadId, "messages"), {
        text: text.trim(),
        senderUid: user.uid,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      console.warn("Failed to send message:", e);
    }
  };

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>

        <div className="card" style={{ marginTop: 16, padding: 16, borderRadius: 16 }}>
          <h1 style={{ margin: 0 }}>Chat about: {listing?.title || "Listing"}</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            {listing?.area} • ₦{Number(listing?.price || 0).toLocaleString()}/night
          </div>

          <div
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              height: 420,
              overflow: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 ? (
              <div className="muted">No messages yet. Start the conversation.</div>
            ) : (
              messages.map((m) => {
                const mine = m.senderUid === user?.uid;
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: mine ? "flex-end" : "flex-start",
                      background: mine ? "rgba(240,180,41,0.18)" : "rgba(255,255,255,0.10)",
                      border: mine ? "1px solid rgba(240,180,41,0.35)" : "1px solid rgba(255,255,255,0.18)",
                      color: "#e5e7eb",
                      padding: "8px 10px",
                      borderRadius: 10,
                      maxWidth: "70%",
                    }}
                  >
                    {m.text}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={sendMessage} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}>
            <input
              className="input"
              placeholder="Write a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" type="submit">Send</button>
          </form>

          <p className="muted" style={{ marginTop: 8 }}>
            For safety, sharing phone numbers or emails here is blocked unless you have an active subscription.
          </p>
        </div>
      </div>
    </main>
  );
}