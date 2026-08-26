import { createSeed } from "../src/application/seed";
import { ApplicationError, ControlRoomService } from "../src/application/service";
import type { Portfolio, Project, Report } from "../src/domain/model";
import { handleAuth, readOwner } from "./auth";
import { DemoCopilotProvider } from "./copilot";
import { OpenAICopilotProvider, recordOwnerUsage, releaseOwnerRun, reserveOwnerRun } from "./openai";
import { D1ControlRoomRepository, VersionConflictError } from "./repository";
import { allocationSchema, budgetSchema, changeSchema, copilotDecisionSchema, copilotSchema, decisionSchema, messageSchema, milestoneSchema, raidSchema, registeredDecisionSchema, reportStatusSchema, updateSchema, versionSchema, workSchema } from "./schemas";
import { createWorkspaceCookie, currentActor, readWorkspaceCookie } from "./session";

const API_PREFIX = "/api/v1";
const MAX_BODY = 64 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const correlationId = crypto.randomUUID();
    const url = new URL(request.url);
    if (!url.pathname.startsWith(API_PREFIX) && !url.pathname.startsWith("/auth/")) return env.ASSETS.fetch(request);
    try {
      if (url.pathname.startsWith("/auth/")) return secure(await handleAuth(request, url, env), correlationId);
      if (request.method !== "GET" && request.method !== "HEAD") verifyOrigin(request, env);
      // Pin every request to a D1 session so newly seeded data is visible to
      // the reads and mutations that follow in the same workflow.
      const repository = new D1ControlRoomRepository(env.DB.withSession("first-primary"));
      const { workspaceId, setCookie } = await ensureWorkspace(request, env, repository);
      const actorId = currentActor(request);
      const service = new ControlRoomService(repository, new DemoCopilotProvider());
      const response = await route(request, url, workspaceId, actorId, service, repository, env);
      return secure(response, correlationId, setCookie);
    } catch (error) {
      if (error instanceof VersionConflictError) return secure(json({ error: { code: "VERSION_CONFLICT", message: error.message }, current: error.current }, 409), correlationId);
      if (error instanceof ApplicationError) return secure(json({ error: { code: error.code, message: error.message } }, error.status), correlationId);
      if (error instanceof SyntaxError) return secure(json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON." } }, 400), correlationId);
      console.error(JSON.stringify({ level: "error", correlationId, message: error instanceof Error ? error.message : "Unknown error", path: url.pathname }));
      return secure(json({ error: { code: "INTERNAL_ERROR", message: "Control Room could not complete the request." } }, 500), correlationId);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env) {
    const deleted = await new D1ControlRoomRepository(env.DB.withSession("first-primary")).deleteExpired(new Date());
    console.log(JSON.stringify({ event: "workspace_cleanup", deleted }));
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, url: URL, workspaceId: string, actorId: string, service: ControlRoomService, repository: D1ControlRoomRepository, env: Env): Promise<Response> {
  const path = url.pathname.slice(API_PREFIX.length);
  if (request.method === "GET" && (path === "/portfolio" || path === "/demo/session")) return json(await service.portfolio(workspaceId, actorId));
  if (request.method === "POST" && path === "/demo/reset") {
    await repository.resetWorkspace(workspaceId, createSeed());
    return json(await service.portfolio(workspaceId, actorId));
  }

  let match = path.match(/^\/projects\/([^/]+)\/milestones\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.updateMilestone(workspaceId, actorId, match[1], match[2], milestoneSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/work\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.updateWorkItem(workspaceId, actorId, match[1], match[2], workSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/raid\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.updateRisk(workspaceId, actorId, match[1], match[2], raidSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/budget\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.updateBudget(workspaceId, actorId, match[1], match[2], budgetSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/team\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.updateAllocation(workspaceId, actorId, match[1], match[2], allocationSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/decisions\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.decideRegisteredDecision(workspaceId, actorId, match[1], match[2], registeredDecisionSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/updates$/);
  if (request.method === "POST" && match) return json(await service.addUpdate(workspaceId, actorId, match[1], updateSchema.parse(await body(request))), 201);
  match = path.match(/^\/projects\/([^/]+)\/changes$/);
  if (request.method === "POST" && match) return json(await service.createChange(workspaceId, actorId, match[1], changeSchema.parse(await body(request))), 201);
  match = path.match(/^\/projects\/([^/]+)\/changes\/([^/]+)\/decision$/);
  if (request.method === "POST" && match) return json(await service.decideChange(workspaceId, actorId, match[1], match[2], decisionSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/changes\/([^/]+)\/implement$/);
  if (request.method === "POST" && match) return json(await service.implementChange(workspaceId, actorId, match[1], match[2], versionSchema.parse(await body(request))));
  match = path.match(/^\/projects\/([^/]+)\/reports\/generate$/);
  if (request.method === "POST" && match) return json(await service.generateReport(workspaceId, actorId, match[1]));

  if (request.method === "POST" && path === "/messages") return json(await service.previewMessage(workspaceId, actorId, messageSchema.parse(await body(request))), 201);
  match = path.match(/^\/messages\/([^/]+)\/deliver$/);
  if (request.method === "POST" && match) return json(await service.deliverMessage(workspaceId, actorId, match[1]));
  match = path.match(/^\/reports\/([^/]+)$/);
  if (request.method === "PATCH" && match) return json(await service.setReportStatus(workspaceId, actorId, match[1], reportStatusSchema.parse(await body(request)).status));
  match = path.match(/^\/reports\/([^/]+)\/print$/);
  if (request.method === "GET" && match) {
    const report = await repository.report(workspaceId, match[1]);
    if (!report) throw new ApplicationError("NOT_FOUND", "Report not found.", 404);
    const project = await repository.project(workspaceId, report.projectId);
    if (!project) throw new ApplicationError("NOT_FOUND", "Project not found.", 404);
    return html(printReport(report, project));
  }

  if (request.method === "POST" && path === "/copilot/runs") {
    const input = copilotSchema.parse(await body(request));
    if (input.mode === "demo") return json(await service.runCopilot(workspaceId, actorId, input.projectId, input.action, input.input), 201);
    const owner = await readOwner(request, env);
    if (!owner) throw new ApplicationError("OWNER_AUTH_REQUIRED", "Live assistance requires the allowlisted GitHub owner session.", 401);
    const reservation = await reserveOwnerRun(env.DB, owner.login);
    if (!reservation) throw new ApplicationError("DAILY_AI_LIMIT", "The owner account has reached the 20-run UTC daily limit.", 429);
    try {
      const liveService = new ControlRoomService(repository, new OpenAICopilotProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL));
      const proposal = await liveService.runCopilot(workspaceId, actorId, input.projectId, input.action, input.input);
      await recordOwnerUsage(env.DB, owner.login, reservation.date, proposal);
      return json(proposal, 201);
    } catch (error) {
      await releaseOwnerRun(env.DB, owner.login, reservation.date);
      throw error;
    }
  }
  match = path.match(/^\/copilot\/runs\/([^/]+)\/apply$/);
  if (request.method === "POST" && match) {
    const input = copilotDecisionSchema.parse(await body(request));
    return json(await service.applyCopilot(workspaceId, actorId, input.projectId, match[1], input.version, input.selectedIds));
  }
  match = path.match(/^\/copilot\/runs\/([^/]+)\/reject$/);
  if (request.method === "POST" && match) return json(await service.rejectCopilot(workspaceId, actorId, match[1]));

  match = path.match(/^\/files\/([^/]+)\/download$/);
  if (request.method === "GET" && match) {
    const file = await repository.file(workspaceId, match[1]);
    if (!file) throw new ApplicationError("NOT_FOUND", "File not found.", 404);
    const asset = await env.ASSETS.fetch(new URL(file.assetPath, request.url));
    const headers = new Headers(asset.headers);
    headers.set("Content-Disposition", `attachment; filename="${file.filename.replaceAll('"', "")}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(asset.body, { status: asset.status, headers });
  }

  match = path.match(/^\/exports\/(raid|budget|decisions)\.csv$/);
  if (request.method === "GET" && match) {
    const portfolio = await service.portfolio(workspaceId, actorId);
    return csv(exportRows(portfolio, match[1] as "raid" | "budget" | "decisions"), `${match[1]}-export.csv`);
  }

  throw new ApplicationError("NOT_FOUND", "Route not found.", 404);
}

async function ensureWorkspace(request: Request, env: Env, repository: D1ControlRoomRepository) {
  let workspaceId = await readWorkspaceCookie(request, env.SESSION_SIGNING_SECRET);
  let setCookie: string | undefined;
  if (!workspaceId || !await repository.workspaceExists(workspaceId)) {
    workspaceId = crypto.randomUUID();
    await repository.createWorkspace(workspaceId, createSeed(), new Date());
    setCookie = await createWorkspaceCookie(workspaceId, env.SESSION_SIGNING_SECRET, new URL(request.url).protocol === "https:");
  }
  return { workspaceId, setCookie };
}

async function body(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY) throw new ApplicationError("PAYLOAD_TOO_LARGE", "Request body exceeds 64 KB.", 413);
  return request.json();
}

function verifyOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin && origin !== env.APP_ORIGIN) throw new ApplicationError("ORIGIN_REJECTED", "Cross-origin mutation rejected.", 403);
}

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function html(value: string) { return new Response(value, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }); }
function csv(value: string, filename: string) { return new Response(value, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } }); }

function secure(response: Response, correlationId: string, cookie?: string) {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Correlation-ID", correlationId);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (cookie) secured.headers.append("Set-Cookie", cookie);
  return secured;
}

function exportRows(portfolio: Portfolio, resource: "raid" | "budget" | "decisions") {
  const rows: string[][] = resource === "raid"
    ? [["Project", "Type", "Title", "Owner", "Exposure", "Status", "Due", "Response"], ...portfolio.projects.flatMap((project) => project.raid.map((item) => [project.name, item.type, item.title, item.ownerId, String(item.probability * item.impact), item.status, item.dueDate, item.response]))]
    : resource === "budget"
      ? [["Project", "Category", "Vendor", "Baseline", "Actual", "Committed", "Forecast"], ...portfolio.projects.flatMap((project) => project.budget.map((item) => [project.name, item.category, item.vendor, String(item.baseline), String(item.actual), String(item.committed), String(item.forecast)]))]
      : [["Project", "Decision", "Status", "Owner", "Approver", "Rationale", "Impact"], ...portfolio.projects.flatMap((project) => project.decisions.map((item) => [project.name, item.title, item.status, item.ownerId, item.approverId, item.rationale, item.impact]))];
  return rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
}

function printReport(report: Report, project: Project) {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const list = (items: string[]) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("") || "<li>None recorded.</li>"}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(project.name)} status brief</title><style>body{font:14px/1.5 Arial,sans-serif;color:#202421;max-width:900px;margin:40px auto}h1,h2{font-family:Georgia,serif}header{border-bottom:3px solid #202421;padding-bottom:20px}.health{text-transform:uppercase;font-weight:700}section{border-bottom:1px solid #aaa;padding:16px 0}@media print{body{margin:0}}</style></head><body><header><small>HORIZON SERVICE GROUP / ${escape(report.period)}</small><h1>${escape(project.name)}</h1><p class="health">${project.health} / ${escape(report.headline)}</p></header><section><h2>Executive summary</h2><p>${escape(report.summary)}</p></section><section><h2>Completed</h2>${list(report.accomplishments)}</section><section><h2>Next</h2>${list(report.next)}</section><section><h2>Decisions needed</h2>${list(report.decisionsNeeded)}</section><footer><p>Generated from Control Room evidence. Synthetic portfolio demonstration.</p></footer></body></html>`;
}
