"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { MouseEvent } from "react";
import { useApp } from "@/providers/AppContext";
import {
  uid,
  formatDate,
  addDays,
  startOfWeek,
  getEventMeta,
  addMinutes,
} from "@/lib/utils";
import { EVENT_TYPES, WEEKDAYS } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { CalendarEvent, DayFollowUpItem, DocItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import { uploadAttachment } from "@/lib/supabase/storage";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Slots: 07:00 → 21:30 every 30 min
function buildSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 21) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  // Include 21:30 as the last slot end marker
  slots.push("21:30");
  return slots;
}

const SLOTS = buildSlots(); // "07:00" … "21:30"
const SLOT_HEIGHT = 28; // px per 30-min slot
const HEADER_HEIGHT = 42; // px for day-head row

function slotIndex(time: string): number {
  return SLOTS.indexOf(time);
}

function slotFromIndex(idx: number): string {
  return SLOTS[Math.max(0, Math.min(idx, SLOTS.length - 1))];
}

// Duration in minutes → number of slots
function durationSlots(minutes: number): number {
  return Math.round(minutes / 30);
}

// ---------------------------------------------------------------------------
// EventPill
// ---------------------------------------------------------------------------

function EventPill({
  event,
  topSlot,
  onClick,
}: {
  event: CalendarEvent;
  topSlot: number;
  onClick: (id: string) => void;
}) {
  const meta = getEventMeta(event.type);
  const slots = durationSlots(event.duration || 60);
  const top = topSlot * SLOT_HEIGHT;
  const height = Math.max(slots * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);

  return (
    <div
      className="week-event"
      style={{
        position: "absolute",
        top,
        left: 2,
        right: 2,
        height,
        background: meta.color,
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: "0.72rem",
        color: "#fff",
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 2,
        lineHeight: "1.3",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event.id);
      }}
    >
      <strong>{event.title}</strong>
      <div style={{ opacity: 0.85 }}>{event.time} · {event.duration}m</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarClient
// ---------------------------------------------------------------------------

export default function CalendarClient() {
  const {
    loaded,
    events,
    setEvents,
    notes,
    verticals,
    b2a,
    dayNotes,
    setDayNotes,
    dayFollowUps,
    setDayFollowUps,
    dayDecisions,
    setDayDecisions,
  } = useApp();
  const supabase = useMemo(() => createClient(), []);

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekBase = addDays(startOfWeek(today), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekBase, i));

  // Selection
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; slot: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: formatDate(today),
    time: "09:00",
    type: "internal",
    duration: "60",
    notes: "",
  });

  // Drag state
  const dragRef = useRef<{
    date: string;
    startIdx: number;
    currentIdx: number;
  } | null>(null);
  const [dragRange, setDragRange] = useState<{
    date: string;
    startIdx: number;
    endIdx: number;
  } | null>(null);

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<string | null>(
    null
  );

  // Follow-up input
  const [followUpInput, setFollowUpInput] = useState("");

  useAutoSave(
    events,
    async (currentEvents) => {
      await syncTableById(supabase, "events", currentEvents, (event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        start_time: event.time,
        end_time: addMinutes(event.time, event.duration || 60),
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

  useAutoSave(
    { dayNotes, dayFollowUps },
    async (currentState) => {
      const dates = Array.from(
        new Set([
          ...Object.keys(currentState.dayNotes),
          ...Object.keys(currentState.dayFollowUps),
        ])
      ).filter(Boolean);

      if (dates.length === 0) return;

      await supabase.from("day_notes").upsert(
        dates.map((date) => ({
          date,
          content: currentState.dayNotes[date] || "",
          todos: currentState.dayFollowUps[date] || [],
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "date" }
      );
    },
    300
  );

  // ---------------------------------------------------------------------------
  // Event helpers
  // ---------------------------------------------------------------------------

  function createEvent(patch: Partial<CalendarEvent> = {}) {
    const ev: CalendarEvent = {
      id: uid(),
      title: form.title.trim() || "untitled",
      date: form.date,
      time: form.time,
      type: form.type,
      duration: parseInt(form.duration, 10) || 60,
      notes: form.notes,
      attachments: [],
      linkedNoteId: "",
      linkedVerticalId: "",
      linkedB2AId: "",
      ...patch,
    };
    setEvents((prev) => [...prev, ev]);
    setShowCreate(false);
    resetForm();
    return ev;
  }

  function updateEvent(id: string, patch: Partial<CalendarEvent>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
    setDetailId(null);
  }

  async function addAttachment(eventId: string, file: File) {
    setUploadingAttachmentFor(eventId);
    try {
      const attachment = await uploadAttachment(supabase, file, "events", eventId);
      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? { ...event, attachments: [...event.attachments, attachment] }
            : event
        )
      );
    } finally {
      setUploadingAttachmentFor(null);
    }
  }

  function removeAttachment(eventId: string, attachmentId: string) {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              attachments: event.attachments.filter(
                (attachment) => attachment.id !== attachmentId
              ),
            }
          : event
      )
    );
  }

  function resetForm() {
    setForm({ title: "", date: formatDate(today), time: "09:00", type: "internal", duration: "60", notes: "" });
  }

  // ---------------------------------------------------------------------------
  // Drag helpers
  // ---------------------------------------------------------------------------

  function handleSlotMouseDown(date: string, slotIdx: number, e: MouseEvent) {
    // Only on empty slots (no event overlapping)
    e.preventDefault();
    dragRef.current = { date, startIdx: slotIdx, currentIdx: slotIdx };
    setDragRange({ date, startIdx: slotIdx, endIdx: slotIdx });
  }

  function handleSlotMouseEnter(date: string, slotIdx: number) {
    if (!dragRef.current || dragRef.current.date !== date) return;
    dragRef.current.currentIdx = slotIdx;
    setDragRange({
      date,
      startIdx: dragRef.current.startIdx,
      endIdx: slotIdx,
    });
  }

  function handleMouseUp() {
    if (!dragRef.current) return;
    const { date, startIdx, currentIdx } = dragRef.current;
    const minIdx = Math.min(startIdx, currentIdx);
    const maxIdx = Math.max(startIdx, currentIdx);
    const durationMin = (maxIdx - minIdx + 1) * 30;
    const time = slotFromIndex(minIdx);

    dragRef.current = null;
    setDragRange(null);

    // Open create modal prefilled
    setForm((prev) => ({
      ...prev,
      date,
      time,
      duration: String(durationMin),
    }));
    setShowCreate(true);
  }

  // Attach global mouseup
  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) {
    return <div className="loading">Loading calendar...</div>;
  }

  // ---------------------------------------------------------------------------
  // Day notes / follow-ups / decisions helpers
  // ---------------------------------------------------------------------------

  function setDayNote(date: string, text: string) {
    setDayNotes((prev) => ({ ...prev, [date]: text }));
  }

  function setDayDecision(date: string, text: string) {
    setDayDecisions((prev) => ({ ...prev, [date]: text }));
  }

  function addFollowUp(date: string, text: string) {
    if (!text.trim()) return;
    const item: DayFollowUpItem = { id: uid(), text: text.trim(), done: false };
    setDayFollowUps((prev) => ({
      ...prev,
      [date]: [...(prev[date] || []), item],
    }));
  }

  function toggleFollowUp(date: string, itemId: string) {
    setDayFollowUps((prev) => ({
      ...prev,
      [date]: (prev[date] || []).map((f) =>
        f.id === itemId ? { ...f, done: !f.done } : f
      ),
    }));
  }

  function deleteFollowUp(date: string, itemId: string) {
    setDayFollowUps((prev) => ({
      ...prev,
      [date]: (prev[date] || []).filter((f) => f.id !== itemId),
    }));
  }

  function attachmentKind(attachment: DocItem) {
    if (attachment.type.includes("pdf")) return "pdf";
    if (attachment.type.includes("image")) return "image";
    return attachment.type || "file";
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  if (detailId !== null) {
    const ev = events.find((e) => e.id === detailId);
    if (!ev) {
      setDetailId(null);
      return null;
    }

    return (
      <div className="page">
        <button className="back-btn" onClick={() => setDetailId(null)}>
          ← back to calendar
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
              value={ev.title}
              placeholder="event title"
              onChange={(e) => updateEvent(ev.id, { title: e.target.value })}
            />

            <div className="detail-meta-row" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="detail-label">date</span>
              <input
                className="modal-input"
                type="date"
                value={ev.date}
                onChange={(e) => updateEvent(ev.id, { date: e.target.value })}
                style={{ width: 140 }}
              />

              <span className="detail-label">time</span>
              <input
                className="modal-input"
                type="time"
                value={ev.time}
                onChange={(e) => updateEvent(ev.id, { time: e.target.value })}
                style={{ width: 110 }}
              />

              <span className="detail-label">type</span>
              <select
                className="modal-select"
                value={ev.type}
                onChange={(e) => updateEvent(ev.id, { type: e.target.value })}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>

              <span className="detail-label">duration</span>
              <select
                className="modal-select"
                value={String(ev.duration)}
                onChange={(e) => updateEvent(ev.id, { duration: parseInt(e.target.value, 10) })}
              >
                {[30, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">notes</div>
            <textarea
              className="notes-area"
              value={ev.notes}
              placeholder="event notes"
              rows={4}
              onChange={(e) => updateEvent(ev.id, { notes: e.target.value })}
            />
          </div>

          <div className="detail-section">
            <div className="section-title">links</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <div>
                <div className="detail-label">linked note</div>
                <select
                  className="modal-select"
                  value={ev.linkedNoteId}
                  onChange={(e) => updateEvent(ev.id, { linkedNoteId: e.target.value })}
                >
                  <option value="">none</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>{n.title || "untitled"}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="detail-label">linked vertical</div>
                <select
                  className="modal-select"
                  value={ev.linkedVerticalId}
                  onChange={(e) => updateEvent(ev.id, { linkedVerticalId: e.target.value })}
                >
                  <option value="">none</option>
                  {verticals.filter((v) => !v.proposed).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="detail-label">linked b2a</div>
                <select
                  className="modal-select"
                  value={ev.linkedB2AId}
                  onChange={(e) => updateEvent(ev.id, { linkedB2AId: e.target.value })}
                >
                  <option value="">none</option>
                  {b2a.filter((b) => !b.proposed).map((b) => (
                    <option key={b.id} value={b.id}>{b.company}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">attachments</div>
              <label className="ghost-btn small-btn">
                {uploadingAttachmentFor === ev.id ? "uploading..." : "+ upload"}
                <input
                  type="file"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await addAttachment(ev.id, file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {ev.attachments.length === 0 && (
              <div className="empty-state">no attachments yet.</div>
            )}
            {ev.attachments.length > 0 && (
              <div className="section-stack">
                {ev.attachments.map((attachment) => (
                  <div key={attachment.id} className="list-item">
                    <div className="list-item-main">
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        {attachment.name}
                      </a>
                      <div className="dim">{attachmentKind(attachment)}</div>
                    </div>
                    <button
                      className="item-delete"
                      onClick={() => removeAttachment(ev.id, attachment.id)}
                      title="remove attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="detail-section" style={{ marginTop: 32 }}>
            <button
              className="danger-btn small-btn"
              onClick={() => setConfirmDeleteId(ev.id)}
            >
              delete event
            </button>
          </div>
        </div>

        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteEvent(confirmDeleteId!)}
          label={`"${ev.title}"`}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Calendar view
  // ---------------------------------------------------------------------------

  const selectedDate = selectedSlot?.date ?? formatDate(today);

  // Events map: date → events[]
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  const selectedDayEvents = eventsByDate[selectedDate] || [];
  const selectedSlotEvent = selectedSlot
    ? selectedDayEvents.find((ev) => ev.time === selectedSlot.slot)
    : null;

  const followUpsForDay = dayFollowUps[selectedDate] || [];

  return (
    <div className="page">
      {/* Week navigation */}
      <div className="page-header">
        <div>
          <div className="page-title">calendar</div>
          <div className="page-subtitle">
            {weekBase.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {" — "}
            {addDays(weekBase, 6).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ghost-btn" onClick={() => setWeekOffset((o) => o - 1)}>‹ prev</button>
          <button className="ghost-btn" onClick={() => { setWeekOffset(0); }}>today</button>
          <button className="ghost-btn" onClick={() => setWeekOffset((o) => o + 1)}>next ›</button>
          <button
            className="action-btn"
            onClick={() => {
              setForm((prev) => ({ ...prev, date: selectedDate }));
              setShowCreate(true);
            }}
          >
            + event
          </button>
        </div>
      </div>

      <div className="calendar-shell">
        {/* ── Week grid ── */}
        <div className="week-grid-wrap">
          {/* Hours column + day columns */}
          <div style={{ display: "flex" }}>
            {/* Hour labels */}
            <div className="week-grid-hours">
              <div style={{ height: HEADER_HEIGHT }} /> {/* spacer for day head */}
              {SLOTS.slice(0, -1).map((slot) => (
                <div
                  key={slot}
                  className="week-grid-hour"
                  style={{ height: SLOT_HEIGHT }}
                >
                  {slot.endsWith(":00") ? slot : ""}
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="week-grid-days">
              {weekDays.map((day) => {
                const dateStr = formatDate(day);
                const isToday = dateStr === formatDate(today);
                const dayEvents = eventsByDate[dateStr] || [];

                return (
                  <div key={dateStr} className="week-day">
                    {/* Day header */}
                    <div
                      className={`week-day-head${isToday ? " today" : ""}`}
                      style={{ height: HEADER_HEIGHT }}
                    >
                      <span className="week-day-label">
                        {WEEKDAYS[weekDays.findIndex((candidate) => candidate.getTime() === day.getTime())]}
                      </span>
                      <span className="week-day-number">{day.getDate()}</span>
                    </div>

                    {/* Slot rows — relative container for event positioning */}
                    <div style={{ position: "relative" }}>
                      {/* Background slot rows */}
                      {SLOTS.slice(0, -1).map((slot, idx) => {
                        const isDragged =
                          dragRange !== null &&
                          dragRange.date === dateStr &&
                          idx >= Math.min(dragRange.startIdx, dragRange.endIdx) &&
                          idx <= Math.max(dragRange.startIdx, dragRange.endIdx);
                        const isSelected =
                          selectedSlot?.date === dateStr && selectedSlot?.slot === slot;

                        return (
                          <div
                            key={slot}
                            className={`week-slot${isSelected ? " selected" : ""}${isDragged ? " dragged" : ""}`}
                            style={{ height: SLOT_HEIGHT }}
                            onClick={() => {
                              setSelectedSlot({ date: dateStr, slot });
                            }}
                            onMouseDown={(e) => handleSlotMouseDown(dateStr, idx, e)}
                            onMouseEnter={() => handleSlotMouseEnter(dateStr, idx)}
                            onDoubleClick={() => {
                              const ev = dayEvents.find((e) => e.time === slot);
                              if (ev) setDetailId(ev.id);
                            }}
                          />
                        );
                      })}

                      {/* Absolute-positioned events */}
                      {dayEvents.map((ev) => {
                        const idx = slotIndex(ev.time);
                        if (idx < 0) return null;
                        return (
                          <EventPill
                            key={ev.id}
                            event={ev}
                            topSlot={idx}
                            onClick={setDetailId}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="calendar-sidebar">
          {/* Selected date label */}
          <div className="card" style={{ marginBottom: 12, padding: "14px 16px" }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </div>

            {selectedSlot ? (
              selectedSlotEvent ? (
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{selectedSlotEvent.title}</div>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {selectedSlotEvent.time} · {selectedSlotEvent.duration}min · {selectedSlotEvent.type}
                  </div>
                  <button
                    className="ghost-btn small-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setDetailId(selectedSlotEvent.id)}
                  >
                    open →
                  </button>
                </div>
              ) : (
                <div>
                  <div className="muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>
                    {selectedSlot.slot} — empty slot
                  </div>
                  <button
                    className="action-btn small-btn"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        date: selectedDate,
                        time: selectedSlot.slot,
                      }));
                      setShowCreate(true);
                    }}
                  >
                    + add block here
                  </button>
                </div>
              )
            ) : (
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                click a slot to select it
              </div>
            )}
          </div>

          {/* Day notes */}
          <div className="card" style={{ marginBottom: 12, padding: "14px 16px" }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>notes for the day</div>
            <textarea
              className="notes-area"
              rows={3}
              value={dayNotes[selectedDate] || ""}
              placeholder="capture thoughts for this day…"
              onChange={(e) => setDayNote(selectedDate, e.target.value)}
            />
          </div>

          {/* Decisions */}
          <div className="card" style={{ marginBottom: 12, padding: "14px 16px" }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>decisions</div>
            <textarea
              className="notes-area"
              rows={3}
              value={dayDecisions[selectedDate] || ""}
              placeholder="decisions made today…"
              onChange={(e) => setDayDecision(selectedDate, e.target.value)}
            />
          </div>

          {/* Follow-ups */}
          <div className="card" style={{ padding: "14px 16px" }}>
            <div className="detail-label" style={{ marginBottom: 8 }}>follow-ups</div>
            <div className="list-stack">
              {followUpsForDay.map((item) => (
                <div key={item.id} className="list-item">
                  <button
                    className={`todo-check${item.done ? " done" : ""}`}
                    onClick={() => toggleFollowUp(selectedDate, item.id)}
                    style={{ flexShrink: 0 }}
                    aria-label={item.done ? "uncheck" : "check"}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                  <span
                    className="list-item-main"
                    style={{
                      fontSize: "0.85rem",
                      textDecoration: item.done ? "line-through" : "none",
                      opacity: item.done ? 0.5 : 1,
                    }}
                  >
                    {item.text}
                  </span>
                  <button
                    className="item-delete"
                    onClick={() => deleteFollowUp(selectedDate, item.id)}
                    title="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                className="modal-input"
                style={{ flex: 1, fontSize: "0.8rem" }}
                value={followUpInput}
                placeholder="add follow-up…"
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addFollowUp(selectedDate, followUpInput);
                    setFollowUpInput("");
                  }
                }}
              />
              <button
                className="ghost-btn small-btn"
                onClick={() => {
                  addFollowUp(selectedDate, followUpInput);
                  setFollowUpInput("");
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create event modal ── */}
      <Modal
        show={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title="new event"
      >
        <div className="modal-field">
          <label className="modal-label">title</label>
          <input
            className="modal-input"
            value={form.title}
            placeholder="event title"
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">date</label>
          <input
            className="modal-input"
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">time</label>
          <input
            className="modal-input"
            type="time"
            value={form.time}
            onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">type</label>
          <select
            className="modal-select"
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">duration</label>
          <select
            className="modal-select"
            value={form.duration}
            onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
          >
            {[30, 60, 90, 120].map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => { setShowCreate(false); resetForm(); }}>
            cancel
          </button>
          <button
            className="action-btn"
            onClick={() => createEvent()}
            disabled={!form.title.trim() && true}
          >
            create
          </button>
        </div>
      </Modal>
    </div>
  );
}
