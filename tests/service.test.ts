import { describe, expect, it } from "vitest";
import { createSeed } from "../src/application/seed";
import type { ControlRoomRepository } from "../src/application/contracts";
import { ApplicationError, ControlRoomService } from "../src/application/service";
import type { Actor, AuditEvent, CopilotProposal, FileRecord, Message, Notification, Portfolio, Project, Report } from "../src/domain/model";
import { DemoCopilotProvider } from "../worker/copilot";

class MemoryRepository implements ControlRoomRepository {
  readonly seed = createSeed(new Date("2026-08-25T16:00:00.000Z"));
  readonly projects = new Map(this.seed.projects.map((project) => [project.id, structuredClone(project)]));
  readonly messages = new Map(this.seed.messages.map((message) => [message.id, structuredClone(message)]));
  readonly reports = new Map(this.seed.reports.map((report) => [report.id, structuredClone(report)]));
  readonly proposals = new Map<string, CopilotProposal>();
  readonly events: AuditEvent[] = [];
  readonly notifications: Notification[] = [];
  async portfolio(workspaceId: string, actorId: string): Promise<Portfolio> { return { workspaceId, organization: "Horizon Service Group", program: "Mountain West Regional Launch", expiresAt: "2026-08-26T16:00:00.000Z", currentActorId: actorId, actors: this.seed.actors, projects: [...this.projects.values()], messages: [...this.messages.values()], notifications: this.notifications, reports: [...this.reports.values()], files: this.seed.files, audit: this.events }; }
  async actors(): Promise<Actor[]> { return this.seed.actors; }
  async project(_workspaceId: string, id: string): Promise<Project | null> { return structuredClone(this.projects.get(id) ?? null); }
  async saveProject(_workspaceId: string, project: Project, expectedVersion: number): Promise<Project> { const current = this.projects.get(project.id)!; if (current.version !== expectedVersion) throw new Error("version conflict"); const saved = { ...structuredClone(project), version: expectedVersion + 1 }; this.projects.set(project.id, saved); return saved; }
  async saveMessage(_workspaceId: string, message: Message) { this.messages.set(message.id, structuredClone(message)); }
  async message(_workspaceId: string, id: string) { return structuredClone(this.messages.get(id) ?? null); }
  async updateMessage(_workspaceId: string, message: Message) { this.messages.set(message.id, structuredClone(message)); }
  async saveNotification(_workspaceId: string, notification: Notification) { this.notifications.push(notification); }
  async report(_workspaceId: string, id: string) { return structuredClone(this.reports.get(id) ?? null); }
  async file(_workspaceId: string, id: string): Promise<FileRecord | null> { return this.seed.files.find((file) => file.id === id) ?? null; }
  async saveReport(_workspaceId: string, report: Report) { this.reports.set(report.id, structuredClone(report)); }
  async saveCopilot(_workspaceId: string, _actorId: string, proposal: CopilotProposal) { this.proposals.set(proposal.id, structuredClone(proposal)); }
  async copilot(_workspaceId: string, id: string) { return structuredClone(this.proposals.get(id) ?? null); }
  async updateCopilot(_workspaceId: string, proposal: CopilotProposal) { this.proposals.set(proposal.id, structuredClone(proposal)); }
  async audit(_workspaceId: string, event: AuditEvent) { this.events.push(event); }
}

describe("application workflows", () => {
  const now = () => new Date("2026-08-25T16:00:00.000Z");

  it("applies optimistic versions and records schedule evidence", async () => {
    const repository = new MemoryRepository();
    const service = new ControlRoomService(repository, new DemoCopilotProvider(), now);
    const current = await repository.project("w", "platform");
    const saved = await service.updateMilestone("w", "alex", "platform", "plt-m2", { version: current!.version, forecastDate: "2026-09-20T00:00:00.000Z" });
    expect(saved.version).toBe(current!.version + 1);
    expect(saved.health).toBe("red");
    expect(repository.events.at(-1)?.action).toBe("milestone.updated");
  });

  it("enforces sponsor-only decisions and the submitted transition", async () => {
    const repository = new MemoryRepository();
    const service = new ControlRoomService(repository, new DemoCopilotProvider(), now);
    const project = await repository.project("w", "platform");
    await expect(service.decideChange("w", "priya", "platform", "plt-c1", { version: project!.version, decision: "approved", note: "Approved" })).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<ApplicationError>);
    const saved = await service.decideChange("w", "dana", "platform", "plt-c1", { version: project!.version, decision: "approved", note: "Approved with weekly checkpoints." });
    expect(saved.changes.find((change) => change.id === "plt-c1")?.status).toBe("approved");
  });

  it("requires preview before simulated delivery and never calls an external adapter", async () => {
    const repository = new MemoryRepository();
    const service = new ControlRoomService(repository, new DemoCopilotProvider(), now);
    const preview = await service.previewMessage("w", "alex", { projectId: "hub", channel: "slack", audience: "Regional launch", body: "Network turnover is Friday; readiness evidence is due Thursday." });
    expect(preview.status).toBe("preview");
    const delivered = await service.deliverMessage("w", "alex", preview.id);
    expect(delivered.status).toBe("delivered");
    expect(repository.events.at(-1)?.detail).toMatch(/Nothing left Control Room/);
  });

  it("keeps copilot proposals inert until explicitly applied", async () => {
    const repository = new MemoryRepository();
    const service = new ControlRoomService(repository, new DemoCopilotProvider(), now);
    const before = await repository.project("w", "platform");
    const proposal = await service.runCopilot("w", "alex", "platform", "risk_scan", "");
    expect((await repository.project("w", "platform"))!.raid).toHaveLength(before!.raid.length);
    const result = await service.applyCopilot("w", "alex", "platform", proposal.id, before!.version);
    expect(result.proposal.status).toBe("applied");
    expect(result.project.raid).toHaveLength(before!.raid.length + 1);
  });
});
