"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { DEFAULT_B2A, DEFAULT_COSTS, DEFAULT_EVENTS, DEFAULT_NOTES, DEFAULT_OVERVIEW, DEFAULT_TALENT, DEFAULT_TEAM, DEFAULT_VERTICALS } from "@/lib/defaults";
import { addMinutes, minutesBetween } from "@/lib/utils/dates";
import { normalizeBlock } from "@/lib/utils/noteHelpers";
import type {
  AppState,
  B2AItem,
  CalendarEvent,
  Cost,
  DayFollowUpItem,
  Note,
  Profile,
  TalentEntry,
  TeamMember,
  Vertical,
} from "@/lib/types";

interface AppContextValue extends AppState {
  loaded: boolean;
  setTeam: Dispatch<SetStateAction<TeamMember[]>>;
  setTalent: Dispatch<SetStateAction<TalentEntry[]>>;
  setVerticals: Dispatch<SetStateAction<Vertical[]>>;
  setB2A: Dispatch<SetStateAction<B2AItem[]>>;
  setEvents: Dispatch<SetStateAction<CalendarEvent[]>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setCosts: Dispatch<SetStateAction<Cost[]>>;
  setOverview: Dispatch<SetStateAction<{ priorities: string[] }>>;
  setDayNotes: Dispatch<SetStateAction<Record<string, string>>>;
  setDayFollowUps: Dispatch<SetStateAction<Record<string, DayFollowUpItem[]>>>;
  setDayDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  profiles: Profile[];
  supabaseReady: boolean;
  theme: string;
  setTheme: Dispatch<SetStateAction<string>>;
  showCommand: boolean;
  setShowCommand: Dispatch<SetStateAction<boolean>>;
  saveStatus: string;
  setSaveStatus: Dispatch<SetStateAction<string>>;
}

const AppContext = createContext<AppContextValue | null>(null);

function mapTeam(rows: Record<string, unknown>[] = []): TeamMember[] {
  return rows.map((item) => ({
    id: String(item.id),
    name: String(item.name || ""),
    role: String(item.role || ""),
    initials:
      String(item.name || "")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "",
    color: String(item.color || "#7F6FD4"),
    status: String(item.status || "active"),
    focusArea: String(item.focus || ""),
  }));
}

function mapTalent(rows: Record<string, unknown>[] = []): TalentEntry[] {
  return rows.map((item) => ({
    id: String(item.id),
    name: String(item.name || ""),
    linkedin: "",
    role: String(item.role || ""),
    notes: String(item.notes || ""),
    tags: [],
    status: String(item.status || "observing"),
  }));
}

function mapVerticals(rows: Record<string, unknown>[] = []): Vertical[] {
  return rows.map((item) => ({
    id: String(item.id),
    name: String(item.name || ""),
    status: String(item.status || "pending review"),
    phase: String(item.phase || "planning"),
    summary: String(item.summary || ""),
    description: String(item.description || ""),
    partner: String(item.partner || ""),
    ownerId: String(item.owner_id || ""),
    health: String(item.health || "watch"),
    milestones: Array.isArray(item.milestones) ? (item.milestones as Vertical["milestones"]) : [],
    docs: Array.isArray(item.docs) ? (item.docs as Vertical["docs"]) : [],
    proposed: Boolean(item.proposed),
    notesList: Array.isArray(item.notes_list)
      ? (item.notes_list as { id: string; title: string; content?: string; body?: string }[]).map((note) => ({
          id: note.id,
          title: note.title,
          body: note.body || note.content || "",
          content: note.content || note.body || "",
        }))
      : [],
  }));
}

function mapB2A(rows: Record<string, unknown>[] = []): B2AItem[] {
  return rows.map((item) => ({
    id: String(item.id),
    company: String(item.company || ""),
    status: String(item.status || "lead"),
    ownerId: String(item.owner_id || ""),
    summary: String(item.summary || ""),
    challenge: String(item.challenge || ""),
    fronts: Array.isArray(item.fronts) ? (item.fronts as B2AItem["fronts"]) : [],
    nextSteps: Array.isArray(item.next_steps) ? (item.next_steps as B2AItem["nextSteps"]) : [],
    contacts: Array.isArray(item.contacts) ? (item.contacts as B2AItem["contacts"]) : [],
    docs: Array.isArray(item.docs) ? (item.docs as B2AItem["docs"]) : [],
    notes: String(item.notes || ""),
    proposed: Boolean(item.proposed),
    notesList: Array.isArray(item.notes_list)
      ? (item.notes_list as { id: string; title: string; content?: string; body?: string }[]).map((note) => ({
          id: note.id,
          title: note.title,
          body: note.body || note.content || "",
          content: note.content || note.body || "",
        }))
      : [],
  }));
}

function mapEvents(rows: Record<string, unknown>[] = []): CalendarEvent[] {
  return rows.map((item) => {
    const startTimeValue = item.start_time as string | null;
    const endTimeValue = item.end_time as string | null;
    const allDay = !startTimeValue;
    const startTime = startTimeValue || "09:00";
    const endTime = endTimeValue || addMinutes(startTime, 60);
    const linkedTo = String(item.linked_to || "");

    return {
      id: String(item.id),
      title: String(item.title || ""),
      date: String(item.date || ""),
      time: startTime,
      allDay,
      type: linkedTo.startsWith("vertical:")
        ? "vertical"
        : linkedTo.startsWith("b2a:")
        ? "b2a"
        : "meeting",
      duration: Math.max(30, minutesBetween(startTime, endTime) || 60),
      notes: String(item.description || ""),
      attachments: Array.isArray(item.attachments) ? (item.attachments as CalendarEvent["attachments"]) : [],
      linkedNoteId: "",
      linkedVerticalId: linkedTo.startsWith("vertical:") ? linkedTo.replace("vertical:", "") : "",
      linkedB2AId: linkedTo.startsWith("b2a:") ? linkedTo.replace("b2a:", "") : "",
    };
  });
}

function mapNotes(rows: Record<string, unknown>[] = []): Note[] {
  return rows.map((item) => ({
    id: String(item.id),
    title: String(item.title || ""),
    description: String(item.description || ""),
    category: String(item.category || "explore") as Note["category"],
    color: String(item.color || "#F5F0E8"),
    linkedTo: (item.linked_to as string | null) || null,
    blocks: Array.isArray(item.blocks)
      ? (item.blocks as Note["blocks"]).map(normalizeBlock)
      : [],
    createdAt: String(item.created_at || new Date().toISOString()),
    updatedAt: String(item.updated_at || new Date().toISOString()),
  }));
}

function mapCosts(rows: Record<string, unknown>[] = []): Cost[] {
  return rows.map((item) => ({
    id: String(item.id),
    name: String(item.name || ""),
    category:
      item.category === "ai"
        ? "AI tools"
        : item.category === "ops"
        ? "operations"
        : item.category === "tools"
        ? "subscriptions"
        : String(item.category || "software"),
    amount: Number(item.amount || 0),
    billingCycle: String(item.billing || "monthly"),
    ownerId: String(item.owner_id || ""),
    note: "",
  }));
}

function mapProfiles(rows: Record<string, unknown>[] = []): Profile[] {
  return rows.map((item) => ({
    id: String(item.id),
    email: (item.email as string | null) || null,
    name: String(item.name || ""),
    role: String(item.role || ""),
    color: String(item.color || "#7F6FD4"),
    avatarInitials: (item.avatar_initials as string | null) || null,
    createdAt: String(item.created_at || new Date().toISOString()),
  }));
}

function mapDayState(rows: Record<string, unknown>[] = []) {
  const dayNotes: Record<string, string> = {};
  const dayFollowUps: Record<string, DayFollowUpItem[]> = {};
  const dayDecisions: Record<string, string> = {};

  rows.forEach((item) => {
    const date = String(item.date || "");
    dayNotes[date] = String(item.content || "");
    dayFollowUps[date] = Array.isArray(item.todos)
      ? (item.todos as DayFollowUpItem[])
      : [];
    dayDecisions[date] = "";
  });

  return { dayNotes, dayFollowUps, dayDecisions };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM);
  const [talent, setTalent] = useState<TalentEntry[]>(DEFAULT_TALENT);
  const [verticals, setVerticals] = useState<Vertical[]>(DEFAULT_VERTICALS);
  const [b2a, setB2A] = useState<B2AItem[]>(DEFAULT_B2A);
  const [events, setEvents] = useState<CalendarEvent[]>(DEFAULT_EVENTS);
  const [notes, setNotes] = useState<Note[]>(DEFAULT_NOTES);
  const [costs, setCosts] = useState<Cost[]>(DEFAULT_COSTS);
  const [overview, setOverview] = useState(DEFAULT_OVERVIEW);
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [dayFollowUps, setDayFollowUps] = useState<Record<string, DayFollowUpItem[]>>({});
  const [dayDecisions, setDayDecisions] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState("dark");
  const [showCommand, setShowCommand] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const loadAll = useCallback(async () => {
    const [
      profilesResult,
      teamResult,
      talentResult,
      verticalsResult,
      b2aResult,
      eventsResult,
      notesResult,
      costsResult,
      dayNotesResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("team").select("*").order("created_at"),
      supabase.from("talent").select("*").order("created_at"),
      supabase.from("verticals").select("*").order("created_at"),
      supabase.from("b2a").select("*").order("created_at"),
      supabase.from("events").select("*").order("date").order("start_time"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("costs").select("*").order("created_at"),
      supabase.from("day_notes").select("*").order("date"),
    ]);

    if (profilesResult.data) setProfiles(mapProfiles(profilesResult.data));
    if (teamResult.data) setTeam(mapTeam(teamResult.data));
    if (talentResult.data) setTalent(mapTalent(talentResult.data));
    if (verticalsResult.data) setVerticals(mapVerticals(verticalsResult.data));
    if (b2aResult.data) setB2A(mapB2A(b2aResult.data));
    if (eventsResult.data) setEvents(mapEvents(eventsResult.data));
    if (notesResult.data) setNotes(mapNotes(notesResult.data));
    if (costsResult.data) setCosts(mapCosts(costsResult.data));
    if (dayNotesResult.data) {
      const nextDayState = mapDayState(dayNotesResult.data);
      setDayNotes(nextDayState.dayNotes);
      setDayFollowUps(nextDayState.dayFollowUps);
      setDayDecisions(nextDayState.dayDecisions);
    }

    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useRealtime("profiles", loadAll);
  useRealtime("team", loadAll);
  useRealtime("talent", loadAll);
  useRealtime("verticals", loadAll);
  useRealtime("b2a", loadAll);
  useRealtime("events", loadAll);
  useRealtime("notes", loadAll);
  useRealtime("costs", loadAll);
  useRealtime("day_notes", loadAll);

  const value = useMemo<AppContextValue>(
    () => ({
      loaded,
      profiles,
      team,
      setTeam,
      talent,
      setTalent,
      verticals,
      setVerticals,
      b2a,
      setB2A,
      events,
      setEvents,
      notes,
      setNotes,
      costs,
      setCosts,
      overview,
      setOverview,
      dayNotes,
      setDayNotes,
      dayFollowUps,
      setDayFollowUps,
      dayDecisions,
      setDayDecisions,
      supabaseReady: true,
      theme,
      setTheme,
      showCommand,
      setShowCommand,
      saveStatus,
      setSaveStatus,
    }),
    [
      b2a,
      costs,
      dayDecisions,
      dayFollowUps,
      dayNotes,
      events,
      loaded,
      notes,
      overview,
      profiles,
      talent,
      team,
      theme,
      verticals,
      saveStatus,
      showCommand,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
