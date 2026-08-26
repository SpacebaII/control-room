import type { Actor, AuditEvent, CopilotProposal, FileRecord, Message, Notification, Portfolio, Project, Report } from "../domain/model";

export interface ControlRoomRepository {
  portfolio(workspaceId: string, actorId: string): Promise<Portfolio>;
  actors(workspaceId: string): Promise<Actor[]>;
  project(workspaceId: string, id: string): Promise<Project | null>;
  saveProject(workspaceId: string, project: Project, expectedVersion: number): Promise<Project>;
  saveMessage(workspaceId: string, message: Message): Promise<void>;
  message(workspaceId: string, id: string): Promise<Message | null>;
  updateMessage(workspaceId: string, message: Message): Promise<void>;
  saveNotification(workspaceId: string, notification: Notification): Promise<void>;
  report(workspaceId: string, id: string): Promise<Report | null>;
  file(workspaceId: string, id: string): Promise<FileRecord | null>;
  saveReport(workspaceId: string, report: Report): Promise<void>;
  saveCopilot(workspaceId: string, actorId: string, proposal: CopilotProposal): Promise<void>;
  copilot(workspaceId: string, id: string): Promise<CopilotProposal | null>;
  updateCopilot(workspaceId: string, proposal: CopilotProposal): Promise<void>;
  audit(workspaceId: string, event: AuditEvent): Promise<void>;
}

export interface CopilotProvider {
  readonly name: "demo-rules-v1" | "openai";
  propose(action: CopilotProposal["action"], project: Project, input: string, now: Date): Promise<CopilotProposal>;
}
