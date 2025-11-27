// src/components/UnreadChatButton.js
import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import { threadSignature } from "../api/chats";

export default function UnreadChatButton({ me, hostId, listingId, onClick, disabled }) {
  const [unread, setUnread] = useState(0);

  const chatId = useMemo(() => {
    if (!me || !hostId || !listingId) return "";
    return threadSignature(listingId, [me, hostId]);
  }, [me, hostId, listingId]);

  useEffect(() => {
    if (!chatId) return;

    const threadRef = doc(db, "chatThreads", chatId);
    const msgsRef = collection(db, "chatThreads", chatId, "messages");

    let lastSeenMs = 0;
    const offThread = onSnapshot(threadRef, (snap) => {
      const data = snap.data() || {};
      const ts = data?.lastSeenAt?.[me];
      const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
      lastSeenMs = d ? +d : 0;
    });

    const q = query(msgsRef, orderBy("createdAt", "desc"), limit(30));
    const offMsgs = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach((d) => {
        const m = d.data();
        const t =
          m?.createdAt && typeof m.createdAt.toDate === "function"
            ? +m.createdAt.toDate()
            : 0;
        if (m?.senderId !== me && t > lastSeenMs) count += 1;
      });
      setUnread(count);
    });

    return () => {
      offThread();
      offMsgs();
    };
  }, [chatId, me]);

  const hasUnread = unread > 0;
  const badge = hasUnread ? (unread > 9 ? "9+" : String(unread)) : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="nesta-chat-btn"
      style={{
        position: "relative",
        background: disabled ? "rgba(255,255,255,0.08)" : "#ffbd0a",
        color: disabled ? "#9aa4b2" : "#111",
        fontWeight: 600,
        padding: "10px 18px",
        border: "none",
        borderRadius: 50,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: hasUnread
          ? "0 0 12px rgba(255, 189, 10, 0.5)"
          : "0 0 6px rgba(0,0,0,0.25)",
        transition: "all 0.25s ease",
      }}
    >
      Chat with Host/Partner
      {hasUnread && (
        <span
          style={{
            position: "absolute",
            top: -5,
            right: -6,
            background: "#ff4050",
            color: "#fff",
            borderRadius: 999,
            minWidth: 22,
            height: 22,
            lineHeight: "22px",
            fontSize: 12,
            textAlign: "center",
            fontWeight: 700,
            padding: "0 7px",
            boxShadow: "0 0 0 2px #0e0f12",
            transform: "scale(1)",
            animation: "pulseBadge 1.5s infinite ease-in-out",
          }}
        >
          {badge}
        </span>
      )}
      <style>
        {`
          @keyframes pulseBadge {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
          .nesta-chat-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 18px rgba(255, 189, 10, 0.8);
          }
        `}
      </style>
    </button>
  );
} 
