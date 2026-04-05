"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { queueRagIndexSync } from "@/lib/rag/client";
import { formatDate } from "@/lib/utils/dates";
import { uid } from "@/lib/utils/uid";
import type { CaptureContext, Profile } from "@/lib/types";

interface MinimalEntity {
  id: string;
  name: string;
}

interface AppShellProps {
  children: React.ReactNode;
  profile: Profile;
}

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/overview": {
    title: "Overview",
    subtitle: "Read the state of Kind Tech in 30 seconds.",
  },
  "/calendar": {
    title: "Calendar",
    subtitle: "Weekly execution, day context and live board rhythm.",
  },
  "/verticals": {
    title: "Verticals",
    subtitle: "Company ventures, health and next milestones.",
  },
  "/b2a": {
    title: "Applied",
    subtitle: "Applied AI opportunities, clients and execution fronts.",
  },
  "/notes": {
    title: "Notes",
    subtitle: "Explore and strategic notes only.",
  },
  "/team": {
    title: "Team",
    subtitle: "Board, team and talent pipeline.",
  },
  "/costs": {
    title: "Costs",
    subtitle: "Operating costs with monthly and annual visibility.",
  },
  "/setup": {
    title: "Setup",
    subtitle: "Seed the workspace and verify the environment.",
  },
};

export default function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [navOpen, setNavOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureContext, setCaptureContext] =
    useState<CaptureContext>("today");
  const [verticalOptions, setVerticalOptions] = useState<MinimalEntity[]>([]);
  const [b2aOptions, setB2AOptions] = useState<MinimalEntity[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captureSaving, setCaptureSaving] = useState(false);

  const pageMeta = PAGE_META[pathname] ||
    (pathname.startsWith("/verticals/")
      ? PAGE_META["/verticals"]
      : pathname.startsWith("/b2a/")
      ? PAGE_META["/b2a"]
      : pathname.startsWith("/notes/")
      ? PAGE_META["/notes"]
      : { title: "kind." });

  const loadShellData = useCallback(async () => {
    const [{ count }, { data: verticals }, { data: b2a }] = await Promise.all([
      supabase.from("inbox").select("id", { count: "exact", head: true }),
      supabase.from("verticals").select("id,name").order("name"),
      supabase.from("b2a").select("id,company").order("company"),
    ]);

    setInboxCount(count || 0);
    setVerticalOptions(
      (verticals || []).map((item) => ({ id: item.id, name: item.name }))
    );
    setB2AOptions(
      (b2a || []).map((item) => ({ id: item.id, name: item.company }))
    );
  }, [supabase]);

  useRealtime("inbox", loadShellData);
  useRealtime("verticals", loadShellData);
  useRealtime("b2a", loadShellData);

  useEffect(() => {
    void loadShellData();
  }, [loadShellData]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const storedTheme =
      (window.localStorage.getItem("kin-theme") as "light" | "dark" | null) ||
      "dark";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCaptureOpen(true);
      }

      if (event.key === "Escape") {
        setCaptureOpen(false);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setSaveStatus(customEvent.detail);

      if (customEvent.detail === "saved") {
        window.setTimeout(() => setSaveStatus(""), 1500);
      }
    };

    window.addEventListener("kin-save-status", listener);
    return () => window.removeEventListener("kin-save-status", listener);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("kin-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const closeCapture = useCallback(() => {
    setCaptureOpen(false);
    setCaptureText("");
    setCaptureContext("today");
    setCaptureError("");
    setCaptureSaving(false);
  }, []);

  const handleCaptureSave = useCallback(async () => {
    const text = captureText.trim();
    if (!text) return;

    setCaptureSaving(true);
    setCaptureError("");

    try {
      if (captureContext === "inbox") {
        await supabase.from("inbox").insert({
          text,
          context: null,
          created_by: profile.id,
        });
      } else if (captureContext === "today") {
        const date = formatDate(new Date());
        const { data: existing } = await supabase
          .from("day_notes")
          .select("*")
          .eq("date", date)
          .maybeSingle();

        const todos = Array.isArray(existing?.todos) ? existing.todos : [];
        const nextTodos = [...todos, { id: uid(), text, done: false }];

        if (existing?.id) {
          const { data: updated } = await supabase
            .from("day_notes")
            .update({ todos: nextTodos, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select("*")
            .single();

          if (updated) {
            queueRagIndexSync("day_notes", [updated]);
          }
        } else {
          const { data: inserted } = await supabase
            .from("day_notes")
            .insert({
              date,
              content: "",
              todos: nextTodos,
            })
            .select("*")
            .single();

          if (inserted) {
            queueRagIndexSync("day_notes", [inserted]);
          }
        }
      } else if (captureContext.startsWith("vertical:")) {
        const id = captureContext.replace("vertical:", "");
        const { data: vertical } = await supabase
          .from("verticals")
          .select("*")
          .eq("id", id)
          .single();

        const notesList = Array.isArray(vertical?.notes_list)
          ? vertical.notes_list
          : [];

        const { data: updated } = await supabase
          .from("verticals")
          .update({
            notes_list: [
              ...notesList,
              { id: uid(), title: text.slice(0, 60), content: text },
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (updated) {
          queueRagIndexSync("verticals", [updated]);
        }
      } else if (captureContext.startsWith("b2a:")) {
        const id = captureContext.replace("b2a:", "");
        const { data: item } = await supabase
          .from("b2a")
          .select("*")
          .eq("id", id)
          .single();

        const notesList = Array.isArray(item?.notes_list)
          ? item.notes_list
          : [];

        const { data: updated } = await supabase
          .from("b2a")
          .update({
            notes_list: [
              ...notesList,
              { id: uid(), title: text.slice(0, 60), content: text },
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (updated) {
          queueRagIndexSync("b2a", [updated]);
        }
      }

      closeCapture();
      void loadShellData();
    } catch (error) {
      console.error(error);
      setCaptureError("Capture could not be saved.");
      setCaptureSaving(false);
    }
  }, [
    captureContext,
    captureText,
    closeCapture,
    loadShellData,
    profile.id,
    supabase,
  ]);

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop${navOpen ? " visible" : ""}`}
        onClick={() => setNavOpen(false)}
      />
      <Sidebar
        profile={profile}
        theme={theme}
        onToggleTheme={toggleTheme}
        mobileOpen={navOpen}
        onNavigate={() => setNavOpen(false)}
      />

      <div className="app-main">
        <Header
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          inboxCount={inboxCount}
          onOpenCapture={() => setCaptureOpen(true)}
          onOpenNav={() => setNavOpen(true)}
        />

        {saveStatus ? <div className="save-indicator">{saveStatus}</div> : null}

        <main className="content">{children}</main>
      </div>

      <Modal show={captureOpen} onClose={closeCapture} title="Global capture">
        <div className="modal-field">
          <label className="modal-label">capture</label>
          <textarea
            className="notes-area"
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            placeholder="Capture a thought, action or note..."
            autoFocus
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">context</label>
          <select
            className="modal-select"
            value={captureContext}
            onChange={(event) =>
              setCaptureContext(event.target.value as CaptureContext)
            }
          >
            <option value="today">Today</option>
            <option value="inbox">Inbox</option>
            <optgroup label="Vertical">
              {verticalOptions.map((item) => (
                <option key={item.id} value={`vertical:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Applied">
              {b2aOptions.map((item) => (
                <option key={item.id} value={`b2a:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {captureError ? <div className="form-error">{captureError}</div> : null}

        <div className="modal-actions">
          <button className="ghost-btn" onClick={closeCapture} type="button">
            Cancel
          </button>
          <button
            className="action-btn"
            onClick={handleCaptureSave}
            type="button"
            disabled={captureSaving}
          >
            {captureSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
