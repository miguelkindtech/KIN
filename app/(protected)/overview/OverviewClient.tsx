"use client";

import { useApp } from "@/providers/AppContext";
import {
  formatDate,
  startOfWeek,
  addDays,
  monthlyEquivalent,
  annualEstimate,
  noteColorDef,
  getEventMeta,
} from "@/lib/utils";

export default function OverviewClient() {
  const { loaded, overview, setOverview, events, verticals, b2a, costs, team, talent, notes } = useApp();

  if (!loaded) {
    return <div className="loading">Loading overview...</div>;
  }

  const todayStr = formatDate(new Date());
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);

  function sortEvents(a: (typeof events)[number], b: (typeof events)[number]) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.time || "").localeCompare(b.time || "");
  }

  function eventLabel(event: (typeof events)[number]) {
    return event.allDay ? "all day" : event.time;
  }

  const weekEvents = events
    .filter((e) => e.date >= weekStartStr && e.date <= weekEndStr)
    .sort(sortEvents);

  const todayEvents = weekEvents.filter((e) => e.date === todayStr);

  const monthly = costs.reduce((sum, c) => sum + monthlyEquivalent(c), 0);
  const annual = costs.reduce((sum, c) => sum + annualEstimate(c), 0);

  const atRiskVerticals = verticals.filter(
    (v) => v.health === "watch" || v.health === "critical" || v.status === "pending review" || v.status === "on hold"
  );

  const openApplied = b2a.filter((item) => item.status !== "closed" && item.status !== "archived");

  const inactiveMembers = team.filter((m) => m.status !== "active").length;
  const activeTalent = talent.filter(
    (t) => t.status === "observing" || t.status === "contact" || t.status === "interviewing"
  ).length;

  const nextMeeting = events
    .filter((e) => e.date >= todayStr && (e.type === "meeting" || e.type === "internal" || e.type === "b2a" || e.type === "vertical"))
    .sort(sortEvents)[0];

  const mostExposedVertical = atRiskVerticals.find((v) => v.health === "critical") || atRiskVerticals[0];

  const firstAppliedPush =
    openApplied.find((item) => item.status === "proposal" || item.status === "discovery") ||
    openApplied[0];

  const exploreNotes = notes.filter((n) => n.category === "explore");

  const priorities = overview?.priorities ?? [];

  function updatePriority(index: number, value: string) {
    const next = [...priorities];
    next[index] = value;
    setOverview({ ...overview, priorities: next });
  }

  function addPriority() {
    if (priorities.length >= 5) return;
    setOverview({ ...overview, priorities: [...priorities, ""] });
  }

  function removePriority(index: number) {
    const next = priorities.filter((_, i) => i !== index);
    setOverview({ ...overview, priorities: next });
  }

  return (
    <div className="page">
      {/* Top 2-col grid */}
      <div className="overview-grid">
        {/* TODAY / THIS WEEK */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">today &amp; this week</div>
          </div>
          {todayEvents.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                today
              </div>
              <div className="summary-list" style={{ marginBottom: 12 }}>
                {todayEvents.map((ev) => {
                  const meta = getEventMeta(ev.type);
                  return (
                    <div className="summary-row" key={ev.id}>
                      <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{ev.title}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{eventLabel(ev)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {weekEvents.filter((e) => e.date !== todayStr).length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                this week
              </div>
              <div className="summary-list">
                {weekEvents
                  .filter((e) => e.date !== todayStr)
                  .map((ev) => {
                    const meta = getEventMeta(ev.type);
                    const dayLabel = new Date(`${ev.date}T00:00:00`).toLocaleDateString("en", { weekday: "short" }).toLowerCase();
                    return (
                      <div className="summary-row" key={ev.id}>
                        <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{ev.title}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{dayLabel} · {eventLabel(ev)}</span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
          {weekEvents.length === 0 && (
            <div className="empty-state">no events this week</div>
          )}
        </div>

        {/* OPEN PRIORITIES */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">open priorities</div>
            {priorities.length < 5 && (
              <button className="ghost-btn small-btn" onClick={addPriority}>+ add</button>
            )}
          </div>
          {priorities.length === 0 && (
            <div className="empty-state">no priorities set</div>
          )}
          <div className="list-stack">
            {priorities.map((p, i) => (
              <div className="list-item" key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="muted" style={{ fontSize: 13, minWidth: 16 }}>{i + 1}.</span>
                <input
                  className="inline-input"
                  style={{ flex: 1 }}
                  value={p}
                  onChange={(e) => updatePriority(i, e.target.value)}
                  placeholder={`priority ${i + 1}`}
                />
                <button className="item-delete" onClick={() => removePriority(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-col grid */}
      <div className="overview-grid-3">
        {/* BUSINESS PULSE */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">business pulse</div>
          </div>
          <div className="summary-list">
            <div className="summary-row">
              <span className="muted">verticals at risk</span>
              <span className="metric-value">{atRiskVerticals.length}</span>
            </div>
            <div className="summary-row">
              <span className="muted">open applied deals</span>
              <span className="metric-value">{openApplied.length}</span>
            </div>
          </div>
          {atRiskVerticals.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>at risk</div>
              {atRiskVerticals.map((v) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{v.name}</span>
                  <span className={`pill ${v.health === "critical" ? "badge" : ""}`}>{v.health || v.status}</span>
                </div>
              ))}
            </div>
          )}
          {openApplied.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>open deals</div>
              {openApplied.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{item.company}</span>
                  <span className="pill">{item.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMPANY PULSE */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">company pulse</div>
          </div>
          <div className="summary-list">
            <div className="summary-row">
              <span className="muted">monthly costs</span>
              <span className="metric-value">EUR {monthly.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">annual estimate</span>
              <span className="metric-value">EUR {annual.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">inactive members</span>
              <span className="metric-value">{inactiveMembers}</span>
            </div>
            <div className="summary-row">
              <span className="muted">talent pipeline</span>
              <span className="metric-value">{activeTalent}</span>
            </div>
          </div>
        </div>

        {/* READ THIS FIRST */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">read this first</div>
          </div>
          <div className="summary-list">
            <div className="summary-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>next meeting</span>
              <span style={{ fontSize: 13 }}>
                {nextMeeting ? `${nextMeeting.title} · ${eventLabel(nextMeeting)}` : "none scheduled"}
              </span>
            </div>
            <div className="summary-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>most exposed vertical</span>
              <span style={{ fontSize: 13 }}>
                {mostExposedVertical
                  ? `${mostExposedVertical.name} — ${mostExposedVertical.health || mostExposedVertical.status}`
                  : "all clear"}
              </span>
            </div>
            <div className="summary-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>first applied push</span>
              <span style={{ fontSize: 13 }}>
                {firstAppliedPush
                  ? `${firstAppliedPush.company} — ${firstAppliedPush.status}`
                  : "no active deals"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TOPICS TO EXPLORE */}
      {exploreNotes.length > 0 && (
        <div className="section-stack top-space">
          <div className="section-header">
            <div className="section-title">topics to explore</div>
          </div>
          <div className="cards-grid">
            {exploreNotes.map((note) => {
              const colorDef = noteColorDef(note.color);
              return (
                <div className="note-card" key={note.id} style={{ pointerEvents: "none" }}>
                  <div className="note-card-body">
                    <div className="note-card-title">{note.title}</div>
                    {note.description && (
                      <div className="note-card-desc">{note.description}</div>
                    )}
                  </div>
                  <div className="note-card-accent" style={{ background: colorDef.bg }}>
                    <span className="note-card-symbol" style={{ color: colorDef.fg }}>{colorDef.symbol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
