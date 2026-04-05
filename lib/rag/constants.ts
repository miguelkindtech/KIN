export const RAG_TABLES = [
  "verticals",
  "b2a",
  "notes",
  "costs",
  "team",
  "events",
  "day_notes",
] as const;

export type RagTable = (typeof RAG_TABLES)[number];

export type RagSourceType =
  | "vertical"
  | "b2a"
  | "note"
  | "cost"
  | "team"
  | "event"
  | "day_note";

export const TABLE_TO_SOURCE_TYPE: Record<RagTable, RagSourceType> = {
  verticals: "vertical",
  b2a: "b2a",
  notes: "note",
  costs: "cost",
  team: "team",
  events: "event",
  day_notes: "day_note",
};

export function isRagTable(value: string): value is RagTable {
  return RAG_TABLES.includes(value as RagTable);
}
