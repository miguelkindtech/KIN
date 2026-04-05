"use client";

import { isRagTable } from "@/lib/rag/constants";

const INDEX_DELAY = 1500;

type PendingTableState = {
  rows: Map<string, Record<string, unknown>>;
  deletedIds: Set<string>;
  timeoutId: number | null;
};

const pendingIndexState = new Map<string, PendingTableState>();

async function flushQueuedIndex(table: string) {
  const pending = pendingIndexState.get(table);
  if (!pending) return;

  pending.timeoutId = null;

  const rows = Array.from(pending.rows.values());
  const deletedIds = Array.from(pending.deletedIds.values());

  pending.rows.clear();
  pending.deletedIds.clear();

  if (rows.length === 0 && deletedIds.length === 0) return;

  try {
    const response = await fetch("/api/rag/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table,
        rows,
        deletedIds,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      console.error("kind. AI indexing failed", payload || response.statusText);
    }
  } catch (error) {
    console.error("kind. AI indexing request failed", error);
  }
}

export function queueRagIndexSync(
  table: string,
  rows: Record<string, unknown>[] = [],
  deletedIds: string[] = []
) {
  if (!isRagTable(table) || (rows.length === 0 && deletedIds.length === 0)) {
    return;
  }

  const pending =
    pendingIndexState.get(table) ||
    {
      rows: new Map<string, Record<string, unknown>>(),
      deletedIds: new Set<string>(),
      timeoutId: null,
    };

  rows.forEach((row) => {
    const id = typeof row.id === "string" ? row.id : String(row.id || "");
    if (!id) return;
    pending.deletedIds.delete(id);
    pending.rows.set(id, row);
  });

  deletedIds.forEach((id) => {
    pending.rows.delete(id);
    pending.deletedIds.add(id);
  });

  if (pending.timeoutId) {
    window.clearTimeout(pending.timeoutId);
  }

  pending.timeoutId = window.setTimeout(() => {
    void flushQueuedIndex(table);
  }, INDEX_DELAY);

  pendingIndexState.set(table, pending);
}
