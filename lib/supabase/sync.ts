"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isRagTable } from "@/lib/rag/constants";
import { queueRagIndexSync } from "@/lib/rag/client";

const tableFingerprints = new Map<string, Map<string, string>>();

export async function syncTableById<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  toRow: (row: T) => Record<string, unknown>
) {
  const rowPayloads = rows.map((row) => ({
    id: row.id,
    payload: toRow(row),
  }));

  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id");

  if (selectError) {
    throw new Error(`[${table}] select failed: ${selectError.message}`);
  }

  const currentIds = rows.map((row) => row.id);
  const existingIds = (existingRows || []).map((row) => row.id as string);
  const deletedIds = existingIds.filter((id) => !currentIds.includes(id));
  const previousFingerprints = tableFingerprints.get(table) || new Map();
  const nextFingerprints = new Map<string, string>();

  rowPayloads.forEach(({ id, payload }) => {
    nextFingerprints.set(id, JSON.stringify(payload));
  });

  const changedRows = rowPayloads
    .filter(({ id, payload }) => {
      const nextFingerprint = JSON.stringify(payload);
      return previousFingerprints.get(id) !== nextFingerprint;
    })
    .map(({ payload }) => payload);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(rowPayloads.map((row) => row.payload), { onConflict: "id" });

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

  tableFingerprints.set(table, nextFingerprints);

  if (isRagTable(table) && (changedRows.length > 0 || deletedIds.length > 0)) {
    queueRagIndexSync(table, changedRows, deletedIds);
  }
}
