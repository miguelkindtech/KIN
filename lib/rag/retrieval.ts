import { createAdminClient } from "@/lib/supabase/admin";
import { buildChunk } from "@/lib/rag/chunks";
import {
  RAG_TABLES,
  TABLE_TO_SOURCE_TYPE,
  type RagSourceType,
} from "@/lib/rag/constants";

export type RetrievedChunk = {
  id: string;
  source_type: RagSourceType;
  source_id: string;
  chunk_text: string;
  similarity: number;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTerms(query: string) {
  const stopWords = new Set([
    "a",
    "about",
    "any",
    "as",
    "at",
    "da",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "for",
    "how",
    "informacao",
    "information",
    "is",
    "me",
    "o",
    "of",
    "on",
    "os",
    "para",
    "qual",
    "que",
    "sobre",
    "state",
    "the",
    "this",
    "uma",
    "what",
    "whats",
  ]);

  return normalize(query)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stopWords.has(term));
}

function lexicalScore(query: string, chunkText: string) {
  const normalizedQuery = normalize(query);
  const normalizedChunk = normalize(chunkText);
  const terms = extractTerms(query);

  let score = 0;

  if (!normalizedChunk) return 0;

  if (normalizedQuery && normalizedChunk.includes(normalizedQuery)) {
    score += 1.2;
  }

  terms.forEach((term) => {
    if (normalizedChunk.includes(term)) {
      score += 0.35;
    }
  });

  const chunkWords = new Set(normalizedChunk.split(" "));
  terms.forEach((term) => {
    if (chunkWords.has(term)) {
      score += 0.2;
    }
  });

  return score;
}

export async function keywordRetrieve(query: string, limit = 8) {
  const supabase = createAdminClient();

  const tableResults = await Promise.all(
    RAG_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*");

      if (error) {
        console.error(`[kind-ai] keyword retrieval failed for ${table}`, error);
        return [];
      }

      const sourceType = TABLE_TO_SOURCE_TYPE[table];

      return (data || [])
        .map((row) => {
          const sourceId = String(row.id || "");
          const chunkText = buildChunk(sourceType, row as Record<string, unknown>);
          const similarity = lexicalScore(query, chunkText);

          if (!sourceId || !chunkText || similarity <= 0) {
            return null;
          }

          return {
            id: `${sourceType}:${sourceId}`,
            source_type: sourceType,
            source_id: sourceId,
            chunk_text: chunkText,
            similarity,
          } satisfies RetrievedChunk;
        })
        .filter((item): item is RetrievedChunk => Boolean(item));
    })
  );

  const combined: RetrievedChunk[] = tableResults
    .flat()
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return combined;
}

export function mergeRetrievedChunks(
  primary: RetrievedChunk[],
  fallback: RetrievedChunk[],
  limit = 8
) {
  const merged = new Map<string, RetrievedChunk>();

  [...primary, ...fallback].forEach((chunk) => {
    const existing = merged.get(chunk.id);

    if (!existing || chunk.similarity > existing.similarity) {
      merged.set(chunk.id, chunk);
    }
  });

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
