export const COLOR_PALETTE = [
  "#7F77DD", "#AFA9EC", "#378ADD", "#85B7EB",
  "#1D9E75", "#5DCAA5", "#D85A30", "#F0997B",
  "#E25C6A", "#F4A3AC", "#F5C542", "#F7D98B",
  "#9B59B6", "#C39BD3", "#1A1A1A", "#8E8E93",
];

export const EVENT_TYPES = [
  { id: "internal", label: "internal", color: "#7F77DD" },
  { id: "vertical", label: "vertical", color: "#1D9E75" },
  { id: "b2a", label: "b2a", color: "#378ADD" },
  { id: "meeting", label: "meeting", color: "#D85A30" },
  { id: "deep_work", label: "deep work / strategy", color: "#1A1A1A" },
];

export const VERTICAL_STATUSES = ["pending review", "active", "on hold", "shipped", "archived"];
export const B2A_STATUSES = ["lead", "discovery", "proposal", "active", "closed", "archived"];
export const TALENT_STATUSES = ["observing", "contact", "interviewing", "future fit"];
export const NOTE_CATEGORIES = ["explore", "strategic"] as const;

export const NOTE_COLORS = [
  { bg: "#F5F0E8", fg: "#A0855B", symbol: "◎" },
  { bg: "#EDE8FF", fg: "#7F6FD4", symbol: "◇" },
  { bg: "#E8F4EE", fg: "#4A9B72", symbol: "◈" },
  { bg: "#FFF4E6", fg: "#C47A3A", symbol: "△" },
  { bg: "#F5E8F0", fg: "#B05A8A", symbol: "○" },
  { bg: "#E8EFF5", fg: "#4A78A0", symbol: "◻" },
  { bg: "#F0EDE8", fg: "#8A7060", symbol: "◑" },
];

export const COST_CATEGORIES = ["AI tools", "infra", "software", "operations", "subscriptions"];
export const BILLING_CYCLES = ["monthly", "annual"];

export const MONTHS_PT = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export const BLOCK_MENU = [
  { type: "text", label: "Text", hint: "plain paragraph" },
  { type: "heading1", label: "Heading 1", hint: "large heading" },
  { type: "heading2", label: "Heading 2", hint: "section heading" },
  { type: "heading3", label: "Heading 3", hint: "small heading" },
  { type: "todo", label: "Checklist", hint: "checkable item" },
  { type: "divider", label: "Divider", hint: "horizontal rule" },
  { type: "callout", label: "Callout", hint: "highlighted note" },
  { type: "code", label: "Code", hint: "monospace block" },
  { type: "table", label: "Table", hint: "simple rows and columns" },
  { type: "image", label: "Image", hint: "inline image" },
  { type: "pdf", label: "File / PDF", hint: "embedded file" },
  { type: "note_link", label: "Note Link", hint: "link another note" },
  { type: "entity_link", label: "Entity Link", hint: "event, vertical, b2a or member" },
];
