// src/components/NestaNgAIChat.js
// NestaNg Concierge AI — Luxury theme
// All logic identical to original. Visual only changed.
// Design: dark ink panel, Cormorant Garamond display, DM Sans body,
// amber gold accents, silk-shimmer loading, subtle gold rule dividers.

import { useMemo, useRef, useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";

const WELCOME_MESSAGE = {
  role: "ai",
  text: "Welcome to NestaNg. I'm your digital concierge. How may I assist you today?",
};

const QUICK_ACTIONS = [
  "How do I list my property?",
  "How do payouts work?",
  "How can I cancel a booking?",
];

/* ─── Inline styles (no external CSS dependency) ─── */
const S = {
  /* Floating trigger button */
  trigger: {
    position: "fixed",
    bottom: 28,
    right: 28,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 20px 12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(201,168,76,0.45)",
    background: "linear-gradient(135deg, #0e1118 0%, #050709 100%)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  triggerLogo: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(201,168,76,0.3)",
  },
  triggerText: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: "#c9a84c",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },

  /* Panel */
  panel: {
    position: "fixed",
    bottom: 90,
    right: 28,
    zIndex: 9998,
    width: 380,
    maxHeight: "calc(100vh - 120px)",
    display: "flex",
    flexDirection: "column",
    borderRadius: 22,
    border: "1px solid rgba(201,168,76,0.22)",
    background: "linear-gradient(160deg, rgba(14,17,24,0.98) 0%, rgba(7,9,14,0.99) 100%)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    overflow: "hidden",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  /* Header */
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px 16px",
    borderBottom: "1px solid rgba(201,168,76,0.12)",
    background: "rgba(0,0,0,0.2)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(201,168,76,0.35)",
    boxShadow: "0 0 12px rgba(201,168,76,0.15)",
  },
  headerTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 17,
    fontWeight: 600,
    color: "#f5f0e8",
    letterSpacing: "0.01em",
    lineHeight: 1.2,
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: 400,
    color: "#c9a84c",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s, color 0.15s",
    flexShrink: 0,
  },

  /* Tagline strip */
  strip: {
    padding: "10px 20px",
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.05em",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
    lineHeight: 1.5,
  },

  /* Messages */
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    scrollbarWidth: "none",
  },

  rowUser: {
    display: "flex",
    justifyContent: "flex-end",
  },
  rowAI: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    gap: 8,
  },

  /* AI avatar dot */
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid rgba(201,168,76,0.45)",
    background: "radial-gradient(circle at 35% 35%, rgba(201,168,76,0.25), rgba(201,168,76,0.05))",
    flexShrink: 0,
    marginBottom: 2,
  },

  bubbleUser: {
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    background: "linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.12))",
    border: "1px solid rgba(201,168,76,0.30)",
    fontSize: 13.5,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.90)",
    fontWeight: 400,
    wordBreak: "break-word",
  },
  bubbleAI: {
    maxWidth: "82%",
    padding: "10px 14px",
    borderRadius: "18px 18px 18px 4px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 13.5,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 300,
    wordBreak: "break-word",
  },

  /* Typing indicator */
  typingDots: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    padding: "12px 14px",
  },

  /* Quick action chips */
  quickActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "8px 16px 10px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  chip: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "1px solid rgba(201,168,76,0.20)",
    background: "rgba(201,168,76,0.06)",
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    fontWeight: 400,
    cursor: "pointer",
    textAlign: "left",
    letterSpacing: "0.01em",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
    lineHeight: 1.4,
  },

  /* Input area */
  inputWrap: {
    padding: "10px 14px 14px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  inputBox: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: "8px 8px 8px 14px",
    transition: "border-color 0.15s",
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 13.5,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: 300,
    resize: "none",
    lineHeight: 1.5,
    minHeight: 20,
    maxHeight: 100,
    overflowY: "auto",
    scrollbarWidth: "none",
  },
  sendBtn: {
    height: 34,
    padding: "0 16px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #e8c96b, #c9a84c)",
    color: "#120d02",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    letterSpacing: "0.04em",
    cursor: "pointer",
    transition: "filter 0.15s, transform 0.1s",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.25)",
    cursor: "not-allowed",
  },

  inputHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.20)",
    letterSpacing: "0.04em",
    textAlign: "center",
    marginTop: 7,
  },
};

/* ─── Typing dots animation ─── */
function TypingDots() {
  return (
    <div className="nestang-ai-row ai" style={S.rowAI}>
      <div style={S.aiAvatar} />
      <div style={{ ...S.bubbleAI, padding: "12px 14px" }}>
        <style>{`
          @keyframes nestaDot {
            0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
            30% { opacity: 1; transform: translateY(-3px); }
          }
          .nesta-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #c9a84c; margin: 0 2px; animation: nestaDot 1.2s ease infinite; }
          .nesta-dot:nth-child(2) { animation-delay: 0.15s; }
          .nesta-dot:nth-child(3) { animation-delay: 0.30s; }
          .nestang-ai-panel textarea::placeholder { color: rgba(255,255,255,0.28); }
          .nestang-ai-panel *::-webkit-scrollbar { display: none; }
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        `}</style>
        <span className="nesta-dot" />
        <span className="nesta-dot" />
        <span className="nesta-dot" />
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function NestaNgAIChat() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  const canSend = useMemo(
    () => message.trim().length > 0 && !loading,
    [message, loading]
  );

  const hasUserMessage = messages.some((m) => m.role === "user");

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 120);
    }
  }, [open]);

  async function sendMessage(prefilledMessage) {
    const trimmed = (prefilledMessage ?? message).trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/nesta-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          text?.startsWith("<!DOCTYPE")
            ? "NestaNg Concierge AI could not connect to the backend. Please check the server is running."
            : text.slice(0, 160) || "Server returned a non-JSON response."
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to reach NestaNg Concierge AI.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data?.reply || "I'm sorry, I couldn't generate a response just now." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: err?.message || "I'm sorry, I'm having trouble responding right now. Please try again shortly." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        type="button"
        style={S.trigger}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 14px 44px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.22), inset 0 1px 0 rgba(255,255,255,0.05)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = S.trigger.boxShadow; }}
        aria-label={open ? "Close NestaNg Concierge AI" : "Open NestaNg Concierge AI"}
      >
        <img
          src="/nestangconcierge-logo.png"
          alt="NestaNg"
          style={S.triggerLogo}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span style={S.triggerText}>
          {open ? "Close Concierge" : "NestaNg Concierge AI"}
        </span>
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <img
                src="/nestangconcierge-logo.png"
                alt="NestaNg logo"
                style={S.headerLogo}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div>
                <div style={S.headerTitle}>NestaNg Concierge AI</div>
                <div style={S.headerSubtitle}>Luxury digital concierge</div>
              </div>
            </div>
            <button
              type="button"
              style={S.closeBtn}
              onClick={() => setOpen(false)}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = S.closeBtn.background; e.currentTarget.style.color = S.closeBtn.color; }}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Tagline strip */}
          <div style={S.strip}>
            Ask about bookings, listings, payouts, verification, cancellations &amp; platform guidance.
          </div>

          {/* Messages */}
          <div style={S.messages}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={`${m.role}-${i}`}
                  style={isUser ? S.rowUser : S.rowAI}
                >
                  {!isUser && <div style={S.aiAvatar} />}
                  <div style={isUser ? S.bubbleUser : S.bubbleAI}>
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && <TypingDots />}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick action chips — shown until first user message */}
          {!hasUserMessage && (
            <div style={S.quickActions}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2, paddingLeft: 2 }}>
                Suggested
              </div>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  style={S.chip}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,168,76,0.12)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = S.chip.background; e.currentTarget.style.borderColor = S.chip.border.split(" ").pop(); e.currentTarget.style.color = S.chip.color; }}
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={S.inputWrap}>
            <div style={{
              ...S.inputBox,
              borderColor: inputFocused ? "rgba(201,168,76,0.40)" : "rgba(255,255,255,0.10)",
              boxShadow: inputFocused ? "0 0 0 3px rgba(201,168,76,0.07)" : "none",
            }}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                rows={1}
                placeholder="Ask NestaNg Concierge…"
                style={S.textarea}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!canSend}
                style={{
                  ...S.sendBtn,
                  ...(canSend ? {} : S.sendBtnDisabled),
                }}
                onMouseEnter={(e) => { if (canSend) { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
              >
                Send
              </button>
            </div>
            <div style={S.inputHint}>Press Enter to send · Shift + Enter for new line</div>
          </div>

        </div>
      )}
    </>
  );
}