import { TeamMember, TalentEntry, Vertical, B2AItem, CalendarEvent, Cost, Note } from "./types";
import { createBlock } from "./utils";

export const DEFAULT_TEAM: TeamMember[] = [
  { id: "miguel", name: "Miguel", role: "Chief Strategy Officer", initials: "M", color: "#7F77DD", status: "active", focusArea: "Board rhythm, strategy and positioning" },
  { id: "humberto", name: "Humberto Bastos", role: "Chief Executive Officer", initials: "HB", color: "#1D9E75", status: "active", focusArea: "Execution, partnerships and company direction" },
  { id: "roque", name: "Afonso Roque", role: "Chief Operating Officer", initials: "AR", color: "#378ADD", status: "active", focusArea: "Operations, finance and cadence" },
  { id: "andre", name: "Andre", role: "Engineer", initials: "A", color: "#D85A30", status: "active", focusArea: "Product engineering and delivery" },
  { id: "david", name: "David", role: "Engineer", initials: "D", color: "#E25C6A", status: "active", focusArea: "AI systems and technical architecture" },
  { id: "joao", name: "Joao", role: "Engineer", initials: "J", color: "#F5C542", status: "active", focusArea: "Build, prototyping and iteration" },
];

export const DEFAULT_TALENT: TalentEntry[] = [
  {
    id: "t1",
    name: "Sample Candidate",
    linkedin: "https://linkedin.com",
    role: "AI Product Lead",
    notes: "Strong product + AI profile.",
    tags: ["AI", "Product"],
    status: "observing",
  },
];

export const DEFAULT_VERTICALS: Vertical[] = [
  {
    id: "compy",
    name: "Compy",
    status: "active",
    phase: "v0.1 Pilot",
    summary: "AI companion for elderly care.",
    description: "Conversational AI platform for health and AgeTech. Focused on mitigating social isolation and preventing cognitive decline.",
    partner: "Santa Casa da Misericordia de Vale de Cambra",
    ownerId: "humberto",
    health: "stable",
    milestones: [
      { id: "m1", title: "Architecture defined", ownerId: "andre", status: "done", dueDate: "" },
      { id: "m2", title: "Pilot protocol closed", ownerId: "miguel", status: "active", dueDate: "2026-04-10" },
      { id: "m3", title: "Institution onboarding", ownerId: "roque", status: "pending", dueDate: "2026-04-18" },
    ],
    docs: [
      { id: "d1", name: "Core thesis", type: "strategy", url: "" },
      { id: "d2", name: "Technical architecture", type: "technical", url: "" },
      { id: "d3", name: "Pilot protocol", type: "operations", url: "" },
    ],
    proposed: false,
    notesList: [],
  },
];

export const DEFAULT_B2A: B2AItem[] = [
  {
    id: "abrito",
    company: "A. Brito Engrenagens",
    status: "discovery",
    ownerId: "miguel",
    summary: "Industrial AI optimisation opportunity around manufacturing quality and predictive maintenance.",
    challenge: "Production process optimisation, predictive maintenance and quality control automation.",
    fronts: [
      { id: "f1", text: "Production line optimisation via predictive analytics" },
      { id: "f2", text: "Quality control automation with computer vision" },
    ],
    nextSteps: [
      { id: "n1", text: "Close meeting date", done: false },
      { id: "n2", text: "Prepare first opportunity framing", done: false },
    ],
    contacts: [{ id: "c1", name: "Contact TBD", role: "TBD", email: "" }],
    docs: [],
    notes: "Initial contact made. Waiting for meeting date confirmation.",
    proposed: false,
    notesList: [],
  },
  {
    id: "tlantic",
    company: "Tlantic",
    status: "lead",
    ownerId: "humberto",
    summary: "Potential AI transformation across retail solutions.",
    challenge: "AI integration across product suite and retail client operations.",
    fronts: [
      { id: "f3", text: "Customer behaviour analytics" },
      { id: "f4", text: "Inventory optimisation and demand prediction" },
    ],
    nextSteps: [{ id: "n3", text: "Schedule first discovery call", done: false }],
    contacts: [{ id: "c2", name: "Contact TBD", role: "TBD", email: "" }],
    docs: [],
    notes: "Connection through academic network. Meeting to be scheduled.",
    proposed: false,
    notesList: [],
  },
];

export const DEFAULT_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Board sync", date: "2026-04-07", time: "09:00", allDay: false, type: "internal", duration: 60, notes: "", attachments: [], linkedNoteId: "", linkedVerticalId: "", linkedB2AId: "" },
  { id: "e2", title: "Compy sprint review", date: "2026-04-08", time: "10:00", allDay: false, type: "vertical", duration: 60, notes: "", attachments: [], linkedNoteId: "", linkedVerticalId: "compy", linkedB2AId: "" },
  { id: "e3", title: "A. Brito discovery", date: "2026-04-09", time: "14:00", allDay: false, type: "b2a", duration: 60, notes: "", attachments: [], linkedNoteId: "", linkedVerticalId: "", linkedB2AId: "abrito" },
  { id: "e4", title: "Strategy block", date: "2026-04-10", time: "11:00", allDay: false, type: "deep_work", duration: 90, notes: "", attachments: [], linkedNoteId: "", linkedVerticalId: "", linkedB2AId: "" },
];

export const DEFAULT_COSTS: Cost[] = [
  { id: "c1", name: "Claude Pro", category: "AI tools", amount: 20, billingCycle: "monthly", ownerId: "miguel", note: "" },
  { id: "c2", name: "Vercel Pro", category: "infra", amount: 20, billingCycle: "monthly", ownerId: "andre", note: "" },
  { id: "c3", name: "Google Workspace", category: "operations", amount: 12, billingCycle: "monthly", ownerId: "roque", note: "" },
  { id: "c4", name: "Linear", category: "software", amount: 8, billingCycle: "monthly", ownerId: "humberto", note: "" },
];

export const DEFAULT_NOTES: Note[] = [
  {
    id: "n1",
    title: "What is KIN",
    category: "strategic",
    description: "Core identity and purpose of the internal OS.",
    color: "#EDE8FF",
    linkedTo: null,
    blocks: [
      { id: "b1", type: "heading2", text: "Purpose" },
      { id: "b2", type: "text", text: "KIN is the internal operating system of Kind Tech." },
      { id: "b3", type: "text", text: "It connects time, knowledge, business and structure in one executive system." },
    ],
    createdAt: "2026-03-30T10:00:00Z",
    updatedAt: "2026-03-30T10:00:00Z",
  },
  {
    id: "n2",
    title: "Explore: AI-native product positioning",
    category: "explore",
    description: "How should we position Kind Tech products in a world where AI is table stakes?",
    color: "#E8F4EE",
    linkedTo: null,
    blocks: [createBlock("text")],
    createdAt: "2026-03-29T10:00:00Z",
    updatedAt: "2026-03-31T10:00:00Z",
  },
];

export const DEFAULT_OVERVIEW = {
  priorities: [
    "Close Compy pilot preparation",
    "Push first B2A opportunity to proposal",
    "Review operating costs for Q2",
  ],
};
