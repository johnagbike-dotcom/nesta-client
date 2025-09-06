// src/pages/ChatRoom.js
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function ChatRoom() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    const loadThread = async () => {
      try {
        const snap = await getDoc(doc(db, "threads", threadId));
        if (!snap.exists()) {
          setLoadErr("Thread not found.");
          return;
        }
        setThread({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error(e);
        setLoadErr("Could not load thread.");
      }
    };
    loadThread();
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const q = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(arr);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => unsub();
  }, [threadId]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    try {
      await addDoc(collection(db, "threads", threadId, "messages"), {
        text: text.trim(),
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      console.error(e);
      alert("Failed to send message.");
    }
  };

  if (loadErr) {
    return (
      <main className="dash-bg">
        <div className="container dash-wrap">
          <p className="alert-error">{loadErr}</p>
          <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>

        <div className="form-card" style={{ marginTop: 16 }}>
          <h1 style={{ marginTop: 0 }}>Chat</h1>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              height: 380,
              overflowY: "auto",
              padding: 12,
            }}
          >
            {messages.length === 0 ? (
              <p className="muted">Say hello 👋</p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user?.uid;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: mine ? "linear-gradient(180deg, #f0b429, #d49d17)" : "rgba(255,255,255,0.08)",
                        color: mine ? "#111827" : "#e5e7eb",
                        border: mine ? "none" : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <input
              className="input"
              placeholder="Write a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Message"
            />
            <button className="btn" type="submit">Send</button>
          </form>
        </div>
      </div>
    </main>
  );
}