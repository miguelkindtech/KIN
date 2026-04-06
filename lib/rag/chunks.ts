import type { NoteBlock } from "@/lib/types";
import type { RagSourceType } from "@/lib/rag/constants";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtml(value: unknown) {
  if (typeof value !== "string" || !value) return "";

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeEntities(withoutTags));
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function listText(
  items: unknown[],
  mapper: (item: Record<string, unknown>) => string
) {
  if (!Array.isArray(items) || items.length === 0) return "none";

  const values = items
    .map((item) => normalizeWhitespace(mapper(item as Record<string, unknown>)))
    .filter(Boolean);

  return values.length > 0 ? values.join(" | ") : "none";
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function noteBlocksToText(blocks: unknown[]) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "none";

  const parts = blocks
    .map((block) => {
      const item = block as NoteBlock;

      switch (item.type) {
        case "table":
          return Array.isArray(item.rows)
            ? item.rows
                .map((row) => row.map((cell) => normalizeWhitespace(cell)).join(" | "))
                .join(" ; ")
            : "";
        case "image":
        case "pdf":
          return normalizeWhitespace(
            `${item.name || item.caption || item.src || item.path || ""}`
          );
        case "note_link":
          return normalizeWhitespace(`linked note ${item.noteId || ""}`);
        case "entity_link":
          return normalizeWhitespace(`linked entity ${item.entity || ""}`);
        case "divider":
          return "";
        default:
          return stripHtml(item.text || "");
      }
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "none";
}

export function buildChunk(
  sourceType: RagSourceType,
  data: Record<string, unknown>
) {
  switch (sourceType) {
    case "vertical":
      return normalizeWhitespace(`Vertical Solution: ${data.name || "untitled"}
Status: ${data.status || "unknown"} | Health: ${data.health || "unknown"} | Phase: ${data.phase || "unknown"}
Summary: ${stripHtml(data.summary) || "none"}
Description: ${stripHtml(data.description) || "none"}
Partner: ${stripHtml(data.partner) || "none"}
Owner: ${data.owner_id || "unassigned"}
Milestones: ${listText(toArray(data.milestones), (milestone) => `${asText(milestone?.title, "untitled")} (${asText(milestone?.status, "pending")}) due ${asText(milestone?.dueDate || milestone?.due_date, "unscheduled")}`)}
Documents: ${listText(toArray(data.docs), (doc) => `${asText(doc?.name, "document")} ${asText(doc?.type)}`)}
Internal notes: ${listText(toArray(data.notes_list), (note) => `${asText(note?.title, "note")}: ${stripHtml(note?.content || note?.body || "") || "empty"}`)}`);

    case "b2a":
      return normalizeWhitespace(`Applied Company: ${data.company || "untitled"}
Status: ${data.status || "unknown"}
Summary: ${stripHtml(data.summary) || "none"}
Operation notes: ${stripHtml(data.notes) || "none"}
Applied strategy: ${stripHtml(data.challenge) || "none"}
Solutions: ${listText(toArray(data.notes_list), (note) => `${asText(note?.title, "solution")}: ${stripHtml(note?.content || note?.body || "") || "empty"}`)}
Documents: ${listText(toArray(data.docs), (doc) => `${asText(doc?.name, "document")} ${asText(doc?.type)}`)}`);

    case "note":
      return normalizeWhitespace(`Company Note (${data.category || "explore"}): ${data.title || "untitled"}
Description: ${stripHtml(data.description) || "none"}
Linked to: ${data.linked_to || "none"}
Content: ${noteBlocksToText(toArray(data.blocks))}`);

    case "cost":
      return normalizeWhitespace(`Cost: ${data.name || "untitled"}
Amount: EUR ${data.amount || 0} (${data.billing || "monthly"})
Category: ${data.category || "uncategorised"}
Owner: ${data.owner_id || "unassigned"}
Active: ${data.active === false ? "no" : "yes"}`);

    case "team":
      return normalizeWhitespace(`Team Member: ${data.name || "untitled"}
Role: ${data.role || "unknown"}
Type: ${data.type || "team"}
Status: ${data.status || "active"}
Focus: ${stripHtml(data.focus) || "none"}`);

    case "event": {
      const linkedTo = data.linked_to || "none";
      const schedule =
        data.start_time && data.end_time
          ? `${data.start_time} to ${data.end_time}`
          : "all day";

      return normalizeWhitespace(`Event: ${data.title || "untitled"}
Date: ${data.date || "unscheduled"}
Time: ${schedule}
Linked to: ${linkedTo}
Notes: ${stripHtml(data.description) || "none"}
Attachments: ${listText(toArray(data.attachments), (attachment) => asText(attachment?.name, "attachment"))}`);
    }

    case "day_note":
      return normalizeWhitespace(`Day Note: ${data.date || "unknown date"}
Notes: ${stripHtml(data.content) || "none"}
Todos: ${listText(toArray(data.todos), (todo) => `${asText(todo?.text, "todo")} (${todo?.done ? "done" : "open"})`)}`);

    default:
      return "";
  }
}
