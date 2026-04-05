import { createClient } from "@/lib/supabase/server";
import { indexRowsForTable, removeIndexedRows } from "@/lib/rag/indexer";
import { isRagTable } from "@/lib/rag/constants";

export const runtime = "nodejs";

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
    const table = String(body?.table || "");
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const deletedIds = Array.isArray(body?.deletedIds)
      ? body.deletedIds.map((id: unknown) => String(id))
      : [];

    if (!isRagTable(table)) {
      return Response.json({ error: "Unsupported RAG table." }, { status: 400 });
    }

    await indexRowsForTable(table, rows);
    await removeIndexedRows(table, deletedIds);

    return Response.json({
      ok: true,
      table,
      indexed: rows.length,
      deleted: deletedIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync kind. AI index.";
    return Response.json({ error: message }, { status: 500 });
  }
}
