import { describe, expect, it } from "vitest";
import { createSeed } from "../src/application/seed";
import { DemoCopilotProvider } from "../worker/copilot";
import type { CopilotAction } from "../src/domain/model";

describe("deterministic copilot provider", () => {
  const now = new Date("2026-08-25T16:00:00.000Z");
  const project = createSeed(now).projects.find((item) => item.id === "platform")!;
  const provider = new DemoCopilotProvider();

  it.each<CopilotAction>(["plan", "risk_scan", "meeting_extract", "change_impact", "status_report", "what_changed", "resource_scan", "message_draft", "ask"])("produces an evidence-backed %s proposal", async (action) => {
    const proposal = await provider.propose(action, structuredClone(project), "Review the current record", now);
    expect(proposal.provider).toBe("demo-rules-v1");
    expect(proposal.status).toBe("proposed");
    expect(proposal.citations.length).toBeGreaterThan(0);
    expect(proposal.warnings.join(" ")).toMatch(/Demo rules/);
    expect(proposal.summary.length).toBeGreaterThan(10);
  });

  it("adapts capacity findings to changed allocations", async () => {
    const clear = structuredClone(project);
    clear.allocations = clear.allocations.map((allocation) => ({ ...allocation, percent: 80 }));
    const proposal = await provider.propose("resource_scan", clear, "", now);
    expect(proposal.title).toMatch(/No capacity exception/);
  });
});
