"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useApp } from "@/providers/AppContext";
import {
  uid,
  formatDate,
  addDays,
  startOfWeek,
  getFirstDayOfMonth,
  getEventMeta,
  addMinutes,
} from "@/lib/utils";
import { EVENT_TYPES, WEEKDAYS } from "@/lib/constants";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { CalendarEvent, DocItem } from "@/lib/types";
import {
  dailyTodoDateFromLink,
  extractDailyTodoTasks,
} from "@/lib/utils/dailyTodos";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import { uploadAttachment } from "@/lib/supabase/storage";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour < 21) slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  slots.push("21:30");
  return slots;
}

const SLOTS = buildSlots();
const SLOT_HEIGHT = 28;
const HEADER_HEIGHT = 42;

function slotIndex(time: string) {
  return SLOTS.indexOf(time);
}

function slotFromIndex(index: number) {
  return SLOTS[Math.max(0, Math.min(index, SLOTS.length - 1))];
}

function durationSlots(minutes: number) {
  return Math.round(minutes / 30);
}

function parseDateValue(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLongDate(dateStr: string) {
  return parseDateValue(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.time || "").localeCompare(b.time || "");
}

function attachmentKind(attachment: DocItem) {
  if (attachment.type.includes("pdf")) return "pdf";
  if (attachment.type.includes("image")) return "image";
  return attachment.type || "file";
}

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
        top,
        left: 2,
        right: 2,
        height,
        background: meta.color,
      }}
      onClick={(eventClick) => {
        eventClick.stopPropagation();
        onClick(event.id);
      }}
    >
      <strong>{event.title}</strong>
      <div style={{ opacity: 0.85 }}>{event.time} · {event.duration}m</div>
    </div>
  );
}

export default function CalendarClient() {
  const {
    loaded,
    events,
    setEvents,
    notes,
    verticals,
    b2a,
  } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);
  const todayStr = formatDate(today);

  const [viewMode, setViewMode] = useState<"month" | "detail">("month");
  const [monthCursor, setMonthCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    slot: string;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: todayStr,
    time: "09:00",
    allDay: false,
    type: "internal",
    duration: "60",
    notes: "",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<
    string | null
  >(null);

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

  const eventsByDate = useMemo(() => {
    const byDate: Record<string, CalendarEvent[]> = {};
    events
      .slice()
      .sort(sortEvents)
      .forEach((event) => {
        if (!byDate[event.date]) byDate[event.date] = [];
        byDate[event.date].push(event);
      });
    return byDate;
  }, [events]);

  const selectedDayEvents = eventsByDate[selectedDate] || [];
  const dailyTodoTasksByDate = useMemo(() => {
    const byDate: Record<string, string[]> = {};

    notes.forEach((note) => {
      const date = dailyTodoDateFromLink(note.linkedTo);
      if (!date) return;

      const tasks = extractDailyTodoTasks(note.blocks);
      if (tasks.length === 0) return;

      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(...tasks);
    });

    return byDate;
  }, [notes]);
  const selectedDayTodoTasks = dailyTodoTasksByDate[selectedDate] || [];

  const detailBase = startOfWeek(parseDateValue(selectedDate));
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(detailBase, index)
  );

  const monthYear = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();
  const firstOffset = getFirstDayOfMonth(monthYear, monthIndex);
  const monthStart = new Date(monthYear, monthIndex, 1);
  const monthGridStart = addDays(monthStart, -firstOffset);
  const monthCells = Array.from({ length: 42 }, (_, index) =>
    addDays(monthGridStart, index)
  );

  function selectDate(next: Date | string) {
    const nextDate = typeof next === "string" ? parseDateValue(next) : next;
    const nextDateStr = formatDate(nextDate);
    setSelectedDate(nextDateStr);
    setSelectedSlot(null);
    setMonthCursor(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }

  function openCreateForDate(date: string, options?: Partial<typeof form>) {
    setForm({
      title: "",
      date,
      time: options?.time || "09:00",
      allDay: options?.allDay ?? false,
      type: options?.type || "internal",
      duration: options?.duration || "60",
      notes: options?.notes || "",
    });
    setShowCreate(true);
  }

  function resetForm() {
    setForm({
      title: "",
      date: selectedDate,
      time: "09:00",
      allDay: false,
      type: "internal",
      duration: "60",
      notes: "",
    });
  }

  function createEvent(patch: Partial<CalendarEvent> = {}) {
    const event: CalendarEvent = {
      id: uid(),
      title: form.title.trim() || "untitled",
      date: form.date,
      time: form.time,
      allDay: form.allDay,
      type: form.type,
      duration: parseInt(form.duration, 10) || 60,
      notes: form.notes,
      attachments: [],
      linkedNoteId: "",
      linkedVerticalId: "",
      linkedB2AId: "",
      ...patch,
    };

    setEvents((previous) => [...previous, event]);
    selectDate(event.date);
    setShowCreate(false);
    resetForm();
    return event;
  }

  function updateEvent(id: string, patch: Partial<CalendarEvent>) {
    setEvents((previous) =>
      previous.map((event) =>
        event.id === id ? { ...event, ...patch } : event
      )
    );
  }

  function deleteEvent(id: string) {
    setEvents((previous) => previous.filter((event) => event.id !== id));
    setConfirmDeleteId(null);
    setDetailId(null);
  }

  async function addAttachment(eventId: string, file: File) {
    setUploadingAttachmentFor(eventId);
    try {
      const attachment = await uploadAttachment(supabase, file, "events", eventId);
      setEvents((previous) =>
        previous.map((event) =>
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
    setEvents((previous) =>
      previous.map((event) =>
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

  function handleSlotMouseDown(date: string, slotIdx: number, event: MouseEvent) {
    event.preventDefault();
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
    openCreateForDate(date, { time, duration: String(durationMin), allDay: false });
  }

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) {
    return <div className="loading">Loading calendar...</div>;
  }

  function renderDayPanel() {
    return (
      <div className="calendar-panel-stack">
        <div className="card calendar-side-section calendar-day-card">
          <div className="section-header">
            <div>
              <div className="detail-label">selected day</div>
              <div className="calendar-day-title">{formatLongDate(selectedDate)}</div>
            </div>
            <button
              className="action-btn small-btn"
              onClick={() => openCreateForDate(selectedDate)}
            >
              + event
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="calendar-empty">No events for this day yet.</div>
          ) : (
            <div className="calendar-day-list">
              {selectedDayEvents.map((event) => {
                const meta = getEventMeta(event.type);
                return (
                  <div className="calendar-day-event" key={event.id}>
                    <div className="calendar-day-event-main">
                      <div className="calendar-day-event-title">{event.title}</div>
                      <div className="calendar-day-event-meta">
                        {event.allDay ? (
                          <span className="calendar-all-day">all day</span>
                        ) : (
                          `${event.time} · ${event.duration} min`
                        )}
                        {" · "}
                        {meta.label}
                      </div>
                    </div>
                    <div className="calendar-day-event-actions">
                      <span
                        className="calendar-event-dot"
                        style={{ background: meta.color }}
                      />
                      <button
                        className="ghost-btn small-btn"
                        onClick={() => setDetailId(event.id)}
                      >
                        open
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card calendar-side-section calendar-todo-card">
          <div className="detail-label">daily to-do list</div>

          {selectedDayTodoTasks.length === 0 ? (
            <div className="calendar-empty">No to-do bullets for this day yet.</div>
          ) : (
            <ul className="calendar-todo-list">
              {selectedDayTodoTasks.map((task, index) => (
                <li key={`${task}-${index}`}>{task}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (detailId !== null) {
    const event = events.find((item) => item.id === detailId);
    if (!event) {
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
              value={event.title}
              placeholder="event title"
              onChange={(eventInput) =>
                updateEvent(event.id, { title: eventInput.target.value })
              }
            />

            <div className="detail-meta-row" style={{ gap: 10 }}>
              <span className="detail-label">date</span>
              <input
                className="modal-input"
                type="date"
                value={event.date}
                onChange={(eventInput) =>
                  updateEvent(event.id, { date: eventInput.target.value })
                }
                style={{ width: 140 }}
              />

              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={event.allDay}
                  onChange={(eventInput) =>
                    updateEvent(event.id, { allDay: eventInput.target.checked })
                  }
                />
                <span className="detail-label" style={{ marginBottom: 0 }}>
                  all day
                </span>
              </label>

              {!event.allDay ? (
                <>
                  <span className="detail-label">time</span>
                  <input
                    className="modal-input"
                    type="time"
                    value={event.time}
                    onChange={(eventInput) =>
                      updateEvent(event.id, { time: eventInput.target.value })
                    }
                    style={{ width: 110 }}
                  />
                </>
              ) : null}

              <span className="detail-label">type</span>
              <select
                className="modal-select"
                value={event.type}
                onChange={(eventInput) =>
                  updateEvent(event.id, { type: eventInput.target.value })
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>

              {!event.allDay ? (
                <>
                  <span className="detail-label">duration</span>
                  <select
                    className="modal-select"
                    value={String(event.duration)}
                    onChange={(eventInput) =>
                      updateEvent(event.id, {
                        duration: parseInt(eventInput.target.value, 10),
                      })
                    }
                  >
                    {[30, 60, 90, 120].map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">notes</div>
            <textarea
              className="notes-area"
              value={event.notes}
              placeholder="event notes"
              rows={4}
              onChange={(eventInput) =>
                updateEvent(event.id, { notes: eventInput.target.value })
              }
            />
          </div>

          <div className="detail-section">
            <div className="section-title">links</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              <div>
                <div className="detail-label">linked note</div>
                <select
                  className="modal-select"
                  value={event.linkedNoteId}
                  onChange={(eventInput) =>
                    updateEvent(event.id, { linkedNoteId: eventInput.target.value })
                  }
                >
                  <option value="">none</option>
                  {notes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.title || "untitled"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="detail-label">linked vertical</div>
                <select
                  className="modal-select"
                  value={event.linkedVerticalId}
                  onChange={(eventInput) =>
                    updateEvent(event.id, {
                      linkedVerticalId: eventInput.target.value,
                    })
                  }
                >
                  <option value="">none</option>
                  {verticals
                    .filter((vertical) => !vertical.proposed)
                    .map((vertical) => (
                      <option key={vertical.id} value={vertical.id}>
                        {vertical.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="detail-label">linked applied</div>
                <select
                  className="modal-select"
                  value={event.linkedB2AId}
                  onChange={(eventInput) =>
                    updateEvent(event.id, { linkedB2AId: eventInput.target.value })
                  }
                >
                  <option value="">none</option>
                  {b2a
                    .filter((item) => !item.proposed)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.company}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header">
              <div className="section-title">attachments</div>
              <label className="ghost-btn small-btn">
                {uploadingAttachmentFor === event.id ? "uploading..." : "+ upload"}
                <input
                  type="file"
                  hidden
                  onChange={async (uploadEvent) => {
                    const file = uploadEvent.target.files?.[0];
                    if (!file) return;
                    await addAttachment(event.id, file);
                    uploadEvent.target.value = "";
                  }}
                />
              </label>
            </div>
            {event.attachments.length === 0 ? (
              <div className="empty-state">no attachments yet.</div>
            ) : (
              <div className="section-stack">
                {event.attachments.map((attachment) => (
                  <div key={attachment.id} className="list-item">
                    <div className="list-item-main">
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        {attachment.name}
                      </a>
                      <div className="dim">{attachmentKind(attachment)}</div>
                    </div>
                    <button
                      className="item-delete"
                      onClick={() => removeAttachment(event.id, attachment.id)}
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
              onClick={() => setConfirmDeleteId(event.id)}
            >
              delete event
            </button>
          </div>
        </div>

        <ConfirmModal
          show={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => deleteEvent(confirmDeleteId!)}
          label={`"${event.title}"`}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div>
          <div className="calendar-period-title">
            {viewMode === "month"
              ? formatMonthTitle(monthCursor)
              : `${detailBase.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })} — ${addDays(detailBase, 6).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
          </div>
        </div>

        <div className="calendar-toolbar-group">
          <div className="calendar-mode-switch">
            <button
              className={viewMode === "month" ? "active" : ""}
              onClick={() => setViewMode("month")}
              type="button"
            >
              calendar
            </button>
            <button
              className={viewMode === "detail" ? "active" : ""}
              onClick={() => setViewMode("detail")}
              type="button"
            >
              detail
            </button>
          </div>

          {viewMode === "month" ? (
            <>
              <button
                className="ghost-btn"
                onClick={() => {
                  const next = new Date(monthYear, monthIndex - 1, 1);
                  setMonthCursor(next);
                  selectDate(next);
                }}
              >
                ‹ prev
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                  selectDate(today);
                }}
              >
                today
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  const next = new Date(monthYear, monthIndex + 1, 1);
                  setMonthCursor(next);
                  selectDate(next);
                }}
              >
                next ›
              </button>
            </>
          ) : (
            <>
              <button
                className="ghost-btn"
                onClick={() => selectDate(addDays(parseDateValue(selectedDate), -7))}
              >
                ‹ prev
              </button>
              <button className="ghost-btn" onClick={() => selectDate(today)}>
                today
              </button>
              <button
                className="ghost-btn"
                onClick={() => selectDate(addDays(parseDateValue(selectedDate), 7))}
              >
                next ›
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === "month" ? (
        <div className="calendar-month-shell">
          <div className="calendar-month-wrap">
            <div className="calendar-month-header">
              {WEEKDAYS.map((weekday) => (
                <div className="calendar-month-label" key={weekday}>
                  {weekday}
                </div>
              ))}
            </div>

            <div className="calendar-month-grid">
              {monthCells.map((cell) => {
                const dateStr = formatDate(cell);
                const cellEvents = (eventsByDate[dateStr] || []).slice(0, 2);
                const overflowCount = Math.max(
                  0,
                  (eventsByDate[dateStr] || []).length - cellEvents.length
                );
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const inCurrentMonth = cell.getMonth() === monthIndex;

                return (
                  <button
                    key={dateStr}
                    className={`calendar-month-cell${
                      inCurrentMonth ? "" : " other-month"
                    }${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                    onClick={() => selectDate(cell)}
                    type="button"
                  >
                    <div className="calendar-month-day">
                      <span className="calendar-month-number">{cell.getDate()}</span>
                      {(eventsByDate[dateStr] || []).length > 0 ? (
                        <span className="calendar-month-badge">
                          {(eventsByDate[dateStr] || []).length}
                        </span>
                      ) : null}
                    </div>

                    <div className="calendar-month-events">
                      {cellEvents.map((event) => {
                        const meta = getEventMeta(event.type);
                        return (
                          <div className="calendar-month-event" key={event.id}>
                            <span
                              className="calendar-event-dot"
                              style={{ background: meta.color }}
                            />
                            <span className="calendar-event-text">
                              {event.allDay ? "All day" : event.time} · {event.title}
                            </span>
                          </div>
                        );
                      })}
                      {overflowCount > 0 ? (
                        <div className="calendar-more-events">
                          +{overflowCount} more
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {renderDayPanel()}
        </div>
      ) : (
        <div className="calendar-shell">
          <div className="week-grid-wrap">
            <div style={{ display: "flex" }}>
              <div className="week-grid-hours">
                <div style={{ height: HEADER_HEIGHT }} />
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

              <div className="week-grid-days">
                {weekDays.map((day, index) => {
                  const dateStr = formatDate(day);
                  const isToday = dateStr === todayStr;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const timedEvents = dayEvents.filter((event) => !event.allDay);
                  const allDayEvents = dayEvents.filter((event) => event.allDay);

                  return (
                    <div key={dateStr} className="week-day">
                      <button
                        className={`week-day-head${isToday ? " today" : ""}`}
                        style={{ height: HEADER_HEIGHT }}
                        onClick={() => selectDate(day)}
                        type="button"
                      >
                        <span className="week-day-label">{WEEKDAYS[index]}</span>
                        <span className="week-day-number">{day.getDate()}</span>
                        {allDayEvents.length > 0 ? (
                          <div className="dim" style={{ fontSize: 10, marginTop: 2 }}>
                            {allDayEvents.length} all day
                          </div>
                        ) : null}
                      </button>

                      <div style={{ position: "relative" }}>
                        {SLOTS.slice(0, -1).map((slot, slotIdx) => {
                          const isDragged =
                            dragRange !== null &&
                            dragRange.date === dateStr &&
                            slotIdx >= Math.min(dragRange.startIdx, dragRange.endIdx) &&
                            slotIdx <= Math.max(dragRange.startIdx, dragRange.endIdx);
                          const isSelected =
                            selectedSlot?.date === dateStr &&
                            selectedSlot?.slot === slot;

                          return (
                            <div
                              key={slot}
                              className={`week-slot${isSelected ? " selected" : ""}${
                                isDragged ? " dragged" : ""
                              }`}
                              style={{ height: SLOT_HEIGHT }}
                              onClick={() => {
                                selectDate(dateStr);
                                setSelectedSlot({ date: dateStr, slot });
                              }}
                              onMouseDown={(event) =>
                                handleSlotMouseDown(dateStr, slotIdx, event)
                              }
                              onMouseEnter={() => handleSlotMouseEnter(dateStr, slotIdx)}
                              onDoubleClick={() => {
                                const event = timedEvents.find((item) => item.time === slot);
                                if (event) setDetailId(event.id);
                              }}
                            />
                          );
                        })}

                        {timedEvents.map((event) => {
                          const indexAt = slotIndex(event.time);
                          if (indexAt < 0) return null;
                          return (
                            <EventPill
                              key={event.id}
                              event={event}
                              topSlot={indexAt}
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

          {renderDayPanel()}
        </div>
      )}

      <Modal
        show={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title="new event"
      >
        <div className="modal-field">
          <label className="modal-label">title</label>
          <input
            className="modal-input"
            value={form.title}
            placeholder="event title"
            onChange={(event) =>
              setForm((previous) => ({ ...previous, title: event.target.value }))
            }
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">date</label>
          <input
            className="modal-input"
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, date: event.target.value }))
            }
          />
        </div>
        <div className="modal-field">
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  allDay: event.target.checked,
                }))
              }
            />
            <span className="modal-label" style={{ marginBottom: 0 }}>
              all day
            </span>
          </label>
        </div>
        {!form.allDay ? (
          <>
            <div className="modal-field">
              <label className="modal-label">time</label>
              <input
                className="modal-input"
                type="time"
                value={form.time}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    time: event.target.value,
                  }))
                }
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">duration</label>
              <select
                className="modal-select"
                value={form.duration}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    duration: event.target.value,
                  }))
                }
              >
                {[30, 60, 90, 120].map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} min
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        <div className="modal-field">
          <label className="modal-label">type</label>
          <select
            className="modal-select"
            value={form.type}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, type: event.target.value }))
            }
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">notes</label>
          <textarea
            className="notes-area"
            rows={3}
            value={form.notes}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, notes: event.target.value }))
            }
            placeholder="optional context"
          />
        </div>
        <div className="modal-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              setShowCreate(false);
              resetForm();
            }}
          >
            cancel
          </button>
          <button
            className="action-btn"
            onClick={() => createEvent()}
            disabled={!form.title.trim()}
          >
            create
          </button>
        </div>
      </Modal>
    </div>
  );
}
