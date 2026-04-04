export type CaptureContext =
  | "today"
  | "inbox"
  | `vertical:${string}`
  | `b2a:${string}`;

export interface Profile {
  id: string;
  email?: string | null;
  name: string;
  role: string;
  color: string;
  avatarInitials: string | null;
  createdAt?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  linkedTo: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DayNoteRecord {
  id?: string;
  date: string;
  content: string;
  todos: TodoItem[];
  updatedAt?: string;
}

export interface Milestone {
  id: string;
  title: string;
  ownerId: string;
  status: string;
  dueDate: string;
}

export interface DocItem {
  id: string;
  name: string;
  type: string;
  url: string;
  path?: string;
}

export interface InlineNote {
  id: string;
  title: string;
  content: string;
  body?: string;
}

export interface VerticalRecord {
  id: string;
  name: string;
  status: string;
  phase: string;
  summary: string;
  description: string;
  partner: string;
  ownerId: string;
  health: string;
  proposed: boolean;
  milestones: Milestone[];
  docs: DocItem[];
  notesList: InlineNote[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FrontItem {
  id: string;
  text: string;
}

export interface NextStepItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface B2ARecord {
  id: string;
  company: string;
  status: string;
  ownerId: string;
  summary: string;
  challenge: string;
  fronts: FrontItem[];
  nextSteps: NextStepItem[];
  contacts: ContactItem[];
  docs: DocItem[];
  notes: string;
  proposed: boolean;
  notesList: InlineNote[];
  createdAt?: string;
  updatedAt?: string;
}

export interface NoteBlock {
  id: string;
  type:
    | "text"
    | "heading1"
    | "heading2"
    | "heading3"
    | "todo"
    | "divider"
    | "callout"
    | "code"
    | "table"
    | "image"
    | "pdf"
    | "note_link"
    | "entity_link";
  text?: string;
  checked?: boolean;
  indent?: number;
  icon?: string;
  language?: string;
  rows?: string[][];
  name?: string;
  path?: string;
  src?: string;
  caption?: string;
  noteId?: string;
  entity?: string;
}

export interface NoteRecord {
  id: string;
  title: string;
  description: string;
  category: "explore" | "strategic";
  color: string;
  blocks: NoteBlock[];
  linkedTo: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CostRecord {
  id: string;
  name: string;
  amount: number;
  billing: "monthly" | "annual";
  category: "ai" | "infra" | "software" | "ops" | "tools";
  ownerId: string;
  active: boolean;
  createdAt?: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  role: string;
  focus: string;
  color: string;
  type: "board" | "team";
  status: string;
  createdAt?: string;
}

export interface TalentRecord {
  id: string;
  name: string;
  role: string;
  status: "observing" | "contact" | "interviewing" | "future_fit";
  notes: string;
  createdAt?: string;
}

export interface InboxRecord {
  id: string;
  text: string;
  context: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export type Block = NoteBlock;
export type Note = NoteRecord;
export type ProfileRecord = Profile;

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials?: string;
  color: string;
  status: string;
  focusArea?: string;
}

export interface TalentEntry {
  id: string;
  name: string;
  linkedin: string;
  role: string;
  notes: string;
  tags: string[];
  status: string;
}

export type Vertical = VerticalRecord;
export type B2AItem = B2ARecord;
export type Front = FrontItem;
export type NextStep = NextStepItem;
export type Contact = ContactItem;

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  duration: number;
  notes: string;
  attachments: DocItem[];
  linkedNoteId: string;
  linkedVerticalId: string;
  linkedB2AId: string;
}

export interface Cost {
  id: string;
  name: string;
  category: string;
  amount: number;
  billingCycle: string;
  ownerId: string;
  note?: string;
}

export type DayFollowUpItem = TodoItem;

export interface AppState {
  team: TeamMember[];
  talent: TalentEntry[];
  verticals: Vertical[];
  b2a: B2AItem[];
  events: CalendarEvent[];
  notes: Note[];
  costs: Cost[];
  overview: { priorities: string[] };
  dayNotes: Record<string, string>;
  dayFollowUps: Record<string, DayFollowUpItem[]>;
  dayDecisions: Record<string, string>;
}
