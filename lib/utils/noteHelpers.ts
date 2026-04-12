import type { NoteBlock, NoteRecord } from "@/lib/types";
import { NOTE_COLORS } from "@/lib/constants";
import { uid } from "@/lib/utils/uid";

export function createBlock(
  type: NoteBlock["type"] = "text",
  extras: Partial<NoteBlock> = {}
): NoteBlock {
  const base: NoteBlock = { id: uid(), type };

  if (type === "todo") {
    return { ...base, text: "", details: "", checked: false, indent: 0, ...extras };
  }

  if (type === "divider") {
    return { ...base, ...extras };
  }

  if (type === "callout") {
    return { ...base, text: "", icon: "i", ...extras };
  }

  if (type === "code") {
    return { ...base, text: "", language: "", ...extras };
  }

  if (type === "table") {
    return { ...base, rows: [["", ""], ["", ""]], ...extras };
  }

  if (type === "image" || type === "pdf") {
    return { ...base, name: "", src: "", caption: "", ...extras };
  }

  if (type === "note_link") {
    return { ...base, noteId: "", ...extras };
  }

  if (type === "entity_link") {
    return { ...base, entity: "", ...extras };
  }

  return { ...base, text: "", ...extras };
}

export function normalizeBlock(block: Partial<NoteBlock>) {
  if (!block.type) return createBlock("text");
  return createBlock(block.type, block);
}

function stripTextHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function insertBlockAfter(
  blocks: NoteBlock[],
  afterId: string,
  type: NoteBlock["type"] = "text"
) {
  const next = [...blocks];
  const index = next.findIndex((block) => block.id === afterId);
  const block = createBlock(type);

  if (index < 0) return [...next, block];
  next.splice(index + 1, 0, block);
  return next;
}

export function replaceBlockType(block: NoteBlock, type: NoteBlock["type"]) {
  const carriedText = block.text || "";

  if (["heading1", "heading2", "heading3", "text"].includes(type)) {
    return createBlock(type, { text: carriedText });
  }

  if (type === "todo") {
    return createBlock("todo", { text: carriedText });
  }

  if (type === "callout") {
    return createBlock("callout", { text: carriedText });
  }

  if (type === "code") {
    return createBlock("code", { text: carriedText });
  }

  return createBlock(type);
}

export function notePreview(note: Pick<NoteRecord, "blocks">) {
  for (const block of note.blocks || []) {
    if (
      ["text", "heading1", "heading2", "heading3", "callout", "code", "todo"].includes(
        block.type
      ) &&
      (block.text || "").trim()
    ) {
      return stripTextHtml(block.text || "");
    }

    if (block.type === "table") return "table";
    if (block.type === "image") return "image";
    if (block.type === "pdf") return "pdf";
  }

  return "";
}

export function noteColorDef(color: string) {
  return NOTE_COLORS.find((item) => item.bg === color) || NOTE_COLORS[0];
}
