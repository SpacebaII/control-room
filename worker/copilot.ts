import type { CopilotProvider } from "../src/application/contracts";
import { budgetTotals, riskExposure } from "../src/domain/health";
import type { CopilotAction, CopilotProposal, Project } from "../src/domain/model";

export class DemoCopilotProvider implements CopilotProvider {
  readonly name = "demo-rules-v1" as const;

  // This provider stays synchronous internally, while sharing the live provider's async contract.
  // eslint-disable-next-line @typescript-eslint/require-await
  async propose(action: CopilotAction, project: Project, input: string, now: Date): Promise<CopilotProposal> {
    const blocked = project.workItems.filter((item) => item.status === "blocked");
    const highRisks = project.raid.filter((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15);
    const totals = budgetTotals(project);
    const base = {
      id: crypto.randomUUID(), action, provider: this.name, status: "proposed" as const, confidence: 0.88,
      warnings: ["Demo rules use only the selected project record. Review every proposed change before applying it."],
      citations: [
        { label: `${project.code} project record`, entityType: "project", entityId: project.id },
        ...project.healthReasons.slice(0, 2).map((reason) => ({ label: reason.label, entityType: "health_reason", entityId: reason.code })),
      ],
      createdAt: now.toISOString(),
    };
    if (action === "meeting_extract") {
      return { ...base, title: "Workshop notes converted into proposed controls", summary: "Three concrete records were found: a follow-up action, a pending decision, and a delivery risk.", changes: [
        { entityType: "work_item", entityId: crypto.randomUUID(), operation: "create", preview: "Confirm owner and recovery date for the primary blocker.", payload: { title: "Confirm owner and recovery date for the primary blocker", ownerId: project.managerId, status: "ready", priority: "high" } },
        { entityType: "decision", entityId: crypto.randomUUID(), operation: "create", preview: "Approve the revised delivery sequence referenced in the notes.", payload: { title: "Approve revised delivery sequence", ownerId: project.managerId, approverId: project.sponsorId } },
        { entityType: "risk", entityId: crypto.randomUUID(), operation: "create", preview: "Cross-project dependency may move the next control gate.", payload: { title: "Cross-project dependency may move the next control gate", ownerId: project.managerId } },
      ] };
    }
    if (action === "risk_scan") {
      return { ...base, title: "Control scan found one unrecorded exposure", summary: `${blocked.length} blocked item(s) and ${highRisks.length} recorded high risk(s) were evaluated.`, changes: [
        { entityType: "risk", entityId: crypto.randomUUID(), operation: "create", preview: "Blocked delivery item may compress downstream validation time.", payload: { title: "Blocked delivery item may compress downstream validation time", ownerId: blocked[0]?.ownerId ?? project.managerId } },
      ] };
    }
    if (action === "resource_scan") {
      const overloaded = project.allocations.filter((item) => item.percent > 100);
      return { ...base, title: overloaded.length ? "Capacity conflict requires a decision" : "No capacity exception found", summary: overloaded.length ? overloaded.map((item) => `${item.actorId} is allocated at ${item.percent}%`).join("; ") : "All recorded allocations are at or below available capacity.", changes: [] };
    }
    if (action === "change_impact") {
      return { ...base, title: "Change impact prepared for review", summary: `Current forecast is $${totals.forecast.toLocaleString()} against a $${totals.baseline.toLocaleString()} baseline. The proposed change should be reviewed against the critical path and contingency balance.`, changes: [] };
    }
    if (action === "status_report") {
      return { ...base, title: "Weekly brief grounded in current controls", summary: `${project.name} is ${project.health}. ${project.healthReasons.map((reason) => reason.evidence).join(" ")}`, changes: [{ entityType: "report", entityId: `report-${project.id}`, operation: "refresh", preview: "Refresh the weekly brief from current schedule, budget, risk, and decision evidence." }] };
    }
    if (action === "message_draft") {
      return { ...base, title: "Stakeholder message ready for preview", summary: `${project.name}: ${project.healthReasons[0]?.evidence ?? "Delivery remains within control limits."}`, changes: [{ entityType: "message", entityId: crypto.randomUUID(), operation: "create", preview: "Create a Teams update for Mountain West leadership.", payload: { channel: "teams", audience: "Mountain West leadership" } }] };
    }
    if (action === "what_changed") {
      return { ...base, title: "Material movement since the last update", summary: `${project.updates[0]?.text ?? "No recent narrative update."} ${project.changes.filter((item) => item.status === "submitted").length} change request(s) are awaiting a decision.`, changes: [] };
    }
    if (action === "plan") {
      return { ...base, title: "Plan completeness review", summary: `${project.milestones.length} milestones, ${project.workItems.length} work items, and ${project.dependencies.length} dependencies are recorded.`, changes: [] };
    }
    return { ...base, title: "Evidence-backed answer", summary: input.trim() ? `For “${input.trim().slice(0, 90)}”: ${project.healthReasons.map((reason) => reason.evidence).join(" ")}` : `${project.name} is ${project.health} based on ${project.healthReasons.length} active control signal(s).`, changes: [] };
  }
}
