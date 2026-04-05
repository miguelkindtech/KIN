"use client";

import Image from "next/image";
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

const CHAT_STORAGE_KEY = "kind-ai-chat-history";

const SUGGESTIONS = [
  "What's the state of Compy?",
  "Any open B2A?",
  "What's happening this week?",
];

function KindAvatar({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/kindAI.png"
      alt="kind. AI"
      width={size}
      height={size}
      className="kind-chat-avatar-image"
      priority={size >= 32}
    />
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
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const hydratedMessages = parsed
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const id =
            typeof item.id === "string" && item.id.trim() ? item.id : uid();
          const role =
            item.role === "assistant" || item.role === "user"
              ? item.role
              : null;
          const content =
            typeof item.content === "string" ? item.content.trim() : "";
          const sources = Array.isArray(item.sources)
            ? item.sources.filter(
                (source: unknown): source is string =>
                  typeof source === "string" && source.trim().length > 0
              )
            : [];

          if (!role || !content) return null;

          return {
            id,
            role,
            content,
            sources,
          } satisfies ChatMessage;
        })
        .reduce<ChatMessage[]>((accumulator, item) => {
          if (item) accumulator.push(item);
          return accumulator;
        }, [])
        .slice(-50);

      setMessages(hydratedMessages);
    } catch (error) {
      console.error("Failed to restore kind. AI chat history", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(messages.slice(-50))
      );
    } catch (error) {
      console.error("Failed to persist kind. AI chat history", error);
    }
  }, [messages]);

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
        className={`kind-chat-trigger${isOpen ? " open" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="kind-chat-trigger-logo">
          <KindAvatar size={20} />
        </span>
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
              <div className="kind-chat-empty-logo">
                <KindAvatar size={40} />
              </div>
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
