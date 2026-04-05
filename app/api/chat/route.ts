import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveSourceLabels } from "@/lib/rag/labels";

export const runtime = "nodejs";

type MatchChunk = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_text: string;
  similarity: number;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it before using kind. AI.");
  }

  return new OpenAI({ apiKey });
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it before using kind. AI.");
  }

  return new Anthropic({ apiKey });
}

function sanitizeHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const role =
        item.role === "assistant" || item.role === "user" ? item.role : null;
      const content =
        typeof item.content === "string" ? item.content.trim() : "";

      if (!role || !content) return null;

      return {
        role,
        content,
      };
    })
    .filter((item): item is HistoryMessage => Boolean(item))
    .slice(-12);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const message = String(body?.message || "").trim();
    const history = sanitizeHistory(body?.history);

    if (!message) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    const anthropic = getAnthropicClient();
    const admin = createAdminClient();

    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });

    const queryEmbedding = embeddingRes.data[0]?.embedding;

    if (!queryEmbedding) {
      throw new Error("Failed to create a query embedding.");
    }

    const { data: chunks, error: matchError } = await admin.rpc(
      "match_embeddings",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.65,
        match_count: 8,
      }
    );

    if (matchError) {
      throw new Error(
        `Vector search failed. Run lib/rag/schema.sql and /api/reindex first. ${matchError.message}`
      );
    }

    const safeChunks = Array.isArray(chunks)
      ? (chunks as MatchChunk[])
      : [];

    const context = safeChunks
      .map((chunk) => String(chunk.chunk_text || "").trim())
      .filter(Boolean)
      .join("\n\n---\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are the internal AI assistant inside kind. — Kind Tech's executive workspace.
You answer exclusively from the internal company context below.
If the answer is not found in the data, say exactly: "I don't have that information in kind."
Be concise, direct and executive in tone.
Respond in the same language as the user.

INTERNAL KIND TECH DATA:
${context || "No relevant data found."}`,
      messages: [
        ...history,
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply =
      response.content.find((item) => item.type === "text")?.text.trim() ||
      "I don't have that information in kind.";

    const sources = await resolveSourceLabels(safeChunks);

    return Response.json({
      reply,
      sources,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "kind. AI could not answer.";
    return Response.json({ error: message }, { status: 500 });
  }
}
