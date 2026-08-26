import type { Health, HealthReason, Project } from "./model";

const DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

export function riskExposure(probability: number, impact: number): number {
  return probability * impact;
}

export function riskBand(exposure: number): "low" | "medium" | "high" {
  if (exposure >= 15) return "high";
  if (exposure >= 8) return "medium";
  return "low";
}

export function budgetTotals(project: Project) {
  return project.budget.reduce(
    (total, line) => ({
      baseline: total.baseline + line.baseline,
      actual: total.actual + line.actual,
      committed: total.committed + line.committed,
      forecast: total.forecast + line.forecast,
    }),
    { baseline: 0, actual: 0, committed: 0, forecast: 0 },
  );
}

export function evaluateHealth(project: Project, now = new Date()): { health: Health; reasons: HealthReason[] } {
  if (project.manualOverride && Date.parse(project.manualOverride.expiresAt) > now.getTime()) {
    return {
      health: project.manualOverride.health,
      reasons: [{ code: "MANUAL_OVERRIDE", severity: project.manualOverride.health, label: "Manager override", evidence: project.manualOverride.reason }],
    };
  }

  const reasons: HealthReason[] = [];
  const add = (reason: HealthReason) => reasons.push(reason);
  const criticalSlip = project.milestones.find((item) => item.critical && daysBetween(item.baselineDate, item.forecastDate) > 14 && item.status !== "complete");
  if (criticalSlip) add({ code: "CRITICAL_SLIP", severity: "red", label: "Critical milestone slipped", evidence: `${criticalSlip.name} is ${daysBetween(criticalSlip.baselineDate, criticalSlip.forecastDate)} days beyond baseline.` });

  const smallerSlip = project.milestones.find((item) => {
    const slip = daysBetween(item.baselineDate, item.forecastDate);
    return slip > 0 && slip <= 14 && item.status !== "complete";
  });
  if (smallerSlip) add({ code: "MILESTONE_SLIP", severity: "amber", label: "Milestone forecast moved", evidence: `${smallerSlip.name} is ${daysBetween(smallerSlip.baselineDate, smallerSlip.forecastDate)} days beyond baseline.` });

  const overdueBlocker = project.workItems.find((item) => item.status === "blocked" && item.priority === "critical" && Date.parse(item.dueDate) < now.getTime());
  if (overdueBlocker) add({ code: "CRITICAL_BLOCKER", severity: "red", label: "Critical blocker overdue", evidence: overdueBlocker.title });

  const totals = budgetTotals(project);
  const variancePercent = totals.baseline === 0 ? 0 : ((totals.forecast - totals.baseline) / totals.baseline) * 100;
  if (variancePercent > 10) add({ code: "BUDGET_RED", severity: "red", label: "Forecast exceeds baseline", evidence: `${variancePercent.toFixed(1)}% forecast variance.` });
  else if (variancePercent >= 3) add({ code: "BUDGET_AMBER", severity: "amber", label: "Budget pressure", evidence: `${variancePercent.toFixed(1)}% forecast variance.` });

  const overdueHighRisk = project.raid.find((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15 && Date.parse(item.dueDate) < now.getTime());
  if (overdueHighRisk) add({ code: "HIGH_RISK_OVERDUE", severity: "red", label: "High risk response overdue", evidence: overdueHighRisk.title });

  const staleHighRisk = project.raid.find((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15 && now.getTime() - Date.parse(item.lastActionAt) > 7 * DAY);
  if (staleHighRisk && !overdueHighRisk) add({ code: "HIGH_RISK_STALE", severity: "amber", label: "High risk needs action", evidence: staleHighRisk.title });

  const overloaded = project.allocations.find((allocation) => allocation.percent > 100);
  if (overloaded) add({ code: "RESOURCE_OVERLOAD", severity: "amber", label: "Resource allocation exceeds capacity", evidence: `${overloaded.actorId} is allocated at ${overloaded.percent}%.` });

  if (now.getTime() - Date.parse(project.lastStatusAt) > 7 * DAY) add({ code: "STALE_UPDATE", severity: "amber", label: "Status update is stale", evidence: "No approved update in the last seven days." });

  const health: Health = reasons.some((reason) => reason.severity === "red") ? "red" : reasons.some((reason) => reason.severity === "amber") ? "amber" : "green";
  return { health, reasons: reasons.length ? reasons : [{ code: "ON_PLAN", severity: "green", label: "Within control limits", evidence: "No current schedule, budget, risk, or capacity exception." }] };
}
