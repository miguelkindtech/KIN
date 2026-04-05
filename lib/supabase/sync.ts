"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncTableById<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  toRow: (row: T) => Record<string, unknown>
) {
  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id");

  if (selectError) {
    throw new Error(`[${table}] select failed: ${selectError.message}`);
  }

  const currentIds = rows.map((row) => row.id);
  const existingIds = (existingRows || []).map((row) => row.id as string);
  const deletedIds = existingIds.filter((id) => !currentIds.includes(id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(rows.map(toRow), { onConflict: "id" });

    if (upsertError) {
      throw new Error(`[${table}] upsert failed: ${upsertError.message}`);
    }
  }

  if (deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in("id", deletedIds);

    if (deleteError) {
      throw new Error(`[${table}] delete failed: ${deleteError.message}`);
    }
  }
}
