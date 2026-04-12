import type { NoteBlock, NoteRecord } from "@/lib/types";

export const DAILY_TODO_FOLDER_NAME = "daily to-do lists";

const DAILY_TODO_LINK_PREFIX = "daily-todo:";
const DATE_VALUE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanTaskText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractTopLevelListItems(html: string) {
  if (typeof DOMParser === "undefined") return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rootLists = Array.from(doc.body.querySelectorAll("ul, ol")).filter(
    (list) => !list.parentElement?.closest("li")
  );

  return rootLists.flatMap((list) =>
    Array.from(list.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => {
        const clone = child.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("ul, ol").forEach((nestedList) => {
          nestedList.remove();
        });
        return cleanTaskText(clone.textContent || "");
      })
      .filter(Boolean)
  );
}

export function dailyTodoLink(date: string) {
  return `${DAILY_TODO_LINK_PREFIX}${date}`;
}

export function dailyTodoDateFromLink(linkedTo: string | null | undefined) {
  if (!linkedTo?.startsWith(DAILY_TODO_LINK_PREFIX)) return null;

  const date = linkedTo.slice(DAILY_TODO_LINK_PREFIX.length);
  return DATE_VALUE_RE.test(date) ? date : null;
}

export function isDailyTodoFolderName(folderName: string) {
  return folderName.toLowerCase() === DAILY_TODO_FOLDER_NAME.toLowerCase();
}

export function isDailyTodoNote(
  note: Pick<NoteRecord, "linkedTo">
) {
  return dailyTodoDateFromLink(note.linkedTo) !== null;
}

export function extractDailyTodoTasks(blocks: NoteBlock[] = []) {
  const tasks: string[] = [];

  blocks.forEach((block) => {
    if (block.type === "todo") {
      const text = cleanTaskText(block.text || "");
      if (text) tasks.push(text);
      return;
    }

    const text = block.text || "";
    if (!text.trim()) return;

    if (/<[a-z][\s\S]*>/i.test(text)) {
      const listItems = extractTopLevelListItems(text);
      if (listItems.length > 0) {
        tasks.push(...listItems);
      }
      return;
    }

    text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, ""))
      .map(cleanTaskText)
      .filter(Boolean)
      .forEach((task) => tasks.push(task));
  });

  return tasks;
}
