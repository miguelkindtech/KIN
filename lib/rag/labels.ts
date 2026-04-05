import { createAdminClient } from "@/lib/supabase/admin";
import type { RagSourceType } from "@/lib/rag/constants";

interface MatchLike {
  source_type: string;
  source_id: string;
}

function pushUniqueLabels(labels: string[], label: string) {
  if (!labels.includes(label)) {
    labels.push(label);
  }
}

export async function resolveSourceLabels(matches: MatchLike[]) {
  if (matches.length === 0) return [];

  const supabase = createAdminClient();
  const idsByType = new Map<RagSourceType, Set<string>>();

  matches.forEach((match) => {
    const type = match.source_type as RagSourceType;
    if (!idsByType.has(type)) idsByType.set(type, new Set());
    idsByType.get(type)?.add(match.source_id);
  });

  const [
    verticals,
    applied,
    notes,
    costs,
    team,
    events,
    dayNotes,
  ] = await Promise.all([
    idsByType.get("vertical")
      ? supabase
          .from("verticals")
          .select("id,name")
          .in("id", Array.from(idsByType.get("vertical")!.values()))
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    idsByType.get("b2a")
      ? supabase
          .from("b2a")
          .select("id,company")
          .in("id", Array.from(idsByType.get("b2a")!.values()))
      : Promise.resolve({ data: [] as { id: string; company: string }[], error: null }),
    idsByType.get("note")
      ? supabase
          .from("notes")
          .select("id,title")
          .in("id", Array.from(idsByType.get("note")!.values()))
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
    idsByType.get("cost")
      ? supabase
          .from("costs")
          .select("id,name")
          .in("id", Array.from(idsByType.get("cost")!.values()))
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    idsByType.get("team")
      ? supabase
          .from("team")
          .select("id,name")
          .in("id", Array.from(idsByType.get("team")!.values()))
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    idsByType.get("event")
      ? supabase
          .from("events")
          .select("id,title,date")
          .in("id", Array.from(idsByType.get("event")!.values()))
      : Promise.resolve({ data: [] as { id: string; title: string; date: string }[], error: null }),
    idsByType.get("day_note")
      ? supabase
          .from("day_notes")
          .select("id,date")
          .in("id", Array.from(idsByType.get("day_note")!.values()))
      : Promise.resolve({ data: [] as { id: string; date: string }[], error: null }),
  ]);

  const verticalMap = new Map((verticals.data || []).map((item) => [item.id, item.name]));
  const appliedMap = new Map((applied.data || []).map((item) => [item.id, item.company]));
  const notesMap = new Map((notes.data || []).map((item) => [item.id, item.title]));
  const costsMap = new Map((costs.data || []).map((item) => [item.id, item.name]));
  const teamMap = new Map((team.data || []).map((item) => [item.id, item.name]));
  const eventsMap = new Map(
    (events.data || []).map((item) => [item.id, `${item.title || "meeting"} event`])
  );
  const dayNotesMap = new Map(
    (dayNotes.data || []).map((item) => [item.id, `${item.date} day note`])
  );

  const labels: string[] = [];

  matches.forEach((match) => {
    switch (match.source_type as RagSourceType) {
      case "vertical":
        pushUniqueLabels(
          labels,
          `from ${verticalMap.get(match.source_id) || "verticals"} vertical`
        );
        break;
      case "b2a":
        pushUniqueLabels(
          labels,
          `from ${appliedMap.get(match.source_id) || "applied"}`
        );
        break;
      case "note":
        pushUniqueLabels(
          labels,
          `from ${notesMap.get(match.source_id) || "notes"}`
        );
        break;
      case "cost":
        pushUniqueLabels(
          labels,
          `from ${costsMap.get(match.source_id) || "costs"}`
        );
        break;
      case "team":
        pushUniqueLabels(
          labels,
          `from ${teamMap.get(match.source_id) || "team"}`
        );
        break;
      case "event":
        pushUniqueLabels(
          labels,
          `from ${eventsMap.get(match.source_id) || "calendar"}`
        );
        break;
      case "day_note":
        pushUniqueLabels(
          labels,
          `from ${dayNotesMap.get(match.source_id) || "day notes"}`
        );
        break;
      default:
        pushUniqueLabels(labels, "from kind.");
    }
  });

  return labels.slice(0, 4);
}
