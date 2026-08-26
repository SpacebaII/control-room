import type { ChangeRequest, CopilotAction, CopilotProposal, Message, Portfolio, Project, RaidItem, Report, ReportStatus, WorkItem } from "./domain/model";

interface ApiErrorBody { error?: { code?: string; message?: string }; current?: Project }
export interface AuthSession { authenticated: boolean; login?: string; configured: boolean; liveAvailable: boolean; usage: { runs: number; limit: number; inputTokens: number; outputTokens: number } }

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly current?: Project) { super(message); }
}

let actorId = "alex";
export function setApiActor(id: string) { actorId = id; }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Control-Room-Actor": actorId, ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new ApiError(response.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "Request failed.", body.current);
  }
  return response.json() as Promise<T>;
}

const patch = <T>(path: string, value: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(value) });
const post = <T>(path: string, value?: unknown) => request<T>(path, { method: "POST", body: value === undefined ? undefined : JSON.stringify(value) });

export const api = {
  portfolio: () => request<Portfolio>("/portfolio"),
  reset: () => post<Portfolio>("/demo/reset"),
  milestone: (projectId: string, milestoneId: string, value: { version: number; forecastDate?: string; status?: "not_started" | "in_progress" | "complete" }) => patch<Project>(`/projects/${projectId}/milestones/${milestoneId}`, value),
  work: (projectId: string, itemId: string, value: { version: number; status: WorkItem["status"]; blocker?: string }) => patch<Project>(`/projects/${projectId}/work/${itemId}`, value),
  raid: (projectId: string, itemId: string, value: { version: number; status: RaidItem["status"]; response: string; dueDate: string }) => patch<Project>(`/projects/${projectId}/raid/${itemId}`, value),
  budget: (projectId: string, lineId: string, value: { version: number; forecast: number }) => patch<Project>(`/projects/${projectId}/budget/${lineId}`, value),
  allocation: (projectId: string, allocationActorId: string, value: { version: number; percent: number }) => patch<Project>(`/projects/${projectId}/team/${allocationActorId}`, value),
  registeredDecision: (projectId: string, decisionId: string, value: { version: number; status: "approved" | "rejected"; rationale: string }) => patch<Project>(`/projects/${projectId}/decisions/${decisionId}`, value),
  update: (projectId: string, value: { version: number; text: string }) => post(`/projects/${projectId}/updates`, value),
  createChange: (projectId: string, value: Omit<ChangeRequest, "id" | "status" | "requestedBy" | "submittedAt"> & { version: number }) => post<ChangeRequest>(`/projects/${projectId}/changes`, value),
  decideChange: (projectId: string, changeId: string, value: { version: number; decision: "approved" | "rejected"; note: string }) => post<Project>(`/projects/${projectId}/changes/${changeId}/decision`, value),
  implementChange: (projectId: string, changeId: string, version: number) => post<Project>(`/projects/${projectId}/changes/${changeId}/implement`, { version }),
  previewMessage: (value: Omit<Message, "id" | "status" | "authorId" | "createdAt">) => post<Message>("/messages", value),
  deliverMessage: (id: string) => post<Message>(`/messages/${id}/deliver`),
  generateReport: (projectId: string) => post<Report>(`/projects/${projectId}/reports/generate`),
  reportStatus: (id: string, status: ReportStatus) => patch<Report>(`/reports/${id}`, { status }),
  auth: async () => {
    const response = await fetch("/auth/session", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new ApiError(response.status, "AUTH_FAILED", "Owner session could not be checked.");
    return response.json() as Promise<AuthSession>;
  },
  copilot: (projectId: string, action: CopilotAction, input: string, mode: "demo" | "live" = "demo") => post<CopilotProposal>("/copilot/runs", { projectId, action, input, mode }),
  applyCopilot: (id: string, projectId: string, version: number, selectedIds?: string[]) => post<{ proposal: CopilotProposal; project: Project }>(`/copilot/runs/${id}/apply`, { projectId, version, selectedIds }),
  rejectCopilot: (id: string) => post<CopilotProposal>(`/copilot/runs/${id}/reject`),
};
