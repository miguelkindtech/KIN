import { createClient } from "@/lib/supabase/server";
import { RAG_TABLES } from "@/lib/rag/constants";
import { reindexAll } from "@/lib/rag/indexer";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await reindexAll();

    return Response.json({
      ok: true,
      message: "kind. AI index refreshed.",
      tables: RAG_TABLES,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reindex kind. AI.";
    return Response.json({ error: message }, { status: 500 });
  }
}
