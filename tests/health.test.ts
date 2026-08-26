import { describe, expect, it } from "vitest";
import { createSeed } from "../src/application/seed";
import { budgetTotals, evaluateHealth, riskBand, riskExposure } from "../src/domain/health";

const now = new Date("2026-08-25T16:00:00.000Z");

describe("health rules", () => {
  it("uses the published exposure bands", () => {
    expect(riskExposure(5, 5)).toBe(25);
    expect(riskBand(7)).toBe("low");
    expect(riskBand(8)).toBe("medium");
    expect(riskBand(15)).toBe("high");
  });

  it("attributes a red project to schedule, blocker, budget, and risk evidence", () => {
    const project = createSeed(now).projects.find((item) => item.id === "platform");
    expect(project).toBeDefined();
    const result = evaluateHealth(project!, now);
    expect(result.health).toBe("red");
    expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(["CRITICAL_SLIP", "CRITICAL_BLOCKER", "BUDGET_RED", "HIGH_RISK_OVERDUE", "RESOURCE_OVERLOAD"]));
  });

  it("returns green only when no exception applies", () => {
    const project = createSeed(now).projects.find((item) => item.id === "vendors")!;
    expect(evaluateHealth(project, now)).toEqual({ health: "green", reasons: [{ code: "ON_PLAN", severity: "green", label: "Within control limits", evidence: "No current schedule, budget, risk, or capacity exception." }] });
  });

  it("honors a current override and ignores an expired override", () => {
    const project = createSeed(now).projects.find((item) => item.id === "platform")!;
    project.manualOverride = { health: "green", reason: "Sponsor-approved recovery window.", expiresAt: "2026-08-26T00:00:00.000Z" };
    expect(evaluateHealth(project, now).reasons[0]?.code).toBe("MANUAL_OVERRIDE");
    project.manualOverride.expiresAt = "2026-08-24T00:00:00.000Z";
    expect(evaluateHealth(project, now).health).toBe("red");
  });

  it("totals all financial control fields", () => {
    const project = createSeed(now).projects.find((item) => item.id === "hub")!;
    const totals = budgetTotals(project);
    expect(totals.baseline).toBeGreaterThan(900_000);
    expect(totals.forecast).toBeGreaterThan(totals.baseline);
    expect(totals.committed).toBeGreaterThan(0);
    expect(totals.actual).toBeGreaterThan(0);
  });
});
