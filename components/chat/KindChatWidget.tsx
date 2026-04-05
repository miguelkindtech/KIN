"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { uid } from "@/lib/utils/uid";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources?: string[];
};

const SUGGESTIONS = [
  "What's the state of Compy?",
  "Any open B2A?",
  "What's happening this week?",
];

function KindAvatar({
  thinking = false,
  size = 20,
}: {
  thinking?: boolean;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`kind-chat-avatar${thinking ? " thinking" : ""}`}
      viewBox="0 0 40 40"
      width={size}
      height={size}
    >
      <circle className="kind-chat-avatar-shell" cx="20" cy="20" r="18" />
      <g className="kind-chat-avatar-dots">
        <circle cx="14.2" cy="17.4" r="2.6" />
        <circle cx="25.8" cy="17.4" r="2.6" />
      </g>
      <g className="kind-chat-avatar-crosses">
        <g transform="translate(14.2 17.4)">
          <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" />
          <line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5" />
        </g>
        <g transform="translate(25.8 17.4)">
          <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" />
          <line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5" />
        </g>
      </g>
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="kind-chat-loading" aria-label="kind. AI is thinking">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function KindChatWidget() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const shouldHide =
    pathname.startsWith("/login") || pathname.startsWith("/auth");

  useEffect(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isLoading, isOpen, messages]);

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || isLoading) return;

    const history = messages.map(({ role, content }) => ({
      role,
      content,
    }));

    setMessages((current) => [
      ...current,
      {
        id: uid(),
        role: "user",
        content: message,
      },
    ]);
    setInput("");
    setIsOpen(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "kind. AI could not answer.");
      }

      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content:
            typeof payload?.reply === "string" && payload.reply.trim()
              ? payload.reply
              : "I don't have that information in kind.",
          sources: Array.isArray(payload?.sources)
            ? payload.sources.filter(
                (item: unknown): item is string =>
                  typeof item === "string" && item.trim().length > 0
              )
            : [],
        },
      ]);
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "kind. AI could not answer right now.";

      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content: messageText,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close kind. AI" : "Open kind. AI"}
        className="kind-chat-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <KindAvatar thinking={isOpen} size={20} />
      </button>

      <div
        className={`kind-chat-panel${isOpen ? " open" : ""}`}
        role="dialog"
        aria-label="kind. AI"
      >
        <div className="kind-chat-header">
          <div className="kind-chat-header-title">kind. AI</div>
          <button
            aria-label="Close kind. AI"
            className="kind-chat-close"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="kind-chat-messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="kind-chat-empty">
              <KindAvatar size={40} />
              <p>Ask me anything about Kind Tech.</p>
              <div className="kind-chat-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="kind-chat-chip"
                    onClick={() => void sendMessage(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="kind-chat-thread">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div className="kind-chat-row user" key={message.id}>
                    <div className="kind-chat-bubble user">{message.content}</div>
                  </div>
                ) : (
                  <div className="kind-chat-row assistant" key={message.id}>
                    <span className="kind-chat-assistant-dot" />
                    <div className="kind-chat-assistant-copy">
                      <div className="kind-chat-bubble assistant">
                        {message.content}
                      </div>
                      {message.sources && message.sources.length > 0 ? (
                        <div className="kind-chat-sources">
                          {message.sources.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              )}

              {isLoading ? (
                <div className="kind-chat-row assistant">
                  <span className="kind-chat-assistant-dot" />
                  <div className="kind-chat-assistant-copy">
                    <LoadingDots />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="kind-chat-input-row">
          <input
            className="kind-chat-input"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="ask anything about kind."
            type="text"
            value={input}
          />
          <button
            aria-label="Send message"
            className="kind-chat-send"
            disabled={!input.trim() || isLoading}
            onClick={() => void sendMessage(input)}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M4 12h13"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
              <path
                d="M12 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
