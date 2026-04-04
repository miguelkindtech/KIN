"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppContext";
import { uid } from "@/lib/utils";
import { VERTICAL_STATUSES } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { DocItem, InlineNote, Milestone, Vertical } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import { uploadAttachment } from "@/lib/supabase/storage";
import ConfirmModal from "@/components/ui/ConfirmModal";

const HEALTH_OPTIONS = ["stable", "watch", "critical"];
const PHASE_OPTIONS = [
  "ideation",
  "planning",
  "development",
  "pilot",
  "scaling",
];
const MILESTONE_STATUSES = ["pending", "in progress", "done"];

function VerticalCard({
  vertical,
  onSelect,
}: {
  vertical: Vertical;
  onSelect: (id: string) => void;
}) {
  const nextMilestone = vertical.milestones.find(
    (milestone) => milestone.status !== "done"
  );

  return (
    <div className="entity-card" onClick={() => onSelect(vertical.id)}>
      {vertical.proposed && <span className="proposed-badge">proposed</span>}
      <div className="entity-header">
        <div className="entity-title">{vertical.name || "untitled"}</div>
        {!vertical.proposed && <span className="badge">{vertical.status}</span>}
      </div>
      {!vertical.proposed && vertical.health ? (
        <div className="entity-meta">health: {vertical.health}</div>
      ) : null}
      {vertical.partner ? (
        <div className="entity-meta dim">partner: {vertical.partner}</div>
      ) : null}
      {nextMilestone ? (
        <div className="entity-meta dim">
          next milestone: {nextMilestone.title || "untitled milestone"}
        </div>
      ) : vertical.phase ? (
        <div className="entity-meta dim">phase: {vertical.phase}</div>
      ) : null}
      {vertical.summary ? (
        <div className="entity-subtitle">{vertical.summary}</div>
      ) : null}
    </div>
  );
}

function docKind(doc: DocItem) {
  if (doc.type.includes("pdf")) return "pdf";
  if (doc.type.includes("image")) return "image";
  return doc.type || "file";
}

function milestoneStatus(milestone: Milestone) {
  return milestone.status || "pending";
}

interface VerticalsClientProps {
  defaultId?: string;
}

export default function VerticalsClient({ defaultId }: VerticalsClientProps) {
  const { loaded, verticals, setVerticals, team, profiles } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(defaultId ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );
  const [uploadingDocsFor, setUploadingDocsFor] = useState<string | null>(null);

  const owners =
    profiles.length > 0
      ? profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
        }))
      : team.map((member) => ({
          id: member.id,
          name: member.name,
        }));

  useAutoSave(
    verticals,
    async (currentVerticals) => {
      await syncTableById(supabase, "verticals", currentVerticals, (vertical) => ({
        id: vertical.id,
        name: vertical.name,
        status: vertical.status,
        phase: vertical.phase,
        summary: vertical.summary,
        description: vertical.description,
        partner: vertical.partner,
        owner_id: vertical.ownerId || null,
        health: vertical.health,
        proposed: vertical.proposed,
        milestones: vertical.milestones,
        docs: vertical.docs,
        notes_list: vertical.notesList.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.body || note.content || "",
        })),
        updated_at: new Date().toISOString(),
      }));
    },
    300
  );

  function updateVertical(id: string, patch: Partial<Vertical>) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === id ? { ...vertical, ...patch } : vertical
      )
    );
  }

  function createVertical(proposed: boolean) {
    const vertical: Vertical = {
      id: uid(),
      name: proposed ? "New Idea" : "New Vertical",
      status: "pending review",
      phase: "planning",
      summary: "",
      description: "",
      partner: "",
      ownerId: "",
      health: proposed ? "watch" : "stable",
      milestones: [],
      docs: [],
      notesList: [],
      proposed,
    };

    setVerticals((prev) => [...prev, vertical]);
    setSelectedId(vertical.id);
    router.push(`/verticals/${vertical.id}`);
  }

  function deleteVertical(id: string) {
    setVerticals((prev) => prev.filter((vertical) => vertical.id !== id));
    setConfirmDeleteId(null);
    setSelectedId(null);
    router.push("/verticals");
  }

  function addMilestone(verticalId: string) {
    const milestone: Milestone = {
      id: uid(),
      title: "",
      ownerId: "",
      status: "pending",
      dueDate: "",
    };

    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? { ...vertical, milestones: [...vertical.milestones, milestone] }
          : vertical
      )
    );
  }

  function updateMilestone(
    verticalId: string,
    milestoneId: string,
    patch: Partial<Milestone>
  ) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? {
              ...vertical,
              milestones: vertical.milestones.map((milestone) =>
                milestone.id === milestoneId
                  ? { ...milestone, ...patch }
                  : milestone
              ),
            }
          : vertical
      )
    );
  }

  function removeMilestone(verticalId: string, milestoneId: string) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? {
              ...vertical,
              milestones: vertical.milestones.filter(
                (milestone) => milestone.id !== milestoneId
              ),
            }
          : vertical
      )
    );
  }

  async function handleDocUpload(verticalId: string, file: File) {
    setUploadingDocsFor(verticalId);
    try {
      const doc = await uploadAttachment(supabase, file, "verticals", verticalId);
      setVerticals((prev) =>
        prev.map((vertical) =>
          vertical.id === verticalId
            ? { ...vertical, docs: [...vertical.docs, doc] }
            : vertical
        )
      );
    } finally {
      setUploadingDocsFor(null);
    }
  }

  function removeDoc(verticalId: string, docId: string) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? { ...vertical, docs: vertical.docs.filter((doc) => doc.id !== docId) }
          : vertical
      )
    );
  }

  function addNote(verticalId: string) {
    const note: InlineNote = { id: uid(), title: "", content: "", body: "" };
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? { ...vertical, notesList: [...vertical.notesList, note] }
          : vertical
      )
    );
  }

  function updateNote(
    verticalId: string,
    noteId: string,
    patch: Partial<InlineNote>
  ) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? {
              ...vertical,
              notesList: vertical.notesList.map((note) =>
                note.id === noteId ? { ...note, ...patch } : note
              ),
            }
          : vertical
      )
    );
  }

  function deleteNote(verticalId: string, noteId: string) {
    setVerticals((prev) =>
      prev.map((vertical) =>
        vertical.id === verticalId
          ? {
              ...vertical,
              notesList: vertical.notesList.filter((note) => note.id !== noteId),
            }
          : vertical
      )
    );
    setConfirmDeleteNoteId(null);
  }

  if (!loaded) {
    return <div className="loading">Loading verticals...</div>;
  }

  if (selectedId) {
    const vertical = verticals.find((item) => item.id === selectedId);

    if (!vertical) {
      setSelectedId(null);
      return null;
    }

    return (
      <div className="page">
        <button
          className="back-btn"
          onClick={() => {
            setSelectedId(null);
            router.push("/verticals");
          }}
        >
          ← back to verticals
        </button>

        <div className="detail-page">
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
              value={vertical.name}
              placeholder="vertical name"
              onChange={(event) =>
                updateVertical(vertical.id, { name: event.target.value })
              }
            />

            <div className="detail-meta-row" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="detail-label">status</span>
              <select
                className="modal-select"
                value={vertical.status}
                onChange={(event) =>
                  updateVertical(vertical.id, { status: event.target.value })
                }
              >
                {VERTICAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <span className="detail-label">phase</span>
              <select
                className="modal-select"
                value={vertical.phase}
                onChange={(event) =>
                  updateVertical(vertical.id, { phase: event.target.value })
                }
              >
                {PHASE_OPTIONS.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>

              <span className="detail-label">health</span>
              <select
                className="modal-select"
                value={vertical.health}
                onChange={(event) =>
                  updateVertical(vertical.id, { health: event.target.value })
                }
              >
                {HEALTH_OPTIONS.map((health) => (
                  <option key={health} value={health}>
                    {health}
                  </option>
                ))}
              </select>

              <span className="detail-label">owner</span>
              <select
                className="modal-select"
                value={vertical.ownerId}
                onChange={(event) =>
                  updateVertical(vertical.id, { ownerId: event.target.value })
                }
              >
                <option value="">unassigned</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">summary</div>
            <textarea
              className="notes-area"
              value={vertical.summary}
              placeholder="one-line summary"
              rows={2}
              onChange={(event) =>
                updateVertical(vertical.id, { summary: event.target.value })
              }
            />

            <div className="detail-label" style={{ marginTop: 12 }}>
              description
            </div>
            <textarea
              className="notes-area"
              value={vertical.description}
              placeholder="detailed description"
              rows={5}
              onChange={(event) =>
                updateVertical(vertical.id, { description: event.target.value })
              }
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              <div>
                <div className="detail-label">partner</div>
                <input
                  className="modal-input"
                  value={vertical.partner}
                  placeholder="partner organisation"
                  onChange={(event) =>
                    updateVertical(vertical.id, { partner: event.target.value })
                  }
                />
              </div>
              <div>
                <div className="detail-label">phase label</div>
                <input
                  className="modal-input"
                  value={vertical.phase}
                  placeholder="planning"
                  onChange={(event) =>
                    updateVertical(vertical.id, { phase: event.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">milestones</div>
              <button
                className="ghost-btn small-btn"
                onClick={() => addMilestone(vertical.id)}
              >
                + add milestone
              </button>
            </div>

            {vertical.milestones.length === 0 ? (
              <div className="empty-state">no milestones yet.</div>
            ) : (
              <div className="section-stack">
                {vertical.milestones.map((milestone) => (
                  <div key={milestone.id} className="detail-note">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr auto",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        className="modal-input"
                        value={milestone.title}
                        placeholder="milestone title"
                        onChange={(event) =>
                          updateMilestone(vertical.id, milestone.id, {
                            title: event.target.value,
                          })
                        }
                      />
                      <select
                        className="modal-select"
                        value={milestone.ownerId}
                        onChange={(event) =>
                          updateMilestone(vertical.id, milestone.id, {
                            ownerId: event.target.value,
                          })
                        }
                      >
                        <option value="">owner</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="modal-select"
                        value={milestoneStatus(milestone)}
                        onChange={(event) =>
                          updateMilestone(vertical.id, milestone.id, {
                            status: event.target.value,
                          })
                        }
                      >
                        {MILESTONE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        className="item-delete"
                        onClick={() => removeMilestone(vertical.id, milestone.id)}
                      >
                        ×
                      </button>
                    </div>
                    <input
                      className="modal-input"
                      type="date"
                      value={milestone.dueDate}
                      onChange={(event) =>
                        updateMilestone(vertical.id, milestone.id, {
                          dueDate: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">documents</div>
              <label className="ghost-btn small-btn">
                {uploadingDocsFor === vertical.id ? "uploading..." : "+ upload"}
                <input
                  type="file"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await handleDocUpload(vertical.id, file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {vertical.docs.length === 0 ? (
              <div className="empty-state">no documents yet.</div>
            ) : (
              <div className="section-stack">
                {vertical.docs.map((doc) => (
                  <div key={doc.id} className="list-item">
                    <div className="list-item-main">
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.name}
                      </a>
                      <div className="dim">{docKind(doc)}</div>
                    </div>
                    <button
                      className="item-delete"
                      onClick={() => removeDoc(vertical.id, doc.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">internal notes</div>
              <button
                className="ghost-btn small-btn"
                onClick={() => addNote(vertical.id)}
              >
                + add note
              </button>
            </div>

            {vertical.notesList.length === 0 ? (
              <div className="empty-state">no notes yet.</div>
            ) : (
              <div className="section-stack">
                {vertical.notesList.map((note) => (
                  <div key={note.id} className="detail-note">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <input
                        className="modal-input"
                        style={{ fontWeight: 600, flex: 1, marginRight: 8 }}
                        value={note.title}
                        placeholder="note title"
                        onChange={(event) =>
                          updateNote(vertical.id, note.id, {
                            title: event.target.value,
                          })
                        }
                      />
                      <button
                        className="item-delete"
                        onClick={() => setConfirmDeleteNoteId(note.id)}
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      className="notes-area"
                      value={note.body || note.content || ""}
                      placeholder="note body"
                      rows={4}
                      onChange={(event) =>
                        updateNote(vertical.id, note.id, {
                          body: event.target.value,
                          content: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {vertical.proposed ? (
            <div className="proposed-section">
              <div className="detail-label" style={{ marginBottom: 8 }}>
                This vertical is a proposed idea. It is not yet a confirmed company
                activity.
              </div>
              <button
                className="action-btn"
                onClick={() =>
                  updateVertical(vertical.id, {
                    proposed: false,
                    status: "pending review",
                  })
                }
              >
                confirm vertical
              </button>
            </div>
          ) : null}

          <div className="detail-section" style={{ marginTop: 32 }}>
            <button
              className="danger-btn small-btn"
              onClick={() => setConfirmDeleteId(vertical.id)}
            >
              delete vertical
            </button>
          </div>
        </div>

        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteVertical(confirmDeleteId!)}
          label={`"${vertical.name || "untitled"}"`}
        />
        <ConfirmModal
          show={confirmDeleteNoteId !== null}
          onClose={() => setConfirmDeleteNoteId(null)}
          onConfirm={() => deleteNote(vertical.id, confirmDeleteNoteId!)}
          label="this note"
        />
      </div>
    );
  }

  const confirmed = verticals.filter((vertical) => !vertical.proposed);
  const proposed = verticals.filter((vertical) => vertical.proposed);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">vertical solutions</div>
          <div className="page-subtitle">
            active product lines and proposed ideas.
          </div>
        </div>
        <button className="action-btn" onClick={() => createVertical(true)}>
          + propose vertical
        </button>
      </div>

      {confirmed.length === 0 ? (
        <div className="empty-state">no confirmed verticals yet.</div>
      ) : (
        <div className="cards-grid">
          {confirmed.map((vertical) => (
            <VerticalCard
              key={vertical.id}
              vertical={vertical}
              onSelect={(id) => {
                setSelectedId(id);
                router.push(`/verticals/${id}`);
              }}
            />
          ))}
        </div>
      )}

      {proposed.length > 0 ? (
        <div className="proposed-section top-space">
          <div className="section-title" style={{ marginBottom: 12 }}>
            proposed ideas
          </div>
          <div className="cards-grid">
            {proposed.map((vertical) => (
              <VerticalCard
                key={vertical.id}
                vertical={vertical}
                onSelect={(id) => {
                  setSelectedId(id);
                  router.push(`/verticals/${id}`);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
