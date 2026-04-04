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
    throw selectError;
  }

  const currentIds = rows.map((row) => row.id);
  const existingIds = (existingRows || []).map((row) => row.id as string);
  const deletedIds = existingIds.filter((id) => !currentIds.includes(id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(rows.map(toRow));

    if (upsertError) {
      throw upsertError;
    }
  }

  if (deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in("id", deletedIds);

    if (deleteError) {
      throw deleteError;
    }
  }
}
