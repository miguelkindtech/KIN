"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppContext";
import { uid, formatDate, noteColorDef, notePreview } from "@/lib/utils";
import {
  DAILY_TODO_FOLDER_NAME,
  dailyTodoDateFromLink,
  dailyTodoLink,
  extractDailyTodoTasks,
  isDailyTodoFolderName,
} from "@/lib/utils/dailyTodos";
import { NOTE_COLORS, NOTE_CATEGORIES } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Note, Block } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import { uploadAttachment } from "@/lib/supabase/storage";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import RichDocEditor from "@/components/ui/RichDocEditor";

const DESKTOP_FOLDER_PREFIX = "desktop-folder:";
const DESKTOP_FOLDERS_STORAGE_KEY = "kind-notes-desktop-folders";
const EXPLORE_DROPZONE_ID = "__explore__";

function desktopFolderLink(name: string) {
  return `${DESKTOP_FOLDER_PREFIX}${name}`;
}

function folderNameFromLink(linkedTo: string | null | undefined) {
  if (dailyTodoDateFromLink(linkedTo)) return DAILY_TODO_FOLDER_NAME;
  if (!linkedTo || !linkedTo.startsWith(DESKTOP_FOLDER_PREFIX)) return null;
  return linkedTo.slice(DESKTOP_FOLDER_PREFIX.length);
}

function readStoredFolders() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DESKTOP_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toRichParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function blockToRichHtml(block: Block) {
  const text = block.text || "";
  const hasHtml = /<[a-z][\s\S]*>/i.test(text.trim());

  switch (block.type) {
    case "heading1":
      return `<h1>${escapeHtml(text).replace(/\n/g, "<br>")}</h1>`;
    case "heading2":
      return `<h2>${escapeHtml(text).replace(/\n/g, "<br>")}</h2>`;
    case "heading3":
      return `<h3>${escapeHtml(text).replace(/\n/g, "<br>")}</h3>`;
    case "callout":
      return `<blockquote>${escapeHtml(text).replace(/\n/g, "<br>")}</blockquote>`;
    case "code":
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    case "todo":
      return `<p>${block.checked ? "☑" : "☐"} ${escapeHtml(text)}</p>`;
    case "divider":
      return "<hr />";
    case "table":
      return Array.isArray(block.rows)
        ? block.rows
            .map((row) => `<p>${escapeHtml(row.join(" | "))}</p>`)
            .join("")
        : "";
    case "note_link":
      return `<p>Linked note ${escapeHtml(block.noteId || "")}</p>`;
    case "entity_link":
      return `<p>Linked entity ${escapeHtml(block.entity || "")}</p>`;
    case "text":
    default:
      if (!text.trim()) return "";
      return hasHtml ? text : toRichParagraphs(text);
  }
}

function blocksToRichDoc(blocks: Block[]) {
  const html = (blocks || [])
    .filter((block) => block.type !== "pdf" && block.type !== "image")
    .map(blockToRichHtml)
    .filter(Boolean)
    .join("");

  return html.trim() || "<p></p>";
}

function createBlocksFromRichDoc(html: string, preservedBlocks: Block[] = []) {
  const richTextBlock = {
    id: uid(),
    type: "text" as const,
    text: html.trim() || "<p></p>",
  };

  return [...preservedBlocks, richTextBlock];
}

function createRichDocFromImportedPdf(
  text: string,
  pageTexts: string[]
) {
  const normalizedPages = pageTexts.length > 0 ? pageTexts : [text.trim()];

  return normalizedPages
    .map((pageText, pageIndex) => {
      const title =
        normalizedPages.length > 1 ? `<h3>Page ${pageIndex + 1}</h3>` : "";
      return `${title}${toRichParagraphs(pageText)}`;
    })
    .join("");
}

function formatDailyTodoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;

  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function createDailyTodoBlock(extras: Partial<Block> = {}): Block {
  return {
    id: uid(),
    type: "todo",
    text: "",
    details: "",
    checked: false,
    indent: 0,
    ...extras,
  };
}

function dailyTodoBlocksFromNote(blocks: Block[]) {
  const todoBlocks = blocks
    .filter((block) => block.type === "todo" && (block.indent || 0) === 0)
    .map((block) => createDailyTodoBlock(block));

  if (todoBlocks.length > 0) return todoBlocks;

  const migratedTasks = extractDailyTodoTasks(blocks);
  if (migratedTasks.length > 0) {
    return migratedTasks.map((task) => createDailyTodoBlock({ text: task }));
  }

  return [createDailyTodoBlock()];
}

type NoteCardProps = {
  note: Note;
  onOpen: (id: string) => void;
  draggable?: boolean;
  clickMode?: "single" | "double";
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  footerHint?: string;
  className?: string;
};

function NoteCard({
  note,
  onOpen,
  draggable = false,
  clickMode = "single",
  onDragStart,
  onDragEnd,
  footerHint,
  className = "",
}: NoteCardProps) {
  const colorDef = noteColorDef(note.color);
  const preview = notePreview(note);

  return (
    <div
      className={`note-card${draggable ? " note-card-draggable" : ""}${
        clickMode === "double" ? " note-card-double" : ""
      }${className ? ` ${className}` : ""}`}
      draggable={draggable}
      onClick={() => {
        if (clickMode === "single") onOpen(note.id);
      }}
      onDoubleClick={() => {
        if (clickMode === "double") onOpen(note.id);
      }}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/note-id", note.id);
        onDragStart?.(note.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="note-card-body">
        <div className="note-card-title">{note.title || "untitled"}</div>
        {note.description ? (
          <div className="note-card-desc">{note.description}</div>
        ) : null}
        {preview ? <div className="note-card-preview">{preview}</div> : null}
        {footerHint ? <div className="note-card-hint">{footerHint}</div> : null}
      </div>
      <div className="note-card-accent" style={{ background: colorDef.bg }}>
        <span className="note-card-symbol" style={{ color: colorDef.fg }}>
          {colorDef.symbol}
        </span>
      </div>
    </div>
  );
}

type DailyTodoEditorProps = {
  note: Note;
  todoDate: string;
  tasks: Block[];
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onBack: () => void;
  onDelete: () => void;
};

function DailyTodoEditor({
  note,
  todoDate,
  tasks,
  onUpdate,
  onBack,
  onDelete,
}: DailyTodoEditorProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  useEffect(() => {
    if (activeTaskId && !activeTask) {
      setActiveTaskId(null);
    }
  }, [activeTask, activeTaskId]);

  function commitTasks(nextTasks: Block[], patch: Partial<Note> = {}) {
    onUpdate(note.id, { blocks: nextTasks, ...patch });
  }

  function updateTask(taskId: string, patch: Partial<Block>) {
    commitTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task
      )
    );
  }

  function insertTaskAfter(taskId?: string) {
    const nextTask = createDailyTodoBlock();
    const nextTasks = [...tasks];
    const index = taskId
      ? nextTasks.findIndex((task) => task.id === taskId)
      : nextTasks.length - 1;

    nextTasks.splice(index + 1, 0, nextTask);
    commitTasks(nextTasks);
  }

  function removeTask(taskId: string) {
    if (tasks.length <= 1) {
      commitTasks([createDailyTodoBlock({ id: taskId })]);
      return;
    }

    commitTasks(tasks.filter((task) => task.id !== taskId));
  }

  if (activeTask) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => setActiveTaskId(null)}>
          ← back to task list
        </button>

        <div className="daily-task-detail-shell">
          <div className="card daily-task-detail-card">
            <div className="detail-label">task continuation</div>
            <input
              className="daily-task-detail-title"
              value={activeTask.text || ""}
              placeholder="task title"
              onChange={(event) =>
                updateTask(activeTask.id, { text: event.target.value })
              }
            />
            <textarea
              className="daily-task-detail-body"
              value={activeTask.details || ""}
              placeholder="Write the detail for this task here..."
              onChange={(event) =>
                updateTask(activeTask.id, { details: event.target.value })
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={onBack}>
        ← back to notes
      </button>

      <div className="daily-todo-shell">
        <div className="card daily-todo-card">
          <div className="daily-todo-head">
            <div>
              <div className="detail-label">daily to-do list</div>
              <input
                className="rich-doc-title-input daily-todo-title-input"
                value={note.title}
                placeholder="daily to-do list"
                onChange={(event) =>
                  onUpdate(note.id, { title: event.target.value })
                }
              />
              <div className="muted daily-todo-date">
                {formatDailyTodoDate(todoDate)}
              </div>
            </div>
            <button className="danger-btn small-btn" onClick={onDelete}>
              delete note
            </button>
          </div>

          <div className="daily-task-list">
            {tasks.map((task) => (
              <div className="daily-task-row" key={task.id}>
                <button
                  className={`todo-check${task.checked ? " done" : ""}`}
                  onClick={() =>
                    updateTask(task.id, { checked: !task.checked })
                  }
                  aria-label={task.checked ? "Uncheck task" : "Check task"}
                  type="button"
                >
                  {task.checked ? "✓" : ""}
                </button>
                <span className="daily-task-dot" />
                <input
                  className="daily-task-title-input"
                  value={task.text || ""}
                  placeholder="Task title"
                  onChange={(event) =>
                    updateTask(task.id, { text: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      insertTaskAfter(task.id);
                    }

                    if (
                      event.key === "Backspace" &&
                      !task.text &&
                      !task.details
                    ) {
                      event.preventDefault();
                      removeTask(task.id);
                    }
                  }}
                />
                <button
                  className="daily-task-open"
                  onClick={() => setActiveTaskId(task.id)}
                  aria-label={`Open details for ${task.text || "task"}`}
                  type="button"
                >
                  ›
                </button>
              </div>
            ))}
          </div>

          <button
            className="ghost-btn daily-task-add"
            onClick={() => insertTaskAfter()}
            type="button"
          >
            + task
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotesClientProps {
  defaultId?: string;
}

export default function NotesClient({ defaultId }: NotesClientProps) {
  const { loaded, notes, setNotes } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const importPdfRef = useRef<HTMLInputElement | null>(null);
  const todayStr = useMemo(() => formatDate(new Date()), []);

  const [editingId, setEditingId] = useState<string | null>(defaultId ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDailyTodoCreate, setShowDailyTodoCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [desktopFolders, setDesktopFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [dailyTodoDate, setDailyTodoDate] = useState(todayStr);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<Note["category"]>("explore");
  const [newColor, setNewColor] = useState<string>(NOTE_COLORS[0].bg);
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfImportMessage, setPdfImportMessage] = useState("");

  useAutoSave(
    notes,
    async (currentNotes) => {
      await syncTableById(supabase, "notes", currentNotes, (note) => ({
        id: note.id,
        title: note.title,
        description: note.description,
        category: note.category,
        color: note.color,
        blocks: note.blocks,
        linked_to: note.linkedTo,
        updated_at: note.updatedAt || new Date().toISOString(),
      }));
    },
    300
  );

  useEffect(() => {
    setDesktopFolders(readStoredFolders());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DESKTOP_FOLDERS_STORAGE_KEY,
      JSON.stringify(desktopFolders)
    );
  }, [desktopFolders]);

  if (!loaded) {
    return <div className="loading">Loading notes...</div>;
  }

  function openNote(id: string) {
    setEditingId(id);
    router.push(`/notes/${id}`);
  }

  function createNote() {
    if (!newTitle.trim()) return;
    const note: Note = {
      id: uid(),
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim(),
      color: newColor,
      linkedTo: null,
      blocks: [{ id: uid(), type: "text", text: "" }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNotes((prev) => [...prev, note]);
    setShowCreate(false);
    setNewTitle("");
    setNewDesc("");
    setNewCategory("explore");
    setNewColor(NOTE_COLORS[0].bg);
    openNote(note.id);
  }

  function openDailyTodoCreate() {
    setDailyTodoDate(todayStr);
    setShowDailyTodoCreate(true);
  }

  function createDailyTodoNote() {
    if (!dailyTodoDate || dailyTodoDate < todayStr) return;

    const existingNote = notes.find(
      (note) => dailyTodoDateFromLink(note.linkedTo) === dailyTodoDate
    );

    setShowDailyTodoCreate(false);

    if (existingNote) {
      setDailyTodoDate(todayStr);
      openNote(existingNote.id);
      return;
    }

    const now = new Date().toISOString();
    const note: Note = {
      id: uid(),
      title: `To-do - ${formatDailyTodoDate(dailyTodoDate)}`,
      category: "explore",
      description: "Daily task list",
      color: NOTE_COLORS[3].bg,
      linkedTo: dailyTodoLink(dailyTodoDate),
      blocks: [createDailyTodoBlock()],
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [...prev, note]);
    setDailyTodoDate(todayStr);
    openNote(note.id);
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setConfirmDeleteId(null);
    setEditingId(null);
    router.push("/notes");
  }

  async function handleImportPdf(note: Note, file: File) {
    setImportingPdf(true);
    setPdfImportMessage("");

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/notes/import-pdf", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not read this PDF.");
      }

      const uploaded = await uploadAttachment(supabase, file, "notes", note.id);
      const nextHtml = createRichDocFromImportedPdf(
        String(payload?.text || ""),
        Array.isArray(payload?.pages)
          ? payload.pages
              .map((page: unknown) =>
                typeof page === "string" ? page.trim() : ""
              )
              .filter(Boolean)
          : []
      );
      const pdfBlock: Block = {
        id: uid(),
        type: "pdf",
        src: uploaded.url,
        name: uploaded.name,
        caption: uploaded.name,
      };
      const suggestedTitle = String(payload?.suggestedTitle || "").trim();

      updateNote(note.id, {
        title:
          !note.title.trim() || note.title.trim().toLowerCase() === "untitled note"
            ? suggestedTitle || note.title
            : note.title,
        description:
          !note.description.trim()
            ? `Imported from ${uploaded.name}`
            : note.description,
        blocks: createBlocksFromRichDoc(nextHtml, [pdfBlock]),
      });

      setPdfImportMessage("PDF imported into this note.");
    } catch (error) {
      setPdfImportMessage(
        error instanceof Error ? error.message : "Could not import the PDF."
      );
    } finally {
      setImportingPdf(false);
    }
  }

  if (editingId !== null) {
    const note = notes.find((item) => item.id === editingId);

    if (!note) {
      setEditingId(null);
      return null;
    }

    const createdAt = note.createdAt || new Date().toISOString();
    const updatedAt = note.updatedAt || createdAt;
    const pdfBlocks = note.blocks.filter((block) => block.type === "pdf");
    const docValue = blocksToRichDoc(note.blocks);
    const todoDate = dailyTodoDateFromLink(note.linkedTo);
    const isDailyTodo = todoDate !== null;

    if (isDailyTodo) {
      return (
        <>
          <DailyTodoEditor
            note={note}
            todoDate={todoDate}
            tasks={dailyTodoBlocksFromNote(note.blocks)}
            onUpdate={updateNote}
            onBack={() => {
              setEditingId(null);
              router.push("/notes");
            }}
            onDelete={() => setConfirmDeleteId(note.id)}
          />
          <ConfirmModal
            show={confirmDeleteId !== null}
            onClose={() => setConfirmDeleteId(null)}
            onConfirm={() => deleteNote(confirmDeleteId!)}
            label={`"${note.title || "untitled"}"`}
          />
        </>
      );
    }

    return (
      <>
        <RichDocEditor
          title={note.title}
          titlePlaceholder="untitled note"
          value={docValue}
          placeholder="Write the note here..."
          backLabel="back to notes"
          onTitleChange={(value) => updateNote(note.id, { title: value })}
          onChange={(value) =>
            updateNote(note.id, {
              blocks: createBlocksFromRichDoc(value, pdfBlocks),
            })
          }
          onBack={() => {
            setEditingId(null);
            router.push("/notes");
          }}
          beforeEditor={
            pdfBlocks.length > 0 ? (
              <div className="rich-doc-attachments">
                {pdfBlocks.map((block) => (
                  <div key={block.id} className="rich-doc-attachment">
                    <div className="rich-doc-attachment-head">
                      <div className="detail-label">imported pdf</div>
                      <a
                        className="ghost-btn small-btn"
                        href={block.src}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    </div>
                    <div className="muted rich-doc-attachment-name">
                      {block.name || block.caption || "document.pdf"}
                    </div>
                    {block.src ? (
                      <div className="rich-doc-pdf-frame">
                        <iframe
                          src={block.src}
                          title={block.name || "Imported PDF"}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null
          }
          sidePanel={
            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div>
                <div className="detail-label">description</div>
                <input
                  className="modal-input"
                  value={note.description}
                  placeholder="add a description"
                  onChange={(event) =>
                    updateNote(note.id, { description: event.target.value })
                  }
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <div className="detail-label">category</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {NOTE_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      className={
                        note.category === category ? "action-btn" : "ghost-btn"
                      }
                      style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                      onClick={() =>
                        updateNote(note.id, {
                          category: category as Note["category"],
                        })
                      }
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="detail-label">color</div>
                <div className="color-palette" style={{ marginTop: 6 }}>
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.bg}
                      className={`swatch${note.color === color.bg ? " selected" : ""}`}
                      style={{ background: color.bg, color: color.fg }}
                      title={color.symbol}
                      onClick={() => updateNote(note.id, { color: color.bg })}
                    >
                      {color.symbol}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="detail-label">created</div>
                <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  {new Date(createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div>
                <div className="detail-label">updated</div>
                <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  {new Date(updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div>
                <div className="detail-label">import from pdf</div>
                <input
                  ref={importPdfRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await handleImportPdf(note, file);
                    event.target.value = "";
                  }}
                />
                <button
                  className="action-btn small-btn"
                  disabled={importingPdf}
                  onClick={() => importPdfRef.current?.click()}
                  style={{ width: "100%" }}
                >
                  {importingPdf ? "importing pdf..." : "import pdf into note"}
                </button>
                {pdfImportMessage ? (
                  <div
                    className="muted"
                    style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 8 }}
                  >
                    {pdfImportMessage}
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: "auto" }}>
                <button
                  className="danger-btn small-btn"
                  style={{ width: "100%" }}
                  onClick={() => setConfirmDeleteId(note.id)}
                >
                  delete note
                </button>
              </div>
            </div>
          }
        />
        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteNote(confirmDeleteId!)}
          label={`"${note.title || "untitled"}"`}
        />
      </>
    );
  }

  const exploreNotes = notes.filter((note) => note.category === "explore");
  const strategicNotes = notes.filter((note) => note.category === "strategic");

  const persistedFolderNames = exploreNotes
    .map((note) => folderNameFromLink(note.linkedTo))
    .filter((folderName): folderName is string => Boolean(folderName));

  const allFolderNames = (() => {
    const ordered: string[] = [DAILY_TODO_FOLDER_NAME];
    const addFolderName = (folderName: string) => {
      if (
        !ordered.some(
          (existingFolder) =>
            existingFolder.toLowerCase() === folderName.toLowerCase()
        )
      ) {
        ordered.push(folderName);
      }
    };

    desktopFolders.forEach(addFolderName);
    persistedFolderNames.forEach(addFolderName);
    return ordered;
  })();

  const unfiledExploreNotes = exploreNotes.filter(
    (note) => !folderNameFromLink(note.linkedTo)
  );

  function folderNotes(folderName: string) {
    return exploreNotes.filter(
      (note) => folderNameFromLink(note.linkedTo) === folderName
    );
  }

  function openCreate(category: Note["category"]) {
    setNewCategory(category);
    setShowCreate(true);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    const exists = allFolderNames.some(
      (folder) => folder.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setNewFolderName("");
      return;
    }

    setDesktopFolders((prev) => [...prev, name]);
    setNewFolderName("");
  }

  function fileNoteIntoFolder(noteId: string, folderName: string) {
    if (isDailyTodoFolderName(folderName)) {
      setDropTarget(null);
      setDraggedNoteId(null);
      return;
    }

    updateNote(noteId, { linkedTo: desktopFolderLink(folderName) });
    setDropTarget(null);
    setDraggedNoteId(null);
  }

  function unfileNote(noteId: string) {
    updateNote(noteId, { linkedTo: null });
    setDropTarget(null);
    setDraggedNoteId(null);
  }

  function deleteFolder(folderName: string) {
    if (isDailyTodoFolderName(folderName)) return;

    setDesktopFolders((prev) =>
      prev.filter((folder) => folder.toLowerCase() !== folderName.toLowerCase())
    );
    setNotes((prev) =>
      prev.map((note) =>
        folderNameFromLink(note.linkedTo)?.toLowerCase() ===
        folderName.toLowerCase()
          ? { ...note, linkedTo: null, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }

  function getDraggedNoteId(event?: DragEvent<HTMLElement>) {
    return (
      event?.dataTransfer.getData("text/note-id") ||
      draggedNoteId ||
      ""
    );
  }

  return (
    <div className="page notes-page">
      <div className="page-actions">
        <button className="action-btn" onClick={() => setShowCreate(true)}>
          + new note
        </button>
      </div>

      <div className="notes-workspace-page">
        <div className="notes-workspace-top">
          <section
            className={`section-stack notes-explore-section${
              dropTarget === EXPLORE_DROPZONE_ID ? " notes-drop-active" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(EXPLORE_DROPZONE_ID);
            }}
            onDragLeave={() => {
              if (dropTarget === EXPLORE_DROPZONE_ID) setDropTarget(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const noteId = getDraggedNoteId(event);
              if (!noteId) return;
              unfileNote(noteId);
            }}
          >
            <div className="section-header">
              <div className="section-title">topics to explore</div>
              <button
                className="ghost-btn small-btn"
                onClick={() => openCreate("explore")}
              >
                + new
              </button>
            </div>

            {unfiledExploreNotes.length === 0 ? (
              <div className="empty-state">
                no explore notes loose right now. drag one back here to take it
                out of a folder.
              </div>
            ) : (
              <div className="notes-explore-grid">
                {unfiledExploreNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    draggable
                    clickMode="double"
                    footerHint="double-click to open · drag to file"
                    onOpen={openNote}
                    onDragStart={setDraggedNoteId}
                    onDragEnd={() => {
                      setDraggedNoteId(null);
                      setDropTarget(null);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card notes-desktop">
            <div className="notes-desktop-header">
              <div>
                <div className="section-title">desktop</div>
                <div className="muted notes-desktop-copy">
                  create folders and drag explore notes into them when they are
                  ready.
                </div>
              </div>

              <div className="notes-folder-create">
                <input
                  className="modal-input notes-folder-input"
                  value={newFolderName}
                  placeholder="new folder"
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createFolder();
                  }}
                />
                <button className="action-btn small-btn" onClick={createFolder}>
                  + folder
                </button>
              </div>
            </div>

            {allFolderNames.length === 0 ? (
              <div className="notes-desktop-empty">
                <div className="notes-folder-ghost">
                  <span className="notes-folder-ghost-tab" />
                  <span className="notes-folder-ghost-body" />
                </div>
                <div className="muted">
                  create your first folder here and start filing explore notes.
                </div>
              </div>
            ) : (
              <div className="notes-folder-grid">
                {allFolderNames.map((folderName) => {
                  const items = folderNotes(folderName);
                  const isDailyFolder = isDailyTodoFolderName(folderName);
                  return (
                    <div
                      key={folderName}
                      className={`desktop-folder-card${
                        dropTarget === folderName ? " drag-over" : ""
                      }${isDailyFolder ? " fixed-folder" : ""}`}
                      onDragOver={(event) => {
                        if (isDailyFolder) return;
                        event.preventDefault();
                        setDropTarget(folderName);
                      }}
                      onDragLeave={() => {
                        if (dropTarget === folderName) setDropTarget(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (isDailyFolder) return;
                        const noteId = getDraggedNoteId(event);
                        if (!noteId) return;
                        fileNoteIntoFolder(noteId, folderName);
                      }}
                    >
                      <div className="desktop-folder-tab" />
                      <div className="desktop-folder-shell">
                        <div className="desktop-folder-head">
                          <div>
                            <div className="desktop-folder-name">{folderName}</div>
                            <div className="desktop-folder-meta">
                              {items.length} note{items.length === 1 ? "" : "s"}
                            </div>
                          </div>
                          {isDailyFolder ? (
                            <button
                              className="action-btn small-btn"
                              onClick={openDailyTodoCreate}
                              type="button"
                            >
                              + day
                            </button>
                          ) : (
                            <button
                              className="ghost-btn small-btn"
                              onClick={() => deleteFolder(folderName)}
                              type="button"
                            >
                              remove
                            </button>
                          )}
                        </div>

                        {items.length === 0 ? (
                          <div className="desktop-folder-empty">
                            {isDailyFolder
                              ? "choose a day to create a to-do list"
                              : "drop explore notes here"}
                          </div>
                        ) : (
                          <div className="desktop-folder-notes">
                            {items.map((note) => {
                              const noteTodoDate = dailyTodoDateFromLink(note.linkedTo);
                              const isFixedDailyNote = noteTodoDate !== null;

                              return (
                                <div
                                  key={note.id}
                                  className={`desktop-note-chip${
                                    isFixedDailyNote ? " desktop-note-chip-fixed" : ""
                                  }`}
                                  draggable={!isFixedDailyNote}
                                  onDoubleClick={() => openNote(note.id)}
                                  onDragStart={(event) => {
                                    if (isFixedDailyNote) return;
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData(
                                      "text/note-id",
                                      note.id
                                    );
                                    setDraggedNoteId(note.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedNoteId(null);
                                    setDropTarget(null);
                                  }}
                                >
                                  <span
                                    className="desktop-note-chip-dot"
                                    style={{ background: noteColorDef(note.color).fg }}
                                  />
                                  <div className="desktop-note-chip-content">
                                    <div className="desktop-note-chip-title">
                                      {note.title || "untitled"}
                                    </div>
                                    {noteTodoDate || note.description ? (
                                      <div className="desktop-note-chip-desc">
                                        {noteTodoDate
                                          ? formatDailyTodoDate(noteTodoDate)
                                          : note.description}
                                      </div>
                                    ) : null}
                                  </div>
                                  {!isFixedDailyNote ? (
                                    <button
                                      className="item-delete"
                                      title="remove from folder"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        unfileNote(note.id);
                                      }}
                                    >
                                      x
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="notes-strategic-section">
          <div className="section-header notes-strategic-header">
            <Image
              src="/logotexto.png"
              alt="kind. strategy"
              width={220}
              height={77}
              className="notes-strategic-mark"
            />
            <button
              className="ghost-btn small-btn"
              onClick={() => openCreate("strategic")}
            >
              + new
            </button>
          </div>

          {strategicNotes.length === 0 ? (
            <div className="empty-state">no kind. strategy notes yet.</div>
          ) : (
            <div className="note-grid notes-strategic-grid">
              {strategicNotes.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={openNote} />
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal
        show={showDailyTodoCreate}
        onClose={() => setShowDailyTodoCreate(false)}
        title="daily to-do list"
      >
        <div className="modal-field">
          <label className="modal-label">day</label>
          <input
            className="modal-input"
            type="date"
            value={dailyTodoDate}
            min={todayStr}
            onChange={(event) => setDailyTodoDate(event.target.value)}
          />
        </div>
        <div className="muted daily-todo-modal-copy">
          Creates a note inside the fixed daily to-do lists folder. Only days
          from today onward can be selected.
        </div>
        <div className="modal-actions">
          <button
            className="ghost-btn"
            onClick={() => setShowDailyTodoCreate(false)}
          >
            cancel
          </button>
          <button
            className="action-btn"
            onClick={createDailyTodoNote}
            disabled={!dailyTodoDate || dailyTodoDate < todayStr}
          >
            create list
          </button>
        </div>
      </Modal>

      <Modal show={showCreate} onClose={() => setShowCreate(false)} title="new note">
        <div className="modal-field">
          <label className="modal-label">title</label>
          <input
            className="modal-input"
            value={newTitle}
            placeholder="note title"
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createNote()}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">description</label>
          <input
            className="modal-input"
            value={newDesc}
            placeholder="optional short description"
            onChange={(event) => setNewDesc(event.target.value)}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">category</label>
          <select
            className="modal-select"
            value={newCategory}
            onChange={(event) =>
              setNewCategory(event.target.value as Note["category"])
            }
          >
            {NOTE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">color</label>
          <div className="color-palette" style={{ marginTop: 6 }}>
            {NOTE_COLORS.map((color) => (
              <button
                key={color.bg}
                className={`swatch${newColor === color.bg ? " selected" : ""}`}
                style={{ background: color.bg, color: color.fg }}
                title={color.symbol}
                onClick={() => setNewColor(color.bg)}
              >
                {color.symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => setShowCreate(false)}>
            cancel
          </button>
          <button
            className="action-btn"
            onClick={createNote}
            disabled={!newTitle.trim()}
          >
            create
          </button>
        </div>
      </Modal>
    </div>
  );
}
