export type Health = "green" | "amber" | "red";
export type Role = "sponsor" | "program_director" | "lead" | "contributor" | "viewer";
export type WorkStatus = "backlog" | "ready" | "in_progress" | "blocked" | "done";
export type RaidType = "risk" | "assumption" | "issue" | "dependency";
export type RaidStatus = "identified" | "assessed" | "responding" | "monitoring" | "closed";
export type ChangeStatus = "draft" | "submitted" | "approved" | "rejected" | "implemented";
export type DecisionStatus = "proposed" | "pending" | "approved" | "rejected" | "superseded";
export type ReportStatus = "draft" | "review" | "approved" | "published";
export type Channel = "slack" | "teams" | "email";

export interface Actor {
  id: string;
  name: string;
  role: Role;
  title: string;
  function: string;
  initials: string;
  availability: number;
}

export interface Milestone {
  id: string;
  name: string;
  phase: string;
  ownerId: string;
  baselineDate: string;
  forecastDate: string;
  status: "not_started" | "in_progress" | "complete";
  critical: boolean;
}

export interface WorkItem {
  id: string;
  title: string;
  ownerId: string;
  milestoneId: string;
  status: WorkStatus;
  dueDate: string;
  priority: "low" | "medium" | "high" | "critical";
  blocker?: string;
}

export interface Dependency {
  id: string;
  fromMilestoneId: string;
  toMilestoneId: string;
  kind: "finish_to_start" | "external";
  note: string;
}

export interface RaidItem {
  id: string;
  type: RaidType;
  title: string;
  ownerId: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  status: RaidStatus;
  dueDate: string;
  response: string;
  lastActionAt: string;
  source: string;
}

export interface Decision {
  id: string;
  title: string;
  status: DecisionStatus;
  ownerId: string;
  approverId: string;
  rationale: string;
  alternatives: string[];
  decidedAt?: string;
  impact: string;
}

export interface BudgetLine {
  id: string;
  category: string;
  vendor: string;
  baseline: number;
  actual: number;
  committed: number;
  forecast: number;
}

export interface Allocation {
  actorId: string;
  percent: number;
  workstream: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  status: ChangeStatus;
  requestedBy: string;
  ownerId: string;
  submittedAt?: string;
  scheduleImpactDays: number;
  budgetImpact: number;
  riskImpact: string;
  rationale: string;
  decisionNote?: string;
}

export interface ProjectUpdate {
  id: string;
  actorId: string;
  createdAt: string;
  text: string;
  kind: "weekly" | "comment" | "system";
}

export interface HealthReason {
  code: string;
  severity: Health;
  label: string;
  evidence: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  objective: string;
  outcome: string;
  stage: string;
  sponsorId: string;
  managerId: string;
  startDate: string;
  targetDate: string;
  health: Health;
  healthReasons: HealthReason[];
  version: number;
  updatedAt: string;
  lastStatusAt: string;
  milestones: Milestone[];
  workItems: WorkItem[];
  dependencies: Dependency[];
  raid: RaidItem[];
  decisions: Decision[];
  budget: BudgetLine[];
  allocations: Allocation[];
  changes: ChangeRequest[];
  updates: ProjectUpdate[];
  manualOverride?: { health: Health; reason: string; expiresAt: string };
}

export interface Message {
  id: string;
  projectId: string;
  channel: Channel;
  status: "draft" | "preview" | "delivered";
  audience: string;
  subject?: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  actorId: string;
  projectId?: string;
  kind: "mention" | "approval" | "assignment" | "report" | "message";
  title: string;
  detail: string;
  createdAt: string;
  readAt?: string;
}

export interface Report {
  id: string;
  projectId: string;
  period: string;
  status: ReportStatus;
  version: number;
  headline: string;
  summary: string;
  accomplishments: string[];
  next: string[];
  decisionsNeeded: string[];
  evidence: Array<{ label: string; entityType: string; entityId: string }>;
  updatedAt: string;
  approvedBy?: string;
}

export interface FileRecord {
  id: string;
  projectId?: string;
  filename: string;
  title: string;
  contentType: string;
  assetPath: string;
  sizeLabel: string;
  version: string;
  ownerId: string;
  updatedAt: string;
  summary: string;
  tags: string[];
}

export type CopilotAction = "plan" | "risk_scan" | "meeting_extract" | "change_impact" | "status_report" | "what_changed" | "resource_scan" | "message_draft" | "ask";

export interface CopilotProposal {
  id: string;
  action: CopilotAction;
  provider: "demo-rules-v1" | "openai";
  status: "proposed" | "applied" | "rejected";
  title: string;
  summary: string;
  confidence: number;
  warnings: string[];
  citations: Array<{ label: string; entityType: string; entityId: string }>;
  changes: Array<{ entityType: string; entityId: string; operation: string; preview: string; payload?: Record<string, unknown> }>;
  createdAt: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AuditEvent {
  id: string;
  actorId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface Portfolio {
  workspaceId: string;
  organization: string;
  program: string;
  expiresAt: string;
  currentActorId: string;
  actors: Actor[];
  projects: Project[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
  files: FileRecord[];
  audit: AuditEvent[];
}
