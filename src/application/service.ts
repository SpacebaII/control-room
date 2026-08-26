import { evaluateHealth } from "../domain/health";
import type { Actor, AuditEvent, ChangeRequest, CopilotAction, Message, Portfolio, Project, RaidItem, Report, ReportStatus, Role, WorkItem } from "../domain/model";
import type { ControlRoomRepository, CopilotProvider } from "./contracts";

export class ApplicationError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
}

export class ControlRoomService {
  constructor(private readonly repository: ControlRoomRepository, private readonly copilotProvider: CopilotProvider, private readonly now = () => new Date()) {}

  async portfolio(workspaceId: string, actorId: string): Promise<Portfolio> {
    await this.actor(workspaceId, actorId);
    return this.repository.portfolio(workspaceId, actorId);
  }

  async updateMilestone(workspaceId: string, actorId: string, projectId: string, milestoneId: string, input: { version: number; forecastDate?: string; status?: "not_started" | "in_progress" | "complete" }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead", "contributor"]);
    const project = await this.getProject(workspaceId, projectId);
    const milestone = project.milestones.find((item) => item.id === milestoneId);
    if (!milestone) throw new ApplicationError("NOT_FOUND", "Milestone not found.", 404);
    if (actor.role === "contributor" && milestone.ownerId !== actor.id) throw new ApplicationError("FORBIDDEN", "Contributors can update only their assigned milestones.", 403);
    if (input.forecastDate) milestone.forecastDate = input.forecastDate;
    if (input.status) milestone.status = input.status;
    return this.saveEvaluated(workspaceId, actor, project, input.version, "milestone.updated", milestone.id, `${milestone.name} forecast or status was updated.`);
  }

  async updateWorkItem(workspaceId: string, actorId: string, projectId: string, itemId: string, input: { version: number; status: WorkItem["status"]; blocker?: string }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead", "contributor"]);
    const project = await this.getProject(workspaceId, projectId);
    const item = project.workItems.find((entry) => entry.id === itemId);
    if (!item) throw new ApplicationError("NOT_FOUND", "Work item not found.", 404);
    if (actor.role === "contributor" && item.ownerId !== actor.id) throw new ApplicationError("FORBIDDEN", "Contributors can update only their assigned work.", 403);
    item.status = input.status;
    item.blocker = input.status === "blocked" ? input.blocker?.trim() || "Blocker reason not supplied." : undefined;
    return this.saveEvaluated(workspaceId, actor, project, input.version, "work.updated", item.id, `${item.title} moved to ${item.status.replaceAll("_", " ")}.`);
  }

  async updateRisk(workspaceId: string, actorId: string, projectId: string, riskId: string, input: { version: number; status: RaidItem["status"]; response: string; dueDate: string }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const risk = project.raid.find((item) => item.id === riskId);
    if (!risk) throw new ApplicationError("NOT_FOUND", "RAID item not found.", 404);
    risk.status = input.status; risk.response = input.response.trim(); risk.dueDate = input.dueDate; risk.lastActionAt = this.now().toISOString();
    return this.saveEvaluated(workspaceId, actor, project, input.version, "raid.updated", risk.id, `${risk.title} moved to ${risk.status}.`);
  }

  async updateBudget(workspaceId: string, actorId: string, projectId: string, lineId: string, input: { version: number; forecast: number }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const line = project.budget.find((item) => item.id === lineId);
    if (!line) throw new ApplicationError("NOT_FOUND", "Budget line not found.", 404);
    line.forecast = input.forecast;
    return this.saveEvaluated(workspaceId, actor, project, input.version, "budget.forecast_updated", line.id, `${line.category} forecast changed to $${line.forecast.toLocaleString()}.`);
  }

  async updateAllocation(workspaceId: string, actorId: string, projectId: string, allocationActorId: string, input: { version: number; percent: number }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const allocation = project.allocations.find((item) => item.actorId === allocationActorId);
    if (!allocation) throw new ApplicationError("NOT_FOUND", "Team allocation not found.", 404);
    allocation.percent = input.percent;
    return this.saveEvaluated(workspaceId, actor, project, input.version, "allocation.updated", allocation.actorId, `${allocation.workstream} allocation changed to ${allocation.percent}%.`);
  }

  async decideRegisteredDecision(workspaceId: string, actorId: string, projectId: string, decisionId: string, input: { version: number; status: "approved" | "rejected"; rationale: string }) {
    const actor = await this.requireRole(workspaceId, actorId, ["sponsor"]);
    const project = await this.getProject(workspaceId, projectId);
    const decision = project.decisions.find((item) => item.id === decisionId);
    if (!decision) throw new ApplicationError("NOT_FOUND", "Decision not found.", 404);
    if (decision.status !== "proposed" && decision.status !== "pending") {
      throw new ApplicationError("INVALID_STATE", "Only proposed or pending decisions can be decided.", 409);
    }
    decision.status = input.status; decision.rationale = input.rationale.trim(); decision.decidedAt = this.now().toISOString();
    return this.saveEvaluated(workspaceId, actor, project, input.version, `decision.${input.status}`, decision.id, decision.rationale);
  }

  async createChange(workspaceId: string, actorId: string, projectId: string, input: Omit<ChangeRequest, "id" | "status" | "requestedBy" | "submittedAt"> & { version: number }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const change: ChangeRequest = { ...input, id: crypto.randomUUID(), status: "submitted", requestedBy: actor.id, submittedAt: this.now().toISOString() };
    project.changes.unshift(change);
    await this.saveEvaluated(workspaceId, actor, project, input.version, "change.submitted", change.id, `${change.title} requests ${change.scheduleImpactDays} day(s) and $${change.budgetImpact.toLocaleString()}.`);
    return change;
  }

  async decideChange(workspaceId: string, actorId: string, projectId: string, changeId: string, input: { version: number; decision: "approved" | "rejected"; note: string }) {
    const actor = await this.requireRole(workspaceId, actorId, ["sponsor"]);
    const project = await this.getProject(workspaceId, projectId);
    const change = project.changes.find((item) => item.id === changeId);
    if (!change) throw new ApplicationError("NOT_FOUND", "Change request not found.", 404);
    if (change.status !== "submitted") throw new ApplicationError("INVALID_STATE", "Only submitted changes can be decided.", 409);
    change.status = input.decision; change.decisionNote = input.note.trim();
    return this.saveEvaluated(workspaceId, actor, project, input.version, `change.${input.decision}`, change.id, change.decisionNote);
  }

  async implementChange(workspaceId: string, actorId: string, projectId: string, changeId: string, input: { version: number }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director"]);
    const project = await this.getProject(workspaceId, projectId);
    const change = project.changes.find((item) => item.id === changeId);
    if (!change) throw new ApplicationError("NOT_FOUND", "Change request not found.", 404);
    if (change.status !== "approved") throw new ApplicationError("INVALID_STATE", "Only approved changes can be implemented.", 409);
    change.status = "implemented";
    if (change.budgetImpact !== 0) {
      project.budget.push({ id: crypto.randomUUID(), category: "Approved change", vendor: "Program contingency", baseline: 0, actual: 0, committed: change.budgetImpact, forecast: change.budgetImpact });
    }
    return this.saveEvaluated(workspaceId, actor, project, input.version, "change.implemented", change.id, `${change.title} was applied to the working forecast.`);
  }

  async addUpdate(workspaceId: string, actorId: string, projectId: string, input: { version: number; text: string }) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead", "contributor"]);
    const project = await this.getProject(workspaceId, projectId);
    const update = { id: crypto.randomUUID(), actorId: actor.id, createdAt: this.now().toISOString(), text: input.text.trim(), kind: "comment" as const };
    project.updates.unshift(update);
    await this.saveEvaluated(workspaceId, actor, project, input.version, "update.posted", update.id, update.text);
    return update;
  }

  async previewMessage(workspaceId: string, actorId: string, input: Omit<Message, "id" | "status" | "authorId" | "createdAt">) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead", "contributor"]);
    await this.getProject(workspaceId, input.projectId);
    const message: Message = { ...input, id: crypto.randomUUID(), status: "preview", authorId: actor.id, createdAt: this.now().toISOString() };
    await this.repository.saveMessage(workspaceId, message);
    await this.record(workspaceId, actor.id, message.projectId, "message", message.id, "message.previewed", `${message.channel} message prepared for ${message.audience}.`);
    return message;
  }

  async deliverMessage(workspaceId: string, actorId: string, messageId: string) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const message = await this.repository.message(workspaceId, messageId);
    if (!message) throw new ApplicationError("NOT_FOUND", "Message not found.", 404);
    if (message.status !== "preview") throw new ApplicationError("INVALID_STATE", "Only previewed messages can be delivered.", 409);
    message.status = "delivered";
    await this.repository.updateMessage(workspaceId, message);
    await this.repository.saveNotification(workspaceId, { id: crypto.randomUUID(), actorId: message.projectId === "platform" ? "dana" : "alex", projectId: message.projectId, kind: "message", title: `Simulated ${message.channel} delivery`, detail: message.subject ?? message.body.slice(0, 100), createdAt: this.now().toISOString() });
    await this.record(workspaceId, actor.id, message.projectId, "message", message.id, "message.delivered", `Delivered to the simulated ${message.channel} channel. Nothing left Control Room.`);
    return message;
  }

  async generateReport(workspaceId: string, actorId: string, projectId: string) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const current = await this.repository.report(workspaceId, `report-${project.id}`);
    const report = this.buildReport(project, current?.version ? current.version + 1 : 1);
    await this.repository.saveReport(workspaceId, report);
    await this.record(workspaceId, actor.id, project.id, "report", report.id, "report.generated", "Weekly brief regenerated from current project evidence.");
    return report;
  }

  async setReportStatus(workspaceId: string, actorId: string, reportId: string, status: ReportStatus) {
    const actor = await this.actor(workspaceId, actorId);
    const report = await this.repository.report(workspaceId, reportId);
    if (!report) throw new ApplicationError("NOT_FOUND", "Report not found.", 404);
    if ((status === "approved" || status === "published") && actor.role !== "sponsor") throw new ApplicationError("FORBIDDEN", "Only the sponsor can approve or publish reports.", 403);
    if (status === "review" && !["program_director", "lead"].includes(actor.role)) throw new ApplicationError("FORBIDDEN", "Only a manager can submit reports for review.", 403);
    report.status = status; report.version += 1; report.updatedAt = this.now().toISOString(); report.approvedBy = status === "approved" || status === "published" ? actor.id : report.approvedBy;
    await this.repository.saveReport(workspaceId, report);
    await this.record(workspaceId, actor.id, report.projectId, "report", report.id, `report.${status}`, `Status brief moved to ${status}.`);
    return report;
  }

  async runCopilot(workspaceId: string, actorId: string, projectId: string, action: CopilotAction, input: string) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "sponsor", "lead"]);
    const project = await this.getProject(workspaceId, projectId);
    const proposal = await this.copilotProvider.propose(action, project, input, this.now());
    await this.repository.saveCopilot(workspaceId, actor.id, proposal);
    await this.record(workspaceId, actor.id, project.id, "copilot_run", proposal.id, "copilot.proposed", `${proposal.action} produced ${proposal.changes.length} proposed change(s).`);
    return proposal;
  }

  async applyCopilot(workspaceId: string, actorId: string, projectId: string, proposalId: string, expectedVersion: number, selectedIds?: string[]) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const proposal = await this.repository.copilot(workspaceId, proposalId);
    if (!proposal) throw new ApplicationError("NOT_FOUND", "Copilot proposal not found.", 404);
    if (proposal.status !== "proposed") throw new ApplicationError("INVALID_STATE", "This proposal was already decided.", 409);
    const project = await this.getProject(workspaceId, projectId);
    const selectedChanges = selectedIds ? proposal.changes.filter((change) => selectedIds.includes(change.entityId)) : proposal.changes;
    for (const change of selectedChanges) {
      const payload = change.payload ?? {};
      if (change.entityType === "work_item" && change.operation === "create") project.workItems.unshift({ id: change.entityId, title: text(payload.title, "Follow up on meeting action"), ownerId: text(payload.ownerId, project.managerId), milestoneId: project.milestones.find((item) => item.status !== "complete")?.id ?? project.milestones[0]?.id ?? "unassigned", status: "ready", dueDate: new Date(this.now().getTime() + 7 * 86_400_000).toISOString(), priority: "high" });
      if (change.entityType === "decision" && change.operation === "create") project.decisions.unshift({ id: change.entityId, title: text(payload.title, "Review proposed decision"), status: "pending", ownerId: text(payload.ownerId, project.managerId), approverId: text(payload.approverId, project.sponsorId), rationale: proposal.summary, alternatives: ["Proceed", "Defer"], impact: "Pending manager assessment." });
      if (change.entityType === "risk" && change.operation === "create") project.raid.unshift({ id: change.entityId, type: "risk", title: text(payload.title, "Copilot-identified delivery exposure"), ownerId: text(payload.ownerId, project.managerId), probability: 3, impact: 4, status: "identified", dueDate: new Date(this.now().getTime() + 7 * 86_400_000).toISOString(), response: "Owner to assess and define response.", lastActionAt: this.now().toISOString(), source: `Accepted ${proposal.provider} proposal` });
      if (change.entityType === "message" && change.operation === "create") await this.previewMessage(workspaceId, actorId, { projectId, channel: payload.channel === "email" || payload.channel === "slack" ? payload.channel : "teams", audience: text(payload.audience, "Project team"), body: proposal.summary });
      if (change.entityType === "report" && change.operation === "refresh") await this.generateReport(workspaceId, actorId, projectId);
    }
    const saved = selectedChanges.some((change) => ["work_item", "decision", "risk"].includes(change.entityType))
      ? await this.saveEvaluated(workspaceId, actor, project, expectedVersion, "copilot.applied", proposal.id, `${selectedChanges.length} reviewed proposal(s) applied.`)
      : project;
    proposal.status = "applied";
    await this.repository.updateCopilot(workspaceId, proposal);
    return { proposal, project: saved };
  }

  async rejectCopilot(workspaceId: string, actorId: string, proposalId: string) {
    const actor = await this.requireRole(workspaceId, actorId, ["program_director", "lead"]);
    const proposal = await this.repository.copilot(workspaceId, proposalId);
    if (!proposal) throw new ApplicationError("NOT_FOUND", "Copilot proposal not found.", 404);
    if (proposal.status !== "proposed") throw new ApplicationError("INVALID_STATE", "This proposal was already decided.", 409);
    proposal.status = "rejected"; await this.repository.updateCopilot(workspaceId, proposal);
    await this.record(workspaceId, actor.id, undefined, "copilot_run", proposal.id, "copilot.rejected", "Proposal rejected without changing project data.");
    return proposal;
  }

  private buildReport(project: Project, version: number): Report {
    return {
      id: `report-${project.id}`, projectId: project.id, period: `Week ending ${this.now().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, status: "draft", version,
      headline: project.health === "red" ? "Decision required to protect delivery" : project.health === "amber" ? "Delivery remains viable with active exceptions" : "Delivery remains within control limits",
      summary: `${project.name} is ${project.health}. ${project.healthReasons.map((reason) => reason.evidence).join(" ")}`,
      accomplishments: project.milestones.filter((item) => item.status === "complete").map((item) => item.name),
      next: project.workItems.filter((item) => item.status !== "done").slice(0, 4).map((item) => item.title),
      decisionsNeeded: project.decisions.filter((item) => item.status === "pending").map((item) => item.title),
      evidence: project.healthReasons.map((reason) => ({ label: reason.label, entityType: "health_reason", entityId: reason.code })), updatedAt: this.now().toISOString(),
    };
  }

  private async getProject(workspaceId: string, projectId: string) {
    const project = await this.repository.project(workspaceId, projectId);
    if (!project) throw new ApplicationError("NOT_FOUND", "Project not found.", 404);
    return project;
  }

  private async actor(workspaceId: string, actorId: string) {
    const actor = (await this.repository.actors(workspaceId)).find((item) => item.id === actorId);
    if (!actor) throw new ApplicationError("INVALID_ACTOR", "Selected team member is not part of this workspace.", 403);
    return actor;
  }

  private async requireRole(workspaceId: string, actorId: string, roles: Role[]) {
    const actor = await this.actor(workspaceId, actorId);
    if (!roles.includes(actor.role)) throw new ApplicationError("FORBIDDEN", `${actor.title} does not have permission for this action.`, 403);
    return actor;
  }

  private async saveEvaluated(workspaceId: string, actor: Actor, project: Project, expectedVersion: number, action: string, entityId: string, detail: string) {
    const evaluated = evaluateHealth(project, this.now()); project.health = evaluated.health; project.healthReasons = evaluated.reasons;
    const saved = await this.repository.saveProject(workspaceId, project, expectedVersion);
    await this.record(workspaceId, actor.id, project.id, action.split(".")[0] ?? "project", entityId, action, detail);
    return saved;
  }

  private async record(workspaceId: string, actorId: string, projectId: string | undefined, entityType: string, entityId: string, action: string, detail: string) {
    const event: AuditEvent = { id: crypto.randomUUID(), actorId, projectId, entityType, entityId, action, detail, createdAt: this.now().toISOString() };
    await this.repository.audit(workspaceId, event);
  }
}

function text(value: unknown, fallback: string) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
