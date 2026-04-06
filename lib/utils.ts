import { Block, Note, Cost } from "./types";
import { EVENT_TYPES, MONTHS_PT, NOTE_COLORS } from "./constants";

export function uid(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function getFirstDayOfMonth(y: number, m: number): number {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export function addDays(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function addMinutes(time: string, minutes: number): string {
  const [hours, currentMinutes] = time.split(":").map(Number);
  const total = hours * 60 + currentMinutes + minutes;
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export function formatRelativeLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${MONTHS_PT[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function monthlyEquivalent(cost: Cost): number {
  return cost.billingCycle === "annual" ? cost.amount / 12 : cost.amount;
}

export function annualEstimate(cost: Cost): number {
  return cost.billingCycle === "annual" ? cost.amount : cost.amount * 12;
}

export function getEventMeta(type: string) {
  return EVENT_TYPES.find((item) => item.id === type) || EVENT_TYPES[0];
}

export function createBlock(type: Block["type"] = "text", extras: Partial<Block> = {}): Block {
  const base: Block = { id: uid(), type };
  if (type === "todo") return { ...base, text: "", checked: false, indent: 0, ...extras };
  if (type === "divider") return { ...base, ...extras };
  if (type === "callout") return { ...base, text: "", icon: "i", ...extras };
  if (type === "code") return { ...base, text: "", language: "", ...extras };
  if (type === "table") return { ...base, rows: [["", ""], ["", ""]], ...extras };
  if (type === "image" || type === "pdf") return { ...base, name: "", path: "", src: "", caption: "", ...extras };
  if (type === "note_link") return { ...base, noteId: "", ...extras };
  if (type === "entity_link") return { ...base, entity: "", ...extras };
  return { ...base, text: "", ...extras };
}

export function normalizeBlock(block: Partial<Block>): Block {
  if (!block?.type) return createBlock("text");
  if (block.type === "todo") return { indent: 0, checked: false, text: "", ...block } as Block;
  if (block.type === "callout") return { icon: "i", text: "", ...block } as Block;
  if (block.type === "code") return { language: "", text: "", ...block } as Block;
  if (block.type === "table") return { rows: [["", ""], ["", ""]], ...block } as Block;
  if (block.type === "image" || block.type === "pdf") return { name: "", path: "", src: "", caption: "", ...block } as Block;
  if (block.type === "note_link") return { noteId: "", ...block } as Block;
  if (block.type === "entity_link") return { entity: "", ...block } as Block;
  return { text: "", ...block } as Block;
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

export function notePreview(note: Note): string {
  for (const block of note.blocks || []) {
    if (["text", "heading1", "heading2", "heading3", "callout", "code", "todo"].includes(block.type) && (block.text || "").trim()) {
      return stripTextHtml(block.text || "");
    }
    if (block.type === "entity_link") return "linked entity";
    if (block.type === "note_link") return "linked note";
    if (block.type === "table") return "table";
  }
  return "";
}

export function insertBlockAfter(
  blocks: Block[],
  afterId: string,
  type: Block["type"],
  extras: Partial<Block> = {}
): Block[] {
  const next = [...blocks];
  const index = next.findIndex((block) => block.id === afterId);
  const block = createBlock(type, extras);
  if (index < 0) return [...next, block];
  next.splice(index + 1, 0, block);
  return next;
}

export function replaceBlockType(block: Block, type: Block["type"]): Block {
  const carriedText = block.text || "";
  if (["heading1", "heading2", "heading3", "text"].includes(type)) return createBlock(type, { text: carriedText });
  if (type === "todo") return createBlock("todo", { text: carriedText });
  if (type === "callout") return createBlock("callout", { text: carriedText });
  if (type === "code") return createBlock("code", { text: carriedText });
  return createBlock(type);
}

export function resolveNameById(list: { id: string; name: string }[], id: string, fallback = "unassigned"): string {
  return list.find((item) => item.id === id)?.name || fallback;
}

export function resolveInitialsById(list: { id: string; initials: string }[], id: string): string {
  return list.find((item) => item.id === id)?.initials || "?";
}

export function resolveColorById(list: { id: string; color: string }[], id: string): string {
  return list.find((item) => item.id === id)?.color || "#8E8E93";
}

export function noteColorDef(color: string) {
  return NOTE_COLORS.find((c) => c.bg === color) || NOTE_COLORS[0];
}

export function migrateNote(note: Partial<Note>): Note {
  const rawCategory = String(note?.category || "");
  const category = rawCategory === "operational"
    ? "explore"
    : (["explore", "strategic"].includes(rawCategory)
      ? rawCategory
      : (/what is|vision|principles|strategy|decision/i.test(note?.title || "") ? "strategic" : "explore"));

  if (Array.isArray(note?.blocks) && note.blocks!.length > 0) {
    return {
      category,
      description: note.description || "",
      color: note.color || NOTE_COLORS[0].bg,
      linkedTo: note.linkedTo || null,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || new Date().toISOString(),
      ...note,
      blocks: note.blocks!.map(normalizeBlock),
    } as Note;
  }

  const blocks: Block[] = [createBlock("text")];
  return {
    id: note.id || uid(),
    title: note.title || "",
    category,
    description: note.description || "",
    color: note.color || NOTE_COLORS[0].bg,
    linkedTo: note.linkedTo || null,
    blocks,
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString(),
    ...note,
  } as Note;
}
