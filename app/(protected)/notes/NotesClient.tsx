"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppContext";
import { uid, noteColorDef, notePreview } from "@/lib/utils";
import { NOTE_COLORS, NOTE_CATEGORIES } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Note, Block } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import BlockEditor from "@/components/ui/BlockEditor";

const DESKTOP_FOLDER_PREFIX = "desktop-folder:";
const DESKTOP_FOLDERS_STORAGE_KEY = "kind-notes-desktop-folders";
const EXPLORE_DROPZONE_ID = "__explore__";

function desktopFolderLink(name: string) {
  return `${DESKTOP_FOLDER_PREFIX}${name}`;
}

function folderNameFromLink(linkedTo: string | null | undefined) {
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

interface NotesClientProps {
  defaultId?: string;
}

export default function NotesClient({ defaultId }: NotesClientProps) {
  const { loaded, notes, setNotes } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(defaultId ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [desktopFolders, setDesktopFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<Note["category"]>("explore");
  const [newColor, setNewColor] = useState<string>(NOTE_COLORS[0].bg);

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

  if (editingId !== null) {
    const note = notes.find((item) => item.id === editingId);

    if (!note) {
      setEditingId(null);
      return null;
    }

    const createdAt = note.createdAt || new Date().toISOString();
    const updatedAt = note.updatedAt || createdAt;

    return (
      <div className="page">
        <button
          className="back-btn"
          onClick={() => {
            setEditingId(null);
            router.push("/notes");
          }}
        >
          ← back to notes
        </button>

        <div className="note-editor-shell">
          <div className="card note-editor">
            <input
              className="note-title"
              value={note.title}
              placeholder="untitled note"
              onChange={(event) =>
                updateNote(note.id, { title: event.target.value })
              }
            />
            <input
              style={{ marginBottom: 16, fontSize: "0.875rem", opacity: 0.7 }}
              className="modal-input"
              value={note.description}
              placeholder="add a description"
              onChange={(event) =>
                updateNote(note.id, { description: event.target.value })
              }
            />
            <BlockEditor
              blocks={note.blocks}
              uploadContext={{ entityType: "notes", entityId: note.id }}
              onChange={(blocks: Block[]) => updateNote(note.id, { blocks })}
            />
          </div>

          <div
            className="card note-meta-card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
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
        </div>

        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteNote(confirmDeleteId!)}
          label={`"${note.title || "untitled"}"`}
        />
      </div>
    );
  }

  const exploreNotes = notes.filter((note) => note.category === "explore");
  const strategicNotes = notes.filter((note) => note.category === "strategic");

  const persistedFolderNames = exploreNotes
    .map((note) => folderNameFromLink(note.linkedTo))
    .filter((folderName): folderName is string => Boolean(folderName));

  const allFolderNames = (() => {
    const ordered = [...desktopFolders];
    persistedFolderNames.forEach((folderName) => {
      if (
        !ordered.some(
          (existingFolder) =>
            existingFolder.toLowerCase() === folderName.toLowerCase()
        )
      ) {
        ordered.push(folderName);
      }
    });
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
                  return (
                    <div
                      key={folderName}
                      className={`desktop-folder-card${
                        dropTarget === folderName ? " drag-over" : ""
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget(folderName);
                      }}
                      onDragLeave={() => {
                        if (dropTarget === folderName) setDropTarget(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
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
                          <button
                            className="ghost-btn small-btn"
                            onClick={() => deleteFolder(folderName)}
                            type="button"
                          >
                            remove
                          </button>
                        </div>

                        {items.length === 0 ? (
                          <div className="desktop-folder-empty">
                            drop explore notes here
                          </div>
                        ) : (
                          <div className="desktop-folder-notes">
                            {items.map((note) => (
                              <div
                                key={note.id}
                                className="desktop-note-chip"
                                draggable
                                onDoubleClick={() => openNote(note.id)}
                                onDragStart={(event) => {
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
                                  {note.description ? (
                                    <div className="desktop-note-chip-desc">
                                      {note.description}
                                    </div>
                                  ) : null}
                                </div>
                                <button
                                  className="item-delete"
                                  title="remove from folder"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    unfileNote(note.id);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
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
