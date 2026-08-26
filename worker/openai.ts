import type { CopilotProvider } from "../src/application/contracts";
import type { CopilotAction, CopilotProposal, Project } from "../src/domain/model";

interface ResponseBody {
  model?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

export class OpenAICopilotProvider implements CopilotProvider {
  readonly name = "openai" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async propose(action: CopilotAction, project: Project, input: string, now: Date): Promise<CopilotProposal> {
    const evidence = boundedEvidence(project);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        store: false,
        max_output_tokens: 1200,
        instructions: "You are a project controls advisor. Use only supplied synthetic records. Never claim a fact without an evidence citation. Return proposals only; never imply that data has been changed. Keep language direct and operational.",
        input: JSON.stringify({ action, userContext: input.slice(0, 4000), project: evidence }),
        text: { format: { type: "json_schema", name: "control_room_proposal", strict: true, schema: proposalSchema } },
      }),
    });
    const body = await response.json<ResponseBody>();
    if (!response.ok) throw new Error(body.error?.message ?? "OpenAI could not produce a proposal.");
    const raw = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!raw) throw new Error("OpenAI returned no structured proposal.");
    const parsed = JSON.parse(raw) as Omit<CopilotProposal, "id" | "action" | "provider" | "status" | "createdAt">;
    return { ...parsed, id: crypto.randomUUID(), action, provider: "openai", status: "proposed", createdAt: now.toISOString(), model: body.model ?? this.model, usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 } };
  }
}

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "confidence", "warnings", "citations", "changes"],
  properties: {
    title: { type: "string", maxLength: 160 }, summary: { type: "string", maxLength: 1200 }, confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: { type: "array", maxItems: 5, items: { type: "string", maxLength: 300 } },
    citations: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["label", "entityType", "entityId"], properties: { label: { type: "string" }, entityType: { type: "string" }, entityId: { type: "string" } } } },
    changes: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["entityType", "entityId", "operation", "preview", "payload"], properties: { entityType: { type: "string", enum: ["work_item", "decision", "risk", "message", "report"] }, entityId: { type: "string" }, operation: { type: "string", enum: ["create", "refresh"] }, preview: { type: "string", maxLength: 400 }, payload: { type: "object", additionalProperties: { type: ["string", "number", "boolean", "null"] } } } } },
  },
} as const;

function boundedEvidence(project: Project) {
  return { id: project.id, code: project.code, name: project.name, objective: project.objective, stage: project.stage, health: project.health, healthReasons: project.healthReasons.slice(0, 8), milestones: project.milestones.slice(0, 20), workItems: project.workItems.slice(0, 30), raid: project.raid.slice(0, 30), decisions: project.decisions.slice(0, 20), budget: project.budget.slice(0, 30), allocations: project.allocations.slice(0, 20), changes: project.changes.slice(0, 20), updates: project.updates.slice(0, 12) };
}

export async function reserveOwnerRun(db: D1Database, login: string) {
  const date = new Date().toISOString().slice(0, 10);
  await db.prepare("INSERT OR IGNORE INTO ai_usage (github_login, usage_date, runs, input_tokens, output_tokens) VALUES (?, ?, 0, 0, 0)").bind(login, date).run();
  const reserved = await db.prepare("UPDATE ai_usage SET runs = runs + 1 WHERE github_login = ? AND usage_date = ? AND runs < 20 RETURNING runs").bind(login, date).first<{ runs: number }>();
  return reserved ? { date, runs: reserved.runs } : null;
}

export async function recordOwnerUsage(db: D1Database, login: string, date: string, proposal: CopilotProposal) {
  await db.prepare("UPDATE ai_usage SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ? WHERE github_login = ? AND usage_date = ?").bind(proposal.usage?.inputTokens ?? 0, proposal.usage?.outputTokens ?? 0, login, date).run();
}

export async function releaseOwnerRun(db: D1Database, login: string, date: string) {
  await db.prepare("UPDATE ai_usage SET runs = MAX(0, runs - 1) WHERE github_login = ? AND usage_date = ?").bind(login, date).run();
}
