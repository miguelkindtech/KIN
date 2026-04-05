"use client";

import { useState } from "react";

export default function ReindexButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleReindex() {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/reindex", {
        method: "POST",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "kind. AI reindex failed.");
      }

      setStatus("success");
      setMessage(payload?.message || "kind. AI index refreshed.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "kind. AI reindex failed."
      );
    }
  }

  return (
    <div className="setup-reindex">
      <button
        className="action-btn"
        disabled={status === "loading"}
        onClick={() => void handleReindex()}
        type="button"
      >
        {status === "loading" ? "reindexing..." : "run kind. AI reindex"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
