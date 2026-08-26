import type { SeedData } from "../src/application/seed";
import type { Actor, AuditEvent, CopilotProposal, FileRecord, Message, Notification, Portfolio, Project, Report } from "../src/domain/model";

interface WorkspaceRow { id: string; organization_name: string; program_name: string; expires_at: string }
interface DataRow { data: string }
interface ProjectRow extends DataRow { version: number }

export class VersionConflictError extends Error {
  constructor(readonly current: Project) {
    super("The project changed after it was loaded.");
  }
}

export class D1ControlRoomRepository {
  constructor(private readonly db: D1Database | D1DatabaseSession) {}

  async workspaceExists(id: string): Promise<boolean> {
    return Boolean(await this.db.prepare("SELECT id FROM workspaces WHERE id = ? AND expires_at > ?").bind(id, new Date().toISOString()).first());
  }

  async createWorkspace(id: string, seed: SeedData, now: Date): Promise<void> {
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await this.db.batch([
      this.db.prepare("INSERT INTO workspaces (id, organization_name, program_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(id, "Horizon Service Group", "Mountain West Regional Launch", now.toISOString(), expires),
      ...this.seedStatements(id, seed),
    ]);
    await this.waitForSeed(id, seed);
  }

  async resetWorkspace(id: string, seed: SeedData): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM actors WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM projects WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM messages WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM notifications WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM reports WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM files WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM copilot_runs WHERE workspace_id = ?").bind(id),
      this.db.prepare("DELETE FROM audit_events WHERE workspace_id = ?").bind(id),
      this.db.prepare("UPDATE workspaces SET reset_count = reset_count + 1, expires_at = ? WHERE id = ?").bind(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), id),
      ...this.seedStatements(id, seed),
    ]);
    await this.waitForSeed(id, seed);
  }

  private async waitForSeed(workspaceId: string, seed: SeedData): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const counts = await this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM actors WHERE workspace_id = ?) AS actors,
          (SELECT COUNT(*) FROM projects WHERE workspace_id = ?) AS projects
      `).bind(workspaceId, workspaceId).first<{ actors: number; projects: number }>();
      if (counts?.actors === seed.actors.length && counts.projects === seed.projects.length) return;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
    throw new Error("Workspace seed was not fully visible after creation.");
  }

  private seedStatements(workspaceId: string, seed: SeedData): D1PreparedStatement[] {
    return [
      ...seed.actors.map((actor) => this.db.prepare("INSERT INTO actors (id, workspace_id, name, role, title, data) VALUES (?, ?, ?, ?, ?, ?)").bind(actor.id, workspaceId, actor.name, actor.role, actor.title, JSON.stringify(actor))),
      ...seed.projects.map((project) => this.db.prepare("INSERT INTO projects (id, workspace_id, name, health, version, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(project.id, workspaceId, project.name, project.health, project.version, project.updatedAt, JSON.stringify(project))),
      ...seed.messages.map((message) => this.messageStatement(workspaceId, message)),
      ...seed.notifications.map((notification) => this.notificationStatement(workspaceId, notification)),
      ...seed.reports.map((report) => this.reportStatement(workspaceId, report)),
      ...seed.files.map((file) => this.db.prepare("INSERT INTO files (id, workspace_id, project_id, filename, content_type, asset_path, data) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(file.id, workspaceId, file.projectId ?? null, file.filename, file.contentType, file.assetPath, JSON.stringify(file))),
      ...seed.audit.map((event) => this.auditStatement(workspaceId, event)),
    ];
  }

  async portfolio(workspaceId: string, currentActorId: string): Promise<Portfolio> {
    const [workspace, actors, projects, messages, notifications, reports, files, audit] = await Promise.all([
      this.db.prepare("SELECT id, organization_name, program_name, expires_at FROM workspaces WHERE id = ?").bind(workspaceId).first<WorkspaceRow>(),
      this.db.prepare("SELECT data FROM actors WHERE workspace_id = ? ORDER BY rowid").bind(workspaceId).all<DataRow>(),
      this.db.prepare("SELECT data, version FROM projects WHERE workspace_id = ? ORDER BY rowid").bind(workspaceId).all<ProjectRow>(),
      this.db.prepare("SELECT data FROM messages WHERE workspace_id = ? ORDER BY created_at DESC").bind(workspaceId).all<DataRow>(),
      this.db.prepare("SELECT data FROM notifications WHERE workspace_id = ? AND actor_id = ? ORDER BY created_at DESC").bind(workspaceId, currentActorId).all<DataRow>(),
      this.db.prepare("SELECT data FROM reports WHERE workspace_id = ? ORDER BY updated_at DESC").bind(workspaceId).all<DataRow>(),
      this.db.prepare("SELECT data FROM files WHERE workspace_id = ? ORDER BY rowid").bind(workspaceId).all<DataRow>(),
      this.db.prepare("SELECT id, actor_id, project_id, entity_type, entity_id, action, detail, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100").bind(workspaceId).all<{
        id: string; actor_id: string; project_id: string | null; entity_type: string; entity_id: string; action: string; detail: string; created_at: string;
      }>(),
    ]);
    if (!workspace) throw new Error("Workspace not found.");
    return {
      workspaceId, organization: workspace.organization_name, program: workspace.program_name, expiresAt: workspace.expires_at, currentActorId,
      actors: actors.results.map((row) => JSON.parse(row.data) as Actor),
      projects: projects.results.map((row) => ({ ...(JSON.parse(row.data) as Project), version: row.version })),
      messages: messages.results.map((row) => JSON.parse(row.data) as Message),
      notifications: notifications.results.map((row) => JSON.parse(row.data) as Notification),
      reports: reports.results.map((row) => JSON.parse(row.data) as Report),
      files: files.results.map((row) => JSON.parse(row.data) as FileRecord),
      audit: audit.results.map((row) => ({ id: row.id, actorId: row.actor_id, projectId: row.project_id ?? undefined, entityType: row.entity_type, entityId: row.entity_id, action: row.action, detail: row.detail, createdAt: row.created_at })),
    };
  }

  async actors(workspaceId: string): Promise<Actor[]> {
    const result = await this.db.prepare("SELECT data FROM actors WHERE workspace_id = ?").bind(workspaceId).all<DataRow>();
    return result.results.map((row) => JSON.parse(row.data) as Actor);
  }

  async project(workspaceId: string, id: string): Promise<Project | null> {
    const row = await this.db.prepare("SELECT data, version FROM projects WHERE workspace_id = ? AND id = ?").bind(workspaceId, id).first<ProjectRow>();
    return row ? { ...(JSON.parse(row.data) as Project), version: row.version } : null;
  }

  async saveProject(workspaceId: string, project: Project, expectedVersion: number): Promise<Project> {
    const next = { ...project, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
    const result = await this.db.prepare("UPDATE projects SET name = ?, health = ?, version = ?, updated_at = ?, data = ? WHERE workspace_id = ? AND id = ? AND version = ?")
      .bind(next.name, next.health, next.version, next.updatedAt, JSON.stringify(next), workspaceId, next.id, expectedVersion).run();
    if (result.meta.changes !== 1) {
      const current = await this.project(workspaceId, project.id);
      if (!current) throw new Error("Project not found.");
      throw new VersionConflictError(current);
    }
    return next;
  }

  async saveMessage(workspaceId: string, message: Message): Promise<void> {
    await this.messageStatement(workspaceId, message).run();
  }

  async message(workspaceId: string, id: string): Promise<Message | null> {
    const row = await this.db.prepare("SELECT data FROM messages WHERE workspace_id = ? AND id = ?").bind(workspaceId, id).first<DataRow>();
    return row ? JSON.parse(row.data) as Message : null;
  }

  async updateMessage(workspaceId: string, message: Message): Promise<void> {
    await this.db.prepare("UPDATE messages SET status = ?, data = ? WHERE workspace_id = ? AND id = ?").bind(message.status, JSON.stringify(message), workspaceId, message.id).run();
  }

  async saveNotification(workspaceId: string, notification: Notification): Promise<void> {
    await this.notificationStatement(workspaceId, notification).run();
  }

  async report(workspaceId: string, id: string): Promise<Report | null> {
    const row = await this.db.prepare("SELECT data FROM reports WHERE workspace_id = ? AND id = ?").bind(workspaceId, id).first<DataRow>();
    return row ? JSON.parse(row.data) as Report : null;
  }

  async file(workspaceId: string, id: string): Promise<FileRecord | null> {
    const row = await this.db.prepare("SELECT data FROM files WHERE workspace_id = ? AND id = ?").bind(workspaceId, id).first<DataRow>();
    return row ? JSON.parse(row.data) as FileRecord : null;
  }

  async saveReport(workspaceId: string, report: Report): Promise<void> {
    await this.db.prepare("INSERT INTO reports (id, workspace_id, project_id, status, version, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, id) DO UPDATE SET status = excluded.status, version = excluded.version, updated_at = excluded.updated_at, data = excluded.data")
      .bind(report.id, workspaceId, report.projectId, report.status, report.version, report.updatedAt, JSON.stringify(report)).run();
  }

  async saveCopilot(workspaceId: string, actorId: string, proposal: CopilotProposal): Promise<void> {
    await this.db.prepare("INSERT INTO copilot_runs (id, workspace_id, actor_id, provider, action, status, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(proposal.id, workspaceId, actorId, proposal.provider, proposal.action, proposal.status, proposal.createdAt, JSON.stringify(proposal)).run();
  }

  async copilot(workspaceId: string, id: string): Promise<CopilotProposal | null> {
    const row = await this.db.prepare("SELECT data FROM copilot_runs WHERE workspace_id = ? AND id = ?").bind(workspaceId, id).first<DataRow>();
    return row ? JSON.parse(row.data) as CopilotProposal : null;
  }

  async updateCopilot(workspaceId: string, proposal: CopilotProposal): Promise<void> {
    await this.db.prepare("UPDATE copilot_runs SET status = ?, data = ? WHERE workspace_id = ? AND id = ?").bind(proposal.status, JSON.stringify(proposal), workspaceId, proposal.id).run();
  }

  async audit(workspaceId: string, event: AuditEvent): Promise<void> {
    await this.auditStatement(workspaceId, event).run();
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.db.prepare("DELETE FROM workspaces WHERE expires_at <= ?").bind(now.toISOString()).run();
    return result.meta.changes;
  }

  private messageStatement(workspaceId: string, message: Message) {
    return this.db.prepare("INSERT INTO messages (id, workspace_id, project_id, channel, status, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(message.id, workspaceId, message.projectId, message.channel, message.status, message.createdAt, JSON.stringify(message));
  }

  private notificationStatement(workspaceId: string, notification: Notification) {
    return this.db.prepare("INSERT INTO notifications (id, workspace_id, actor_id, read_at, created_at, data) VALUES (?, ?, ?, ?, ?, ?)").bind(notification.id, workspaceId, notification.actorId, notification.readAt ?? null, notification.createdAt, JSON.stringify(notification));
  }

  private reportStatement(workspaceId: string, report: Report) {
    return this.db.prepare("INSERT INTO reports (id, workspace_id, project_id, status, version, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(report.id, workspaceId, report.projectId, report.status, report.version, report.updatedAt, JSON.stringify(report));
  }

  private auditStatement(workspaceId: string, event: AuditEvent) {
    return this.db.prepare("INSERT INTO audit_events (id, workspace_id, actor_id, project_id, entity_type, entity_id, action, created_at, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(event.id, workspaceId, event.actorId, event.projectId ?? null, event.entityType, event.entityId, event.action, event.createdAt, event.detail);
  }
}
