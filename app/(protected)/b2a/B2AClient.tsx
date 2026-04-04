"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppContext";
import { uid } from "@/lib/utils";
import { B2A_STATUSES } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { B2AItem, Front, NextStep, Contact, InlineNote, DocItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import { uploadAttachment } from "@/lib/supabase/storage";
import ConfirmModal from "@/components/ui/ConfirmModal";

// ---------------------------------------------------------------------------
// B2A entity card
// ---------------------------------------------------------------------------

function B2ACard({
  item,
  onSelect,
}: {
  item: B2AItem;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="entity-card" onClick={() => onSelect(item.id)}>
      {item.proposed && <span className="proposed-badge">proposed</span>}
      <div className="entity-header">
        <div className="entity-title">{item.company || "untitled"}</div>
        {!item.proposed && <span className="badge">{item.status}</span>}
      </div>
      {item.summary && <div className="entity-subtitle">{item.summary}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B2AClient
// ---------------------------------------------------------------------------

interface B2AClientProps {
  defaultId?: string;
}

export default function B2AClient({ defaultId }: B2AClientProps) {
  const { loaded, b2a, setB2A, team } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(defaultId ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [uploadingDocsFor, setUploadingDocsFor] = useState<string | null>(null);

  useAutoSave(
    b2a,
    async (currentItems) => {
      await syncTableById(supabase, "b2a", currentItems, (item) => ({
        id: item.id,
        company: item.company,
        status: item.status,
        owner_id: item.ownerId || null,
        summary: item.summary,
        challenge: item.challenge,
        fronts: item.fronts,
        next_steps: item.nextSteps,
        contacts: item.contacts,
        docs: item.docs,
        notes: item.notes,
        proposed: item.proposed,
        notes_list: (item.notesList || []).map((note) => ({
          id: note.id,
          title: note.title,
          content: note.body || note.content || "",
        })),
        updated_at: new Date().toISOString(),
      }));
    },
    300
  );

  if (!loaded) {
    return <div className="loading">Loading B2A...</div>;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateItem(id: string, patch: Partial<B2AItem>) {
    setB2A((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function createB2A(proposed: boolean) {
    const item: B2AItem = {
      id: uid(),
      company: proposed ? "New Idea" : "New Company",
      status: "lead",
      ownerId: "",
      summary: "",
      challenge: "",
      fronts: [],
      nextSteps: [],
      contacts: [],
      docs: [],
      notes: "",
      proposed,
      notesList: [],
    };
    setB2A((prev) => [...prev, item]);
    setSelectedId(item.id);
    router.push(`/b2a/${item.id}`);
  }

  function deleteItem(id: string) {
    setB2A((prev) => prev.filter((b) => b.id !== id));
    setConfirmDeleteId(null);
    setSelectedId(null);
    router.push("/b2a");
  }

  // Fronts
  function addFront(id: string) {
    const front: Front = { id: uid(), text: "" };
    setB2A((prev) =>
      prev.map((b) => (b.id === id ? { ...b, fronts: [...b.fronts, front] } : b))
    );
  }

  function updateFront(itemId: string, frontId: string, text: string) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? { ...b, fronts: b.fronts.map((f) => (f.id === frontId ? { ...f, text } : f)) }
          : b
      )
    );
  }

  function removeFront(itemId: string, frontId: string) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId ? { ...b, fronts: b.fronts.filter((f) => f.id !== frontId) } : b
      )
    );
  }

  // Next Steps
  function addStep(id: string) {
    const step: NextStep = { id: uid(), text: "", done: false };
    setB2A((prev) =>
      prev.map((b) => (b.id === id ? { ...b, nextSteps: [...b.nextSteps, step] } : b))
    );
  }

  function updateStep(itemId: string, stepId: string, patch: Partial<NextStep>) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              nextSteps: b.nextSteps.map((s) =>
                s.id === stepId ? { ...s, ...patch } : s
              ),
            }
          : b
      )
    );
  }

  function removeStep(itemId: string, stepId: string) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? { ...b, nextSteps: b.nextSteps.filter((s) => s.id !== stepId) }
          : b
      )
    );
  }

  // Contacts
  function addContact(id: string) {
    const contact: Contact = { id: uid(), name: "", role: "", email: "" };
    setB2A((prev) =>
      prev.map((b) => (b.id === id ? { ...b, contacts: [...b.contacts, contact] } : b))
    );
  }

  function updateContact(itemId: string, contactId: string, patch: Partial<Contact>) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              contacts: b.contacts.map((c) =>
                c.id === contactId ? { ...c, ...patch } : c
              ),
            }
          : b
      )
    );
  }

  function removeContact(itemId: string, contactId: string) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? { ...b, contacts: b.contacts.filter((c) => c.id !== contactId) }
          : b
      )
    );
  }

  async function addDoc(itemId: string, file: File) {
    setUploadingDocsFor(itemId);
    try {
      const doc = await uploadAttachment(supabase, file, "b2a", itemId);
      setB2A((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, docs: [...item.docs, doc] } : item
        )
      );
    } finally {
      setUploadingDocsFor(null);
    }
  }

  function removeDoc(itemId: string, docId: string) {
    setB2A((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, docs: item.docs.filter((doc) => doc.id !== docId) }
          : item
      )
    );
  }

  // Inline notes
  function addNote(id: string) {
    const note: InlineNote = { id: uid(), title: "", content: "", body: "" };
    setB2A((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, notesList: [...(b.notesList || []), note] } : b
      )
    );
  }

  function updateNote(itemId: string, noteId: string, patch: Partial<InlineNote>) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              notesList: b.notesList.map((n) =>
                n.id === noteId ? { ...n, ...patch } : n
              ),
            }
          : b
      )
    );
  }

  function deleteNote(itemId: string, noteId: string) {
    setB2A((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? { ...b, notesList: b.notesList.filter((n) => n.id !== noteId) }
          : b
      )
    );
    setConfirmDeleteNoteId(null);
  }

  function docKind(doc: DocItem) {
    if (doc.type.includes("pdf")) return "pdf";
    if (doc.type.includes("image")) return "image";
    return doc.type || "file";
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  if (selectedId !== null) {
    const item = b2a.find((b) => b.id === selectedId);
    if (!item) {
      setSelectedId(null);
      return null;
    }

    return (
      <div className="page">
        <button
          className="back-btn"
          onClick={() => {
            setSelectedId(null);
            router.push("/b2a");
          }}
        >
          ← back to b2a
        </button>

        <div className="detail-page">
          {/* Section 1 — identity */}
          <div className="detail-section">
            <input
              style={{
                fontSize: 21,
                fontWeight: 600,
                background: "transparent",
                border: "none",
                outline: "none",
                width: "100%",
                marginBottom: 12,
              }}
              value={item.company}
              placeholder="company name"
              onChange={(e) => updateItem(item.id, { company: e.target.value })}
            />

            <div className="detail-meta-row">
              <span className="detail-label">status</span>
              <select
                className="modal-select"
                value={item.status}
                onChange={(e) => updateItem(item.id, { status: e.target.value })}
              >
                {B2A_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <span className="detail-label">owner</span>
              <select
                className="modal-select"
                value={item.ownerId}
                onChange={(e) => updateItem(item.id, { ownerId: e.target.value })}
              >
                <option value="">unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="detail-label">summary</div>
              <textarea
                className="notes-area"
                value={item.summary}
                placeholder="short summary of the opportunity"
                rows={2}
                onChange={(e) => updateItem(item.id, { summary: e.target.value })}
              />
            </div>
          </div>

          {/* Section 2 — challenge */}
          <div className="detail-section">
            <div className="detail-label">challenge</div>
            <textarea
              className="notes-area"
              value={item.challenge}
              placeholder="what problem or challenge does this company face?"
              rows={3}
              onChange={(e) => updateItem(item.id, { challenge: e.target.value })}
            />
          </div>

          {/* Section 3 — AI fronts */}
          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">ai fronts</div>
              <button className="ghost-btn small-btn" onClick={() => addFront(item.id)}>
                + add
              </button>
            </div>
            {item.fronts.length === 0 && (
              <div className="empty-state">no fronts defined yet.</div>
            )}
            <div className="section-stack">
              {item.fronts.map((front) => (
                <div key={front.id} className="detail-front list-item">
                  <input
                    className="modal-input list-item-main"
                    value={front.text}
                    placeholder="describe this AI front"
                    onChange={(e) => updateFront(item.id, front.id, e.target.value)}
                  />
                  <button
                    className="item-delete"
                    onClick={() => removeFront(item.id, front.id)}
                    title="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4 — next steps */}
          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">next steps</div>
              <button className="ghost-btn small-btn" onClick={() => addStep(item.id)}>
                + add
              </button>
            </div>
            {item.nextSteps.length === 0 && (
              <div className="empty-state">no next steps yet.</div>
            )}
            <div className="section-stack">
              {item.nextSteps.map((step) => (
                <div key={step.id} className="detail-step list-item">
                  <button
                    className={`todo-check${step.done ? " done" : ""}`}
                    onClick={() => updateStep(item.id, step.id, { done: !step.done })}
                    style={{ flexShrink: 0 }}
                    aria-label={step.done ? "mark undone" : "mark done"}
                  >
                    {step.done ? "✓" : ""}
                  </button>
                  <input
                    className="modal-input list-item-main"
                    value={step.text}
                    placeholder="next step"
                    style={{ textDecoration: step.done ? "line-through" : "none", opacity: step.done ? 0.5 : 1 }}
                    onChange={(e) => updateStep(item.id, step.id, { text: e.target.value })}
                  />
                  <button
                    className="item-delete"
                    onClick={() => removeStep(item.id, step.id)}
                    title="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5 — contacts */}
          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">contacts</div>
              <button className="ghost-btn small-btn" onClick={() => addContact(item.id)}>
                + add
              </button>
            </div>
            {item.contacts.length === 0 && (
              <div className="empty-state">no contacts yet.</div>
            )}
            <div className="section-stack">
              {item.contacts.map((contact) => (
                <div key={contact.id} className="detail-contact">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      className="modal-input"
                      style={{ flex: 2 }}
                      value={contact.name}
                      placeholder="name"
                      onChange={(e) => updateContact(item.id, contact.id, { name: e.target.value })}
                    />
                    <input
                      className="modal-input"
                      style={{ flex: 1 }}
                      value={contact.role}
                      placeholder="role"
                      onChange={(e) => updateContact(item.id, contact.id, { role: e.target.value })}
                    />
                    <button
                      className="item-delete"
                      onClick={() => removeContact(item.id, contact.id)}
                      title="remove"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    className="modal-input"
                    value={contact.email || ""}
                    placeholder="email"
                    onChange={(e) => updateContact(item.id, contact.id, { email: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">documents</div>
              <label className="ghost-btn small-btn">
                {uploadingDocsFor === item.id ? "uploading..." : "+ upload"}
                <input
                  type="file"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await addDoc(item.id, file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {item.docs.length === 0 && (
              <div className="empty-state">no documents yet.</div>
            )}
            {item.docs.length > 0 && (
              <div className="section-stack">
                {item.docs.map((doc) => (
                  <div key={doc.id} className="list-item">
                    <div className="list-item-main">
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.name}
                      </a>
                      <div className="dim">{docKind(doc)}</div>
                    </div>
                    <button
                      className="item-delete"
                      onClick={() => removeDoc(item.id, doc.id)}
                      title="remove document"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6 — notes */}
          <div className="detail-section">
            <div className="detail-label">general notes</div>
            <textarea
              className="notes-area"
              value={item.notes}
              placeholder="free-form notes"
              rows={3}
              onChange={(e) => updateItem(item.id, { notes: e.target.value })}
            />

            <div className="section-header" style={{ marginTop: 16 }}>
              <div className="section-title">structured notes</div>
              <button className="ghost-btn small-btn" onClick={() => addNote(item.id)}>
                + add
              </button>
            </div>
            {(item.notesList || []).length === 0 && (
              <div className="empty-state">no notes yet.</div>
            )}
            <div className="section-stack">
              {(item.notesList || []).map((note) => (
                <div key={note.id} className="detail-note">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <input
                      className="modal-input"
                      style={{ fontWeight: 600, flex: 1, marginRight: 8 }}
                      value={note.title}
                      placeholder="note title"
                      onChange={(e) => updateNote(item.id, note.id, { title: e.target.value })}
                    />
                    <button
                      className="item-delete"
                      onClick={() => setConfirmDeleteNoteId(note.id)}
                      title="delete note"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    className="notes-area"
                    value={note.body}
                    placeholder="note body"
                    rows={3}
                    onChange={(e) => updateNote(item.id, note.id, { body: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 7 — proposed banner */}
          {item.proposed && (
            <div className="proposed-section">
              <div className="detail-label" style={{ marginBottom: 8 }}>
                this b2a is still a proposed idea.
              </div>
              <p className="muted" style={{ marginBottom: 12, fontSize: "0.875rem" }}>
                confirm it to move it into the active b2a pipeline as a lead.
              </p>
              <button
                className="action-btn"
                onClick={() => updateItem(item.id, { proposed: false, status: "lead" })}
              >
                confirm b2a
              </button>
            </div>
          )}

          {/* Danger zone */}
          <div className="detail-section" style={{ marginTop: 32 }}>
            <button
              className="danger-btn small-btn"
              onClick={() => setConfirmDeleteId(item.id)}
            >
              delete b2a item
            </button>
          </div>
        </div>

        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteItem(confirmDeleteId!)}
          label={`"${item.company || "untitled"}"`}
        />
        <ConfirmModal
          show={confirmDeleteNoteId !== null}
          onClose={() => setConfirmDeleteNoteId(null)}
          onConfirm={() => deleteNote(item.id, confirmDeleteNoteId!)}
          label="this note"
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  const confirmed = b2a.filter((b) => !b.proposed);
  const proposed = b2a.filter((b) => b.proposed);

  // Group confirmed by status, preserve B2A_STATUSES order
  const grouped: Record<string, B2AItem[]> = {};
  B2A_STATUSES.forEach((s) => {
    const items = confirmed.filter((b) => b.status === s);
    if (items.length > 0) grouped[s] = items;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">b2a</div>
          <div className="page-subtitle">business-to-ai pipeline.</div>
        </div>
        <button className="action-btn" onClick={() => createB2A(true)}>
          + propose b2a
        </button>
      </div>

      {confirmed.length === 0 && (
        <div className="empty-state">no b2a items in the pipeline yet.</div>
      )}

      {Object.entries(grouped).map(([status, items]) => (
        <section key={status} className="top-space">
          <div className="section-title" style={{ marginBottom: 10 }}>{status}</div>
          <div className="cards-grid">
            {items.map((b) => (
              <B2ACard
                key={b.id}
                item={b}
                onSelect={(id) => {
                  setSelectedId(id);
                  router.push(`/b2a/${id}`);
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {proposed.length > 0 && (
        <div className="proposed-section top-space">
          <div className="section-title" style={{ marginBottom: 12 }}>proposed ideas</div>
          <div className="cards-grid">
            {proposed.map((b) => (
              <B2ACard
                key={b.id}
                item={b}
                onSelect={(id) => {
                  setSelectedId(id);
                  router.push(`/b2a/${id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
