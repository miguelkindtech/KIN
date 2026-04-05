"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppContext";
import { addMinutes, formatDate, uid } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { B2AItem, CalendarEvent, InlineNote } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import ConfirmModal from "@/components/ui/ConfirmModal";
import RichDocEditor from "@/components/ui/RichDocEditor";

function sortMeetings(a: CalendarEvent, b: CalendarEvent) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.time || "").localeCompare(b.time || "");
}

function formatMeetingLabel(event: CalendarEvent) {
  const day = new Date(`${event.date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (event.allDay) return `${day} · all day`;
  return `${day} · ${event.time} · ${event.duration} min`;
}

function toDocHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return value;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function AppliedCard({
  item,
  meetingCount,
  solutionCount,
  onSelect,
}: {
  item: B2AItem;
  meetingCount: number;
  solutionCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="entity-card" onClick={() => onSelect(item.id)}>
      <div className="entity-header">
        <div className="entity-title">{item.company || "untitled company"}</div>
      </div>
      <div className="entity-subtitle">open workspace</div>
      <div className="entity-meta" style={{ marginTop: 10 }}>
        {meetingCount} meeting{meetingCount === 1 ? "" : "s"} · {solutionCount}{" "}
        solution{solutionCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

interface B2AClientProps {
  defaultId?: string;
}

export default function B2AClient({ defaultId }: B2AClientProps) {
  const { loaded, b2a, setB2A, events, setEvents } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(defaultId ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteSolutionId, setConfirmDeleteSolutionId] = useState<string | null>(null);
  const [docView, setDocView] = useState<
    | null
    | { type: "operation" | "strategy" | "solution"; solutionId?: string }
  >(null);

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
        proposed: false,
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

  useAutoSave(
    events,
    async (currentEvents) => {
      await syncTableById(supabase, "events", currentEvents, (event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        start_time: event.allDay ? null : event.time,
        end_time: event.allDay ? null : addMinutes(event.time, event.duration || 60),
        description: event.notes || "",
        linked_to: event.linkedVerticalId
          ? `vertical:${event.linkedVerticalId}`
          : event.linkedB2AId
          ? `b2a:${event.linkedB2AId}`
          : null,
        attachments: event.attachments || [],
        updated_at: new Date().toISOString(),
      }));
    },
    300
  );

  if (!loaded) {
    return <div className="loading">Loading Applied...</div>;
  }

  function updateItem(id: string, patch: Partial<B2AItem>) {
    setB2A((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function createApplied() {
    const item: B2AItem = {
      id: uid(),
      company: "New company",
      status: "active",
      ownerId: "",
      summary: "",
      challenge: "",
      fronts: [],
      nextSteps: [],
      contacts: [],
      docs: [],
      notes: "",
      proposed: false,
      notesList: [],
    };

    setB2A((prev) => [...prev, item]);
    setSelectedId(item.id);
    router.push(`/b2a/${item.id}`);
  }

  function deleteItem(id: string) {
    setB2A((prev) => prev.filter((item) => item.id !== id));
    setEvents((prev) => prev.filter((event) => event.linkedB2AId !== id));
    setConfirmDeleteId(null);
    setSelectedId(null);
    router.push("/b2a");
  }

  function addMeeting(itemId: string) {
    const today = formatDate(new Date());
    const meeting: CalendarEvent = {
      id: uid(),
      title: "New meeting",
      date: today,
      time: "10:00",
      allDay: false,
      type: "b2a",
      duration: 60,
      notes: "",
      attachments: [],
      linkedNoteId: "",
      linkedVerticalId: "",
      linkedB2AId: itemId,
    };

    setEvents((prev) => [...prev, meeting]);
  }

  function updateMeeting(eventId: string, patch: Partial<CalendarEvent>) {
    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event))
    );
  }

  function deleteMeeting(eventId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  function addSolution(itemId: string) {
    const solution: InlineNote = {
      id: uid(),
      title: "",
      content: "",
      body: "",
    };

    setB2A((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, notesList: [...(item.notesList || []), solution] }
          : item
      )
    );
  }

  function updateSolution(
    itemId: string,
    solutionId: string,
    patch: Partial<InlineNote>
  ) {
    setB2A((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              notesList: (item.notesList || []).map((solution) =>
                solution.id === solutionId
                  ? {
                      ...solution,
                      ...patch,
                      content: patch.body ?? patch.content ?? solution.content ?? "",
                      body: patch.body ?? patch.content ?? solution.body ?? "",
                    }
                  : solution
              ),
            }
          : item
      )
    );
  }

  function deleteSolution(itemId: string, solutionId: string) {
    setB2A((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              notesList: (item.notesList || []).filter(
                (solution) => solution.id !== solutionId
              ),
            }
          : item
      )
    );
    setDocView(null);
    setConfirmDeleteSolutionId(null);
  }

  if (selectedId !== null) {
    const item = b2a.find((entry) => entry.id === selectedId);

    if (!item) {
      setSelectedId(null);
      return null;
    }

    const meetings = events
      .filter((event) => event.linkedB2AId === item.id)
      .slice()
      .sort(sortMeetings);

    if (docView !== null) {
      if (docView.type === "operation") {
        return (
          <RichDocEditor
            title="Operation Notes"
            value={toDocHtml(item.notes)}
            placeholder="Write about how this company operates..."
            backLabel="back to company"
            onChange={(value) => updateItem(item.id, { notes: value })}
            onBack={() => setDocView(null)}
          />
        );
      }

      if (docView.type === "strategy") {
        return (
          <RichDocEditor
            title="Applied Strategy"
            value={toDocHtml(item.summary)}
            placeholder="Shape the strategy for this applied company..."
            backLabel="back to company"
            onChange={(value) => updateItem(item.id, { summary: value })}
            onBack={() => setDocView(null)}
          />
        );
      }

      const solution = (item.notesList || []).find(
        (entry) => entry.id === docView.solutionId
      );

      if (!solution) {
        setDocView(null);
        return null;
      }

      return (
        <RichDocEditor
          title={solution.title}
          titlePlaceholder="Solution name"
          value={toDocHtml(solution.body || solution.content || "")}
          placeholder="Develop the solution here..."
          backLabel="back to company"
          onTitleChange={(value) =>
            updateSolution(item.id, solution.id, { title: value })
          }
          onChange={(value) =>
            updateSolution(item.id, solution.id, {
              body: value,
              content: value,
            })
          }
          onBack={() => setDocView(null)}
          onDelete={() => setConfirmDeleteSolutionId(solution.id)}
        />
      );
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
          ← back to applied
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
              value={item.company}
              placeholder="company name"
              onChange={(event) =>
                updateItem(item.id, { company: event.target.value })
              }
            />
            <div className="muted" style={{ fontSize: 13 }}>
              one company, one applied workspace. meetings here are the same
              events that appear in calendar.
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div>
                <div className="section-title">operation notes</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  open a full writing document
                </div>
              </div>
            </div>
            <button
              className="entity-card doc-launch-card"
              onClick={() => setDocView({ type: "operation" })}
            >
              <div className="entity-title">Operation Notes</div>
              <div className="entity-subtitle">
                open the document for operational thinking, constraints and
                company context
              </div>
            </button>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div>
                <div className="section-title">applied strategy</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  strategy lives in its own doc
                </div>
              </div>
            </div>
            <button
              className="entity-card doc-launch-card"
              onClick={() => setDocView({ type: "strategy" })}
            >
              <div className="entity-title">Applied Strategy</div>
              <div className="entity-subtitle">
                open the document for positioning, scope and approach
              </div>
            </button>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div>
                <div className="section-title">meetings</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  linked directly to calendar
                </div>
              </div>
              <button className="ghost-btn small-btn" onClick={() => addMeeting(item.id)}>
                + add meeting
              </button>
            </div>

            {meetings.length === 0 ? (
              <div className="empty-state">no meetings linked to this company yet.</div>
            ) : (
              <div className="section-stack">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="list-item">
                    <div className="section-stack">
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="modal-input"
                          style={{ flex: 1, fontWeight: 600 }}
                          value={meeting.title}
                          placeholder="meeting title"
                          onChange={(event) =>
                            updateMeeting(meeting.id, { title: event.target.value })
                          }
                        />
                        <button
                          className="item-delete"
                          onClick={() => deleteMeeting(meeting.id)}
                          title="delete meeting"
                        >
                          ×
                        </button>
                      </div>

                      <div className="detail-meta-row">
                        <span className="detail-label">date</span>
                        <input
                          className="modal-input"
                          type="date"
                          value={meeting.date}
                          style={{ width: 144 }}
                          onChange={(event) =>
                            updateMeeting(meeting.id, { date: event.target.value })
                          }
                        />

                        <label
                          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          <input
                            type="checkbox"
                            checked={meeting.allDay}
                            onChange={(event) =>
                              updateMeeting(meeting.id, {
                                allDay: event.target.checked,
                              })
                            }
                          />
                          <span className="detail-label" style={{ marginBottom: 0 }}>
                            all day
                          </span>
                        </label>

                        {!meeting.allDay ? (
                          <>
                            <span className="detail-label">time</span>
                            <input
                              className="modal-input"
                              type="time"
                              value={meeting.time}
                              style={{ width: 112 }}
                              onChange={(event) =>
                                updateMeeting(meeting.id, { time: event.target.value })
                              }
                            />

                            <span className="detail-label">duration</span>
                            <input
                              className="modal-input"
                              type="number"
                              min={30}
                              step={30}
                              value={meeting.duration}
                              style={{ width: 96 }}
                              onChange={(event) =>
                                updateMeeting(meeting.id, {
                                  duration: Math.max(
                                    30,
                                    Number(event.target.value) || 60
                                  ),
                                })
                              }
                            />
                          </>
                        ) : null}
                      </div>

                      <div className="dim">{formatMeetingLabel(meeting)}</div>

                      <div>
                        <div className="detail-label">meeting notes</div>
                        <textarea
                          className="notes-area"
                          rows={4}
                          value={meeting.notes}
                          placeholder="notes from this meeting"
                          onChange={(event) =>
                            updateMeeting(meeting.id, { notes: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div>
                <div className="section-title">applied solutions</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  solution spaces to develop what will be applied in this company
                </div>
              </div>
              <button className="ghost-btn small-btn" onClick={() => addSolution(item.id)}>
                + add solution
              </button>
            </div>

            {(item.notesList || []).length === 0 ? (
              <div className="empty-state">no applied solutions defined yet.</div>
            ) : (
              <div className="cards-grid">
                {(item.notesList || []).map((solution) => (
                  <div key={solution.id} className="entity-card doc-launch-card">
                    <div className="entity-title">
                      {solution.title || "Untitled solution"}
                    </div>
                    <div className="entity-subtitle">
                      open this solution document to develop scope, ideas and
                      implementation notes
                    </div>
                    <div className="doc-launch-actions">
                      <button
                        className="ghost-btn small-btn"
                        onClick={() =>
                          setDocView({
                            type: "solution",
                            solutionId: solution.id,
                          })
                        }
                        type="button"
                      >
                        open doc
                      </button>
                      <button
                        className="danger-btn small-btn"
                        onClick={() => setConfirmDeleteSolutionId(solution.id)}
                        type="button"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section" style={{ marginTop: 32 }}>
            <button
              className="danger-btn small-btn"
              onClick={() => setConfirmDeleteId(item.id)}
            >
              delete applied item
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
          show={confirmDeleteSolutionId !== null}
          onClose={() => setConfirmDeleteSolutionId(null)}
          onConfirm={() => deleteSolution(item.id, confirmDeleteSolutionId!)}
          label="this solution"
        />
      </div>
    );
  }

  const appliedItems = b2a.slice().sort((a, b) => a.company.localeCompare(b.company));

  return (
    <div className="page">
      <div className="page-actions">
        <button className="action-btn" onClick={createApplied}>
          + new applied
        </button>
      </div>

      {appliedItems.length === 0 ? (
        <div className="empty-state">no applied companies yet.</div>
      ) : (
        <div className="cards-grid">
          {appliedItems.map((item) => {
            const meetingCount = events.filter(
              (event) => event.linkedB2AId === item.id
            ).length;

            return (
              <AppliedCard
                key={item.id}
                item={item}
                meetingCount={meetingCount}
                solutionCount={(item.notesList || []).length}
                onSelect={(id) => {
                  setSelectedId(id);
                  router.push(`/b2a/${id}`);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
