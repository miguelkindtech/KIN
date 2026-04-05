import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildChunk } from "@/lib/rag/chunks";
import {
  RAG_TABLES,
  TABLE_TO_SOURCE_TYPE,
  type RagSourceType,
  type RagTable,
} from "@/lib/rag/constants";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it before using kind. AI.");
  }

  return new OpenAI({ apiKey });
}

export async function indexEntity(
  sourceType: RagSourceType,
  sourceId: string,
  data: Record<string, unknown>
) {
  const chunkText = buildChunk(sourceType, data);
  const supabase = createAdminClient();

  if (!chunkText.trim()) {
    await supabase
      .from("kin_embeddings")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);
    return;
  }

  const openai = getOpenAIClient();
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunkText,
  });

  const embedding = embeddingResponse.data[0]?.embedding;

  if (!embedding) {
    throw new Error(`Embedding generation returned no vector for ${sourceType}:${sourceId}`);
  }

  const { error } = await supabase.from("kin_embeddings").upsert(
    {
      source_type: sourceType,
      source_id: sourceId,
      chunk_text: chunkText,
      embedding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_type,source_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert embedding for ${sourceType}:${sourceId}: ${error.message}`);
  }
}

export async function indexRowsForTable(
  table: RagTable,
  rows: Record<string, unknown>[]
) {
  const sourceType = TABLE_TO_SOURCE_TYPE[table];

  for (const row of rows) {
    if (!row?.id) continue;
    await indexEntity(sourceType, String(row.id), row);
  }
}

export async function removeIndexedRows(table: RagTable, sourceIds: string[]) {
  if (sourceIds.length === 0) return;

  const supabase = createAdminClient();
  const sourceType = TABLE_TO_SOURCE_TYPE[table];

  const { error } = await supabase
    .from("kin_embeddings")
    .delete()
    .eq("source_type", sourceType)
    .in("source_id", sourceIds);

  if (error) {
    throw new Error(`Failed to remove embeddings for ${table}: ${error.message}`);
  }
}

export async function reindexAll() {
  const supabase = createAdminClient();

  for (const table of RAG_TABLES) {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
      throw new Error(`Failed to load ${table} for reindex: ${error.message}`);
    }

    await indexRowsForTable(table, (data || []) as Record<string, unknown>[]);
  }
}
