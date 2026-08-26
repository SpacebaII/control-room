import { z } from "zod";

export const milestoneSchema = z.object({
  version: z.number().int().positive(),
  forecastDate: z.iso.datetime().optional(),
  status: z.enum(["not_started", "in_progress", "complete"]).optional(),
}).refine((value) => value.forecastDate || value.status, "Supply a forecast date or status.");

export const workSchema = z.object({ version: z.number().int().positive(), status: z.enum(["backlog", "ready", "in_progress", "blocked", "done"]), blocker: z.string().trim().max(300).optional() });
export const raidSchema = z.object({ version: z.number().int().positive(), status: z.enum(["identified", "assessed", "responding", "monitoring", "closed"]), response: z.string().trim().min(5).max(600), dueDate: z.iso.datetime() });
export const budgetSchema = z.object({ version: z.number().int().positive(), forecast: z.number().int().min(0).max(20_000_000) });
export const allocationSchema = z.object({ version: z.number().int().positive(), percent: z.number().int().min(0).max(130) });
export const registeredDecisionSchema = z.object({ version: z.number().int().positive(), status: z.enum(["approved", "rejected"]), rationale: z.string().trim().min(5).max(1200) });
export const updateSchema = z.object({ version: z.number().int().positive(), text: z.string().trim().min(3).max(1200) });
export const changeSchema = z.object({ version: z.number().int().positive(), title: z.string().trim().min(5).max(140), ownerId: z.string().min(2).max(40), scheduleImpactDays: z.number().int().min(-365).max(365), budgetImpact: z.number().int().min(-5_000_000).max(5_000_000), riskImpact: z.string().trim().min(5).max(600), rationale: z.string().trim().min(5).max(1200), decisionNote: z.string().max(600).optional() });
export const decisionSchema = z.object({ version: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().min(5).max(600) });
export const versionSchema = z.object({ version: z.number().int().positive() });
export const messageSchema = z.object({ projectId: z.string().min(2).max(40), channel: z.enum(["slack", "teams", "email"]), audience: z.string().trim().min(2).max(120), subject: z.string().trim().max(160).optional(), body: z.string().trim().min(5).max(2400) });
export const reportStatusSchema = z.object({ status: z.enum(["draft", "review", "approved", "published"]) });
export const copilotSchema = z.object({ projectId: z.string().min(2).max(40), action: z.enum(["plan", "risk_scan", "meeting_extract", "change_impact", "status_report", "what_changed", "resource_scan", "message_draft", "ask"]), input: z.string().trim().max(4000).default(""), mode: z.enum(["demo", "live"]).default("demo") });
export const copilotDecisionSchema = z.object({ projectId: z.string().min(2).max(40), version: z.number().int().positive(), selectedIds: z.array(z.string().min(1).max(100)).max(10).optional() });
