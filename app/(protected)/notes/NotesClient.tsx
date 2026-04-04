"use client";

import { useMemo, useState } from "react";
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

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, onEdit }: { note: Note; onEdit: (id: string) => void }) {
  const colorDef = noteColorDef(note.color);
  const preview = notePreview(note);
  return (
    <div className="note-card" onClick={() => onEdit(note.id)}>
      <div className="note-card-body">
        <div className="note-card-title">{note.title || "untitled"}</div>
        {note.description && <div className="note-card-desc">{note.description}</div>}
        {preview && <div className="note-card-preview">{preview}</div>}
      </div>
      <div className="note-card-accent" style={{ background: colorDef.bg }}>
        <span className="note-card-symbol" style={{ color: colorDef.fg }}>{colorDef.symbol}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesClientProps {
  defaultId?: string;
}

// ---------------------------------------------------------------------------
// NotesClient
// ---------------------------------------------------------------------------

export default function NotesClient({ defaultId }: NotesClientProps) {
  const { loaded, notes, setNotes } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(defaultId ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form state
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

  if (!loaded) {
    return <div className="loading">Loading notes...</div>;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
    setEditingId(note.id);
    router.push(`/notes/${note.id}`);
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
      )
    );
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setConfirmDeleteId(null);
    setEditingId(null);
    router.push("/notes");
  }

  // ---------------------------------------------------------------------------
  // Editor view
  // ---------------------------------------------------------------------------

  if (editingId !== null) {
    const note = notes.find((n) => n.id === editingId);
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
          {/* Left — editor */}
          <div className="card note-editor">
            <input
              className="note-title"
              value={note.title}
              placeholder="untitled note"
              onChange={(e) => updateNote(note.id, { title: e.target.value })}
            />
            <input
              style={{ marginBottom: 16, fontSize: "0.875rem", opacity: 0.7 }}
              className="modal-input"
              value={note.description}
              placeholder="add a description"
              onChange={(e) => updateNote(note.id, { description: e.target.value })}
            />
            <BlockEditor
              blocks={note.blocks}
              uploadContext={{ entityType: "notes", entityId: note.id }}
              onChange={(blocks: Block[]) => updateNote(note.id, { blocks })}
            />
          </div>

          {/* Right — metadata */}
          <div className="card note-meta-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="detail-label">category</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {NOTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={note.category === cat ? "action-btn" : "ghost-btn"}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    onClick={() =>
                      updateNote(note.id, { category: cat as Note["category"] })
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="detail-label">color</div>
              <div className="color-palette" style={{ marginTop: 6 }}>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.bg}
                    className={`swatch${note.color === c.bg ? " selected" : ""}`}
                    style={{ background: c.bg, color: c.fg }}
                    title={c.symbol}
                    onClick={() => updateNote(note.id, { color: c.bg })}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="detail-label">created</div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                {new Date(createdAt).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </div>
            </div>

            <div>
              <div className="detail-label">updated</div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                {new Date(updatedAt).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
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

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  const exploreNotes = notes.filter((n) => n.category === "explore");
  const strategicNotes = notes.filter((n) => n.category === "strategic");

  function openCreate(category: string) {
    setNewCategory(category as Note["category"]);
    setShowCreate(true);
  }

  return (
    <div className="page">
      <div className="page-actions">
        <button className="action-btn" onClick={() => setShowCreate(true)}>
          + new note
        </button>
      </div>

      {/* Topics to explore */}
      <section>
        <div className="section-header">
          <div className="section-title">topics to explore</div>
          <button className="ghost-btn small-btn" onClick={() => openCreate("explore")}>
            + new
          </button>
        </div>
        {exploreNotes.length === 0 ? (
          <div className="empty-state">no explore notes yet.</div>
        ) : (
          <div className="note-grid">
            {exploreNotes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onEdit={(id) => {
                  setEditingId(id);
                  router.push(`/notes/${id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Strategic */}
      <section className="top-space">
        <div className="section-header">
          <div className="section-title">strategic</div>
          <button className="ghost-btn small-btn" onClick={() => openCreate("strategic")}>
            + new
          </button>
        </div>
        {strategicNotes.length === 0 ? (
          <div className="empty-state">no strategic notes yet.</div>
        ) : (
          <div className="note-grid">
            {strategicNotes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onEdit={(id) => {
                  setEditingId(id);
                  router.push(`/notes/${id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create modal */}
      <Modal show={showCreate} onClose={() => setShowCreate(false)} title="new note">
        <div className="modal-field">
          <label className="modal-label">title</label>
          <input
            className="modal-input"
            value={newTitle}
            placeholder="note title"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNote()}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">description</label>
          <input
            className="modal-input"
            value={newDesc}
            placeholder="optional short description"
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">category</label>
          <select
            className="modal-select"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as Note["category"])}
          >
            {NOTE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">color</label>
          <div className="color-palette" style={{ marginTop: 6 }}>
            {NOTE_COLORS.map((c) => (
              <button
                key={c.bg}
                className={`swatch${newColor === c.bg ? " selected" : ""}`}
                style={{ background: c.bg, color: c.fg }}
                title={c.symbol}
                onClick={() => setNewColor(c.bg)}
              >
                {c.symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => setShowCreate(false)}>cancel</button>
          <button className="action-btn" onClick={createNote} disabled={!newTitle.trim()}>
            create
          </button>
        </div>
      </Modal>
    </div>
  );
}
