import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import { api, ApiError, setApiActor } from "./api";
import type { AuthSession } from "./api";
import { budgetTotals, riskBand, riskExposure } from "./domain/health";
import type { Actor, Channel, CopilotAction, CopilotProposal, Message, Portfolio, Project, Report, WorkStatus } from "./domain/model";
import { BudgetWaterfall, DependencyMap, HealthMark, MilestoneLane, ResourceHeatmap, RiskMatrix } from "./components/Visuals";
import { actorName, currency, exposureLabel, shortDate } from "./components/format";

type Runner = <T>(task: () => Promise<T>, refresh?: boolean) => Promise<T | undefined>;

export function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [actorId, setActorId] = useState(() => sessionStorage.getItem("control-room-actor") ?? "alex");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mobile = useMedia("(max-width: 820px)");

  async function load(nextActor = actorId) {
    setApiActor(nextActor);
    try { setPortfolio(await api.portfolio()); setError(""); }
    catch (cause) { setError(message(cause)); }
  }

  useEffect(() => {
    setApiActor(actorId);
    let active = true;
    void api.portfolio().then(
      (next) => { if (active) { setPortfolio(next); setError(""); } },
      (cause: unknown) => { if (active) setError(message(cause)); },
    );
    return () => { active = false; };
  }, [actorId]);

  const run: Runner = async (task, refresh = true) => {
    setBusy(true); setError("");
    try { const result = await task(); if (refresh) await load(); return result; }
    catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError && cause.current) await load();
      return undefined;
    } finally { setBusy(false); }
  };

  function switchActor(id: string) { sessionStorage.setItem("control-room-actor", id); setApiActor(id); setActorId(id); }
  if (!portfolio) return <div className="boot-screen"><div className="brand-seal">CR</div><p>{error || "Opening an isolated program workspace…"}</p></div>;
  const actor = portfolio.actors.find((item) => item.id === actorId) ?? portfolio.actors[0];

  return <div className="app-shell">
    <Header portfolio={portfolio} actor={actor} busy={busy} onActor={switchActor} onReset={() => void run(api.reset)} />
    <DesktopRail portfolio={portfolio} />
    <main className="app-main" id="main-content">
      {error && <div className="error-banner" role="alert"><strong>Action not completed</strong><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      <Routes>
        <Route path="/" element={mobile ? <Today portfolio={portfolio} actor={actor} run={run} /> : <PortfolioView portfolio={portfolio} actor={actor} />} />
        <Route path="/today" element={<Today portfolio={portfolio} actor={actor} run={run} />} />
        <Route path="/projects/:projectId/:section?" element={<ProjectRoute portfolio={portfolio} actor={actor} run={run} busy={busy} />} />
        <Route path="/inbox" element={<Inbox portfolio={portfolio} run={run} />} />
        <Route path="/files" element={<Files portfolio={portfolio} />} />
        <Route path="/reports" element={<Reports portfolio={portfolio} actor={actor} run={run} />} />
        <Route path="/copilot" element={<Copilot portfolio={portfolio} run={run} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <MobileNav />
  </div>;
}

function Header({ portfolio, actor, busy, onActor, onReset }: { portfolio: Portfolio; actor: Actor; busy: boolean; onActor: (id: string) => void; onReset: () => void }) {
  return <header className="topbar">
    <Link to="/" className="wordmark" aria-label="Control Room portfolio"><span className="brand-seal"><Icon name="mark" /></span><span><strong>Control Room</strong><small>Program operations</small></span></Link>
    <div className="program-context"><span className="context-mark"><Icon name="program" /></span><span><small>{portfolio.organization}</small><strong>{portfolio.program}</strong></span><Icon name="chevron" /></div>
    <div className="header-tools">
      <span className="demo-state"><i /> Private demo</span>
      <button className="icon-button" aria-label="Reset workspace" title="Reset workspace" onClick={onReset} disabled={busy}><Icon name="reset" /></button>
      <label className="persona-control"><span className="person-monogram">{actor.initials}</span><span className="persona-copy"><small>Working as</small><strong className="persona-full">{actor.name}</strong><strong className="persona-short">{actor.name.split(" ")[0]}</strong></span><select aria-label="Acting as" value={actor.id} onChange={(event) => onActor(event.target.value)} disabled={busy}>{portfolio.actors.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.title}</option>)}</select><Icon name="chevron" /></label>
    </div>
  </header>;
}

function DesktopRail({ portfolio }: { portfolio: Portfolio }) {
  const nav: Array<[string, IconName, string]> = [["/", "portfolio", "Overview"], ["/projects/platform/overview", "projects", "Projects"], ["/inbox", "inbox", "Inbox"], ["/files", "files", "Files"], ["/reports", "reports", "Reports"], ["/copilot", "copilot", "Copilot"]];
  const unread = portfolio.notifications.filter((item) => !item.readAt).length;
  return <aside className="desktop-rail"><nav aria-label="Primary navigation"><p>Workspace</p>{nav.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === "/"}><Icon name={icon} /><span>{label}</span>{label === "Inbox" && unread > 0 && <b>{unread}</b>}</NavLink>)}</nav><div className="rail-note"><Icon name="shield" /><div><strong>Demo workspace</strong><small>Fictional data · expires {shortDate(portfolio.expiresAt)}</small></div></div></aside>;
}

function MobileNav() {
  return <nav className="mobile-nav" aria-label="Mobile navigation"><NavLink to="/today"><Icon name="today" /><span>Today</span></NavLink><NavLink to="/inbox"><Icon name="inbox" /><span>Inbox</span></NavLink><NavLink to="/files"><Icon name="files" /><span>Files</span></NavLink><NavLink to="/"><Icon name="more" /><span>More</span></NavLink></nav>;
}

function PortfolioView({ portfolio, actor }: { portfolio: Portfolio; actor: Actor }) {
  const totals = portfolio.projects.reduce((sum, project) => { const budget = budgetTotals(project); return { baseline: sum.baseline + budget.baseline, forecast: sum.forecast + budget.forecast }; }, { baseline: 0, forecast: 0 });
  const highRisks = portfolio.projects.flatMap((project) => project.raid).filter((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15).length;
  const pendingChanges = portfolio.projects.flatMap((project) => project.changes).filter((item) => item.status === "submitted").length;
  const attention = [
    ...portfolio.projects.flatMap((project) => project.changes.filter((item) => item.status === "submitted").map((item) => ({ project, id: item.id, kind: "Approval", title: item.title, detail: `${item.scheduleImpactDays} day schedule impact · ${currency(item.budgetImpact)}`, to: `/projects/${project.id}/changes`, tone: "amber" }))),
    ...portfolio.projects.flatMap((project) => project.raid.filter((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15).map((item) => ({ project, id: item.id, kind: "High risk", title: item.title, detail: `${actorName(portfolio.actors, item.ownerId)} · exposure ${riskExposure(item.probability, item.impact)}`, to: `/projects/${project.id}/raid`, tone: "red" }))),
  ];
  return <div className="page portfolio-page">
    <header className="workspace-heading"><div><p className="eyebrow">Tuesday, August 25</p><h1>Good morning, {actor.name.split(" ")[0]}.</h1><p>{attention.length} items need attention across the Mountain West launch.</p></div><div className="heading-actions"><Link className="button quiet" to="/reports"><Icon name="reports" /> Weekly reports</Link><Link className="button primary" to="/projects/platform/overview">Open critical project <Icon name="arrow" /></Link></div></header>
    <div className="command-grid">
      <section className="control-panel attention-command"><PanelHeader label="Needs attention" title="Decisions and delivery risks" meta={`${attention.length} open`} />
        {attention.slice(0, 4).map((item) => <Link to={item.to} className="command-row" key={item.id}><span className={`command-signal signal-${item.tone}`}><Icon name={item.kind === "Approval" ? "approval" : "risk"} /></span><div><span>{item.kind} · {item.project.code}</span><strong>{item.title}</strong><small>{item.detail}</small></div><Icon name="arrow" /></Link>)}
      </section>
      <aside className="program-pulse"><div className="pulse-heading"><span>Program pulse</span><HealthMark health="red" /></div><div className="pulse-metric"><span>Forecast at completion</span><strong>{currency(totals.forecast)}</strong><small className="negative">{currency(totals.forecast - totals.baseline)} above baseline</small></div><div className="pulse-pair"><div><span>High risks</span><strong>{highRisks}</strong><small>2 require action</small></div><div><span>Next gate</span><strong>31 days</strong><small>Operational readiness</small></div></div><Link to="/reports">View weekly position <Icon name="arrow" /></Link></aside>
    </div>
    <section className="metric-ledger" aria-label="Program summary">
      <Metric label="Portfolio baseline" value={currency(totals.baseline)} detail="Approved funding" />
      <Metric label="Schedule movement" value="+18 days" detail="Field platform driving variance" tone="rust" />
      <Metric label="Pending approvals" value={String(pendingChanges)} detail="Sponsor decision required" tone={pendingChanges ? "amber" : undefined} />
      <Metric label="Team capacity" value="1 conflict" detail="Technology lead at 115%" tone="amber" />
    </section>
    <div className="portfolio-grid">
      <section className="control-panel project-register"><PanelHeader label="Delivery portfolio" title="Projects" meta="Updated from current records" />
        <div className="register-head"><span>Project</span><span>Stage</span><span>Health evidence</span><span>Forecast</span></div>
        {portfolio.projects.map((project) => { const total = budgetTotals(project); return <Link to={`/projects/${project.id}/overview`} className="project-register-row" key={project.id}><div><code>{project.code}</code><strong>{project.name}</strong><small>{actorName(portfolio.actors, project.managerId)} / updated {shortDate(project.updatedAt)}</small></div><span>{project.stage}</span><div><HealthMark health={project.health} /><small>{project.healthReasons[0]?.label}</small></div><div><strong>{currency(total.forecast)}</strong><small>{total.forecast > total.baseline ? `${currency(total.forecast - total.baseline)} over` : "within baseline"}</small></div></Link>; })}
      </section>
      <section className="control-panel"><PanelHeader label="Dependencies" title="Cross-project flow" meta="4 active links" /><DependencyMap projects={portfolio.projects} /></section>
      <section className="control-panel"><PanelHeader label="Risk profile" title="Exposure concentration" meta={`${highRisks} high`} /><RiskMatrix project={mergeProjects(portfolio.projects)} /></section>
      <section className="control-panel"><PanelHeader label="Cost position" title="Baseline and forecast" meta={currency(totals.forecast)} /><BudgetWaterfall projects={portfolio.projects} /><div className="chart-key"><span><i className="key-baseline" />Baseline</span><span><i className="key-forecast" />Forecast</span></div></section>
    </div>
  </div>;
}

function Today({ portfolio, actor, run }: { portfolio: Portfolio; actor: Actor; run: Runner }) {
  const assignments = portfolio.projects.flatMap((project) => project.workItems.filter((item) => item.ownerId === actor.id && item.status !== "done").map((item) => ({ project, item }))).sort((a, b) => Date.parse(a.item.dueDate) - Date.parse(b.item.dueDate));
  const approvals = portfolio.projects.flatMap((project) => project.changes.filter((change) => change.status === "submitted").map((change) => ({ project, change })));
  return <div className="page mobile-first-page"><PageHeading eyebrow={`${actor.title} / ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`} title={`Good morning, ${actor.name.split(" ")[0]}.`} description="The items below require attention before the program can move cleanly." />
    <section className="pulse-strip">{portfolio.projects.map((project) => <Link key={project.id} to={`/projects/${project.id}/overview`}><HealthMark health={project.health} label={false} /><span>{project.code}</span><strong>{project.name}</strong><small>{project.healthReasons[0]?.label}</small></Link>)}</section>
    <div className="today-grid"><section className="control-panel"><PanelHeader label="My work" title="Due and blocked" meta={`${assignments.length} open`} />{assignments.length ? assignments.slice(0, 6).map(({ project, item }) => <div className="task-row" key={item.id}><div><code>{project.code}</code><strong>{item.title}</strong><small>{shortDate(item.dueDate)} / {item.status.replaceAll("_", " ")}</small></div><button className="text-button" onClick={() => void run(() => api.work(project.id, item.id, { version: project.version, status: item.status === "blocked" ? "in_progress" : "done" }))}>{item.status === "blocked" ? "Resume" : "Complete"}</button></div>) : <Empty text="No assigned work is waiting." />}</section>
      <section className="control-panel"><PanelHeader label="Approval queue" title="Decisions needed" meta={`${approvals.length} open`} />{approvals.map(({ project, change }) => <Link className="task-row" key={change.id} to={`/projects/${project.id}/changes`}><div><code>{project.code}</code><strong>{change.title}</strong><small>{change.scheduleImpactDays} days / {currency(change.budgetImpact)}</small></div><span>Review →</span></Link>)}</section>
      <section className="control-panel"><PanelHeader label="Inbox" title="Latest signals" meta={`${portfolio.notifications.length} items`} />{portfolio.notifications.slice(0, 5).map((item) => <Link className="notification-row" key={item.id} to={item.projectId ? `/projects/${item.projectId}/overview` : "/inbox"}><span>{item.kind}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></Link>)}</section>
    </div>
  </div>;
}

function ProjectRoute({ portfolio, actor, run, busy }: { portfolio: Portfolio; actor: Actor; run: Runner; busy: boolean }) {
  const { projectId, section = "overview" } = useParams();
  const project = portfolio.projects.find((item) => item.id === projectId);
  if (!project) return <Navigate to="/" replace />;
  return <ProjectWorkspace portfolio={portfolio} project={project} actor={actor} section={section} run={run} busy={busy} />;
}

const sections = ["overview", "plan", "raid", "decisions", "budget", "team", "changes", "reports", "comms", "activity"];

function ProjectWorkspace({ portfolio, project, actor, section, run, busy }: { portfolio: Portfolio; project: Project; actor: Actor; section: string; run: Runner; busy: boolean }) {
  const totals = budgetTotals(project);
  const scheduleVariance = Math.max(0, ...project.milestones.map((item) => Math.ceil((Date.parse(item.forecastDate) - Date.parse(item.baselineDate)) / 86_400_000)));
  const openHighRisks = project.raid.filter((item) => item.type === "risk" && item.status !== "closed" && riskExposure(item.probability, item.impact) >= 15).length;
  const nextMilestone = [...project.milestones].filter((item) => item.status !== "complete").sort((a, b) => Date.parse(a.forecastDate) - Date.parse(b.forecastDate))[0];
  return <div className="page project-page">
    <div className="project-heading"><div><p className="eyebrow">{project.code} · {project.stage}</p><h1>{project.name}</h1><p>{project.objective}</p></div><div className="project-state"><HealthMark health={project.health} /><small>Updated {shortDate(project.updatedAt)} · version {project.version}</small></div></div>
    <section className="project-snapshot" aria-label="Current project position"><div><span>Schedule</span><strong className={scheduleVariance > 14 ? "rust-text" : ""}>{scheduleVariance ? `+${scheduleVariance} days` : "On baseline"}</strong><small>Largest milestone movement</small></div><div><span>Forecast</span><strong>{currency(totals.forecast)}</strong><small className={totals.forecast > totals.baseline ? "rust-text" : ""}>{currency(totals.forecast - totals.baseline)} variance</small></div><div><span>High risks</span><strong>{openHighRisks}</strong><small>{openHighRisks ? "Action required" : "No high exposure"}</small></div><div><span>Next milestone</span><strong>{nextMilestone ? shortDate(nextMilestone.forecastDate) : "Complete"}</strong><small>{nextMilestone?.name ?? "All milestones complete"}</small></div></section>
    <nav className="section-tabs" aria-label="Project sections">{sections.map((item) => <NavLink key={item} to={`/projects/${project.id}/${item}`}>{item}</NavLink>)}</nav>
    {section === "overview" && <ProjectOverview portfolio={portfolio} project={project} run={run} />}
    {section === "plan" && <Plan project={project} actors={portfolio.actors} run={run} busy={busy} />}
    {section === "raid" && <Raid project={project} actors={portfolio.actors} run={run} />}
    {section === "decisions" && <Decisions project={project} actor={actor} actors={portfolio.actors} run={run} />}
    {section === "budget" && <Budget project={project} run={run} />}
    {section === "team" && <Team project={project} actors={portfolio.actors} run={run} />}
    {section === "changes" && <Changes project={project} actor={actor} actors={portfolio.actors} run={run} />}
    {section === "reports" && <ProjectReports project={project} actor={actor} reports={portfolio.reports} run={run} />}
    {section === "comms" && <Communications project={project} messages={portfolio.messages} run={run} />}
    {section === "activity" && <Activity project={project} portfolio={portfolio} />}
    {!sections.includes(section) && <Navigate to={`/projects/${project.id}/overview`} replace />}
  </div>;
}

function ProjectOverview({ portfolio, project, run }: { portfolio: Portfolio; project: Project; run: Runner }) {
  const totals = budgetTotals(project); const complete = project.workItems.filter((item) => item.status === "done").length;
  const [update, setUpdate] = useState("");
  return <div className="workspace-grid overview-grid"><section className="control-panel overview-brief"><PanelHeader label="Project mandate" title="Outcome and ownership" meta={project.stage} /><div className="outcome-statement"><span>Target outcome</span><p>{project.outcome}</p></div><dl className="definition-grid"><div><dt>Sponsor</dt><dd>{actorName(portfolio.actors, project.sponsorId)}</dd></div><div><dt>Manager</dt><dd>{actorName(portfolio.actors, project.managerId)}</dd></div><div><dt>Target</dt><dd>{shortDate(project.targetDate)}</dd></div><div><dt>Completion</dt><dd>{complete}/{project.workItems.length} work items</dd></div></dl></section>
    <section className="control-panel health-evidence"><PanelHeader label="Current exceptions" title={`${project.health.toUpperCase()} control position`} meta={`${project.healthReasons.length} signals`} />{project.healthReasons.map((reason) => <div className="evidence-row" key={reason.code}><HealthMark health={reason.severity} label={false} /><div><strong>{reason.label}</strong><p>{reason.evidence}</p><code>{reason.code}</code></div></div>)}</section>
    <section className="control-panel"><PanelHeader label="Schedule" title="Milestone movement" meta={`${project.milestones.filter((item) => item.status === "complete").length}/${project.milestones.length} complete`} /><MilestoneLane project={project} /></section>
    <section className="control-panel"><PanelHeader label="Cost" title="Working forecast" meta={currency(totals.forecast)} /><div className="number-ledger"><div><span>Baseline</span><strong>{currency(totals.baseline)}</strong></div><div><span>Actual</span><strong>{currency(totals.actual)}</strong></div><div><span>Committed</span><strong>{currency(totals.committed)}</strong></div><div><span>Variance</span><strong className={totals.forecast > totals.baseline ? "rust-text" : ""}>{currency(totals.forecast - totals.baseline)}</strong></div></div></section>
    <section className="control-panel update-panel"><PanelHeader label="Quick update" title="Add project evidence" meta="Audited" /><textarea value={update} onChange={(event) => setUpdate(event.target.value)} placeholder="Record a practical update, blocker, or handoff…" /><button className="button primary" disabled={update.trim().length < 3} onClick={() => void run(async () => { await api.update(project.id, { version: project.version, text: update }); setUpdate(""); })}>Post update</button></section>
  </div>;
}

function Plan({ project, actors, run, busy }: { project: Project; actors: Actor[]; run: Runner; busy: boolean }) {
  const columns: WorkStatus[] = ["backlog", "ready", "in_progress", "blocked", "done"];
  const next: Record<WorkStatus, WorkStatus> = { backlog: "ready", ready: "in_progress", in_progress: "done", blocked: "in_progress", done: "done" };
  return <div className="workspace-stack"><section className="control-panel"><PanelHeader label="Critical path" title="Milestone baseline and forecast" meta="Click a forecast to simulate variance" /><MilestoneLane project={project} /><div className="milestone-actions">{project.milestones.filter((item) => item.status !== "complete").map((item) => <button key={item.id} disabled={busy} onClick={() => { const date = new Date(item.forecastDate); date.setUTCDate(date.getUTCDate() + 7); void run(() => api.milestone(project.id, item.id, { version: project.version, forecastDate: date.toISOString(), status: "in_progress" })); }}>Move {item.name} +7 days</button>)}</div></section>
    <section className="control-panel"><PanelHeader label="Execution" title="Work package board" meta={`${project.workItems.length} items`} /><div className="work-board">{columns.map((status) => <div className="work-column" key={status}><h3>{status.replaceAll("_", " ")} <span>{project.workItems.filter((item) => item.status === status).length}</span></h3>{project.workItems.filter((item) => item.status === status).map((item) => <article key={item.id}><code>{item.id}</code><strong>{item.title}</strong><small>{actorName(actors, item.ownerId)} / {shortDate(item.dueDate)}</small>{item.blocker && <p>{item.blocker}</p>}{status !== "done" && <button className="text-button" onClick={() => void run(() => api.work(project.id, item.id, { version: project.version, status: next[status], blocker: status === "in_progress" ? undefined : item.blocker }))}>{status === "blocked" ? "Resume work" : status === "in_progress" ? "Mark done" : "Advance"} →</button>}</article>)}</div>)}</div></section>
  </div>;
}

function Raid({ project, actors, run }: { project: Project; actors: Actor[]; run: Runner }) {
  return <div className="split-control"><section className="control-panel"><PanelHeader label="RAID register" title="Open control items" meta={`${project.raid.filter((item) => item.status !== "closed").length} active`} /><div className="data-table raid-table"><div className="table-head"><span>Type / exposure</span><span>Control item</span><span>Owner</span><span>Response</span><span>Status</span></div>{project.raid.map((item) => <div className="table-row" key={item.id}><div><code>{item.type}</code><strong className={`exposure-${riskBand(riskExposure(item.probability, item.impact))}-text`}>{exposureLabel(item.probability, item.impact)}</strong></div><div><strong>{item.title}</strong><small>{item.source}</small></div><span>{actorName(actors, item.ownerId)}</span><p>{item.response}</p><div><span className="status-label">{item.status}</span>{item.status !== "closed" && <button className="text-button" onClick={() => void run(() => api.raid(project.id, item.id, { version: project.version, status: item.status === "responding" ? "monitoring" : "closed", response: item.response, dueDate: item.dueDate }))}>{item.status === "responding" ? "Monitor" : "Close"}</button>}</div></div>)}</div></section><section className="control-panel matrix-panel"><PanelHeader label="Exposure map" title="Probability × impact" meta="Open risks" /><RiskMatrix project={project} /></section></div>;
}

function Budget({ project, run }: { project: Project; run: Runner }) {
  const total = budgetTotals(project); const max = Math.max(...project.budget.map((line) => line.forecast));
  return <div className="workspace-grid budget-layout"><section className="control-panel budget-table-panel"><PanelHeader label="Cost control" title="Budget ledger" meta={currency(total.forecast)} /><div className="data-table budget-table"><div className="table-head"><span>Category / vendor</span><span>Baseline</span><span>Actual</span><span>Committed</span><span>Forecast</span></div>{project.budget.map((line) => <div className="table-row" key={line.id}><div><strong>{line.category}</strong><small>{line.vendor}</small></div><span>{currency(line.baseline)}</span><span>{currency(line.actual)}</span><span>{currency(line.committed)}</span><div className="forecast-control"><strong className={line.forecast > line.baseline ? "rust-text" : ""}>{currency(line.forecast)}</strong><button className="text-button" onClick={() => void run(() => api.budget(project.id, line.id, { version: project.version, forecast: line.forecast + 10000 }))}>Add $10K</button></div></div>)}</div><div className="table-total"><span>Project total</span><b>{currency(total.baseline)}</b><b>{currency(total.actual)}</b><b>{currency(total.committed)}</b><b>{currency(total.forecast)}</b></div><a className="button quiet" href="/api/v1/exports/budget.csv">Export program budget CSV</a></section>
    <section className="control-panel"><PanelHeader label="Variance" title="Forecast by category" meta={currency(total.forecast - total.baseline)} />{project.budget.map((line) => <div className="budget-category" key={line.id}><div><span>{line.category}</span><strong>{currency(line.forecast)}</strong></div><div><i style={{ width: `${line.forecast / max * 100}%` }} /><b style={{ left: `${line.baseline / max * 100}%` }} /></div></div>)}</section></div>;
}

function Team({ project, actors, run }: { project: Project; actors: Actor[]; run: Runner }) {
  return <div className="workspace-grid"><section className="control-panel"><PanelHeader label="Capacity" title="Project allocation" meta={`${project.allocations.filter((item) => item.percent > 100).length} conflict(s)`} /><ResourceHeatmap project={project} actors={actors} /></section><section className="control-panel"><PanelHeader label="Team directory" title="Responsibilities" meta={`${project.allocations.length} assigned`} />{project.allocations.map((allocation) => { const actor = actors.find((item) => item.id === allocation.actorId); return <div className="person-row" key={allocation.actorId}><span className="person-monogram">{actor?.initials}</span><div><strong>{actor?.name}</strong><small>{actor?.title} / {allocation.workstream}</small></div><div><b>{allocation.percent}%</b><small>{allocation.percent > 100 ? "over capacity" : `${actor?.availability ?? 100}% available`}</small>{allocation.percent > 100 && <button className="text-button" onClick={() => void run(() => api.allocation(project.id, allocation.actorId, { version: project.version, percent: 90 }))}>Resolve to 90%</button>}</div></div>; })}</section></div>;
}

function Decisions({ project, actor, actors, run }: { project: Project; actor: Actor; actors: Actor[]; run: Runner }) {
  return <section className="control-panel"><PanelHeader label="Decision register" title="Rationale and downstream effects" meta={`${project.decisions.filter((item) => item.status === "pending" || item.status === "proposed").length} pending`} />{project.decisions.map((decision) => <article className="decision-record" key={decision.id}><div><code>{decision.id}</code><span className={`status-label status-${decision.status}`}>{decision.status}</span></div><div><h3>{decision.title}</h3><p>{decision.rationale}</p><small>Owner {actorName(actors, decision.ownerId)} / approver {actorName(actors, decision.approverId)}</small></div><div><strong>Alternatives considered</strong><ul>{decision.alternatives.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Downstream effect</strong><p>{decision.impact}</p>{actor.role === "sponsor" && (decision.status === "pending" || decision.status === "proposed") && <div className="decision-actions"><button className="button primary" onClick={() => void run(() => api.registeredDecision(project.id, decision.id, { version: project.version, status: "approved", rationale: `${decision.rationale} Sponsor approved after review of recorded alternatives and effects.` }))}>Approve</button><button className="button quiet" onClick={() => void run(() => api.registeredDecision(project.id, decision.id, { version: project.version, status: "rejected", rationale: `${decision.rationale} Sponsor rejected pending a revised operating case.` }))}>Reject</button></div>}</div></article>)}</section>;
}

function Changes({ project, actor, actors, run }: { project: Project; actor: Actor; actors: Actor[]; run: Runner }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [days, setDays] = useState(5); const [cost, setCost] = useState(25000); const [rationale, setRationale] = useState("");
  return <div className="workspace-stack"><section className="control-panel"><PanelHeader label="Change control" title="Baseline decisions" meta={`${project.changes.filter((item) => item.status === "submitted").length} pending`} action={(actor.role === "program_director" || actor.role === "lead") ? <button className="button primary" onClick={() => setOpen(true)}>New change</button> : undefined} />
    {project.changes.map((change) => <article className="change-record" key={change.id}><div className="change-id"><code>{change.id.slice(0, 8)}</code><span className={`status-label status-${change.status}`}>{change.status}</span></div><div><h3>{change.title}</h3><p>{change.rationale}</p><small>Requested by {actorName(actors, change.requestedBy)} / owner {actorName(actors, change.ownerId)}</small></div><div className="impact-ledger"><span><small>Schedule</small><strong>{change.scheduleImpactDays} days</strong></span><span><small>Budget</small><strong>{currency(change.budgetImpact)}</strong></span><span><small>Risk</small><strong>{change.riskImpact}</strong></span></div><div className="change-actions">{change.decisionNote && <p>{change.decisionNote}</p>}{actor.role === "sponsor" && change.status === "submitted" && <><button className="button primary" onClick={() => void run(() => api.decideChange(project.id, change.id, { version: project.version, decision: "approved", note: "Approved after review of schedule, cost, and risk impacts." }))}>Approve</button><button className="button quiet" onClick={() => void run(() => api.decideChange(project.id, change.id, { version: project.version, decision: "rejected", note: "Rejected; revise the recovery approach before resubmission." }))}>Reject</button></>}{actor.role === "program_director" && change.status === "approved" && <button className="button primary" onClick={() => void run(() => api.implementChange(project.id, change.id, project.version))}>Implement baseline change</button>}</div></article>)}
    </section>{open && <Modal title="Submit change request" onClose={() => setOpen(false)}><label>Change title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="form-pair"><label>Schedule impact (days)<input type="number" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><label>Budget impact<input type="number" value={cost} onChange={(event) => setCost(Number(event.target.value))} /></label></div><label>Rationale and risk impact<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><button className="button primary" disabled={title.length < 5 || rationale.length < 5} onClick={() => void run(async () => { await api.createChange(project.id, { version: project.version, title, ownerId: actor.id, scheduleImpactDays: days, budgetImpact: cost, riskImpact: rationale, rationale }); setOpen(false); })}>Submit for sponsor decision</button></Modal>}</div>;
}

function ProjectReports({ project, actor, reports, run }: { project: Project; actor: Actor; reports: Report[]; run: Runner }) {
  const report = reports.find((item) => item.projectId === project.id);
  if (!report) return <Empty text="No report exists for this project." />;
  return <section className="control-panel report-workspace"><PanelHeader label="Status reporting" title={report.period} meta={`v${report.version} / ${report.status}`} action={<button className="button quiet" onClick={() => void run(() => api.generateReport(project.id))}>Regenerate from evidence</button>} /><article className="report-sheet"><header><HealthMark health={project.health} /><div><h2>{report.headline}</h2><p>{report.summary}</p></div></header><div className="report-columns"><section><h3>Completed</h3><ItemList items={report.accomplishments} /></section><section><h3>Next</h3><ItemList items={report.next} /></section><section><h3>Decisions needed</h3><ItemList items={report.decisionsNeeded} /></section></div><footer><div>{report.evidence.map((item) => <code key={`${item.entityType}-${item.entityId}-${item.label}`}>{item.label}</code>)}</div><div className="report-actions">{(actor.role === "program_director" || actor.role === "lead") && report.status === "draft" && <button className="button primary" onClick={() => void run(() => api.reportStatus(report.id, "review"))}>Submit for review</button>}{actor.role === "sponsor" && report.status === "review" && <button className="button primary" onClick={() => void run(() => api.reportStatus(report.id, "approved"))}>Approve report</button>}{actor.role === "sponsor" && report.status === "approved" && <button className="button primary" onClick={() => void run(() => api.reportStatus(report.id, "published"))}>Publish internally</button>}<a className="button quiet" href={`/api/v1/reports/${report.id}/print`} target="_blank" rel="noreferrer">Print brief</a></div></footer></article></section>;
}

function Communications({ project, messages, run }: { project: Project; messages: Message[]; run: Runner }) {
  const [channel, setChannel] = useState<Channel>("teams"); const [audience, setAudience] = useState("Mountain West leadership"); const [body, setBody] = useState("");
  const relevant = messages.filter((item) => item.projectId === project.id);
  return <div className="comms-grid"><section className="control-panel"><PanelHeader label="Simulation adapters" title="Channel transcript" meta={`${relevant.length} messages`} />{relevant.map((item) => <article className="message-row" key={item.id}><div><code>{item.channel}</code><span className={`status-label status-${item.status}`}>{item.status}</span></div><div><strong>{item.subject ?? item.audience}</strong><p>{item.body}</p><small>{actorName([], item.authorId)} / {shortDate(item.createdAt)}</small></div>{item.status === "preview" && <button className="button primary" onClick={() => void run(() => api.deliverMessage(item.id))}>Approve simulated delivery</button>}</article>)}</section>
    <section className="control-panel compose-panel"><PanelHeader label="New communication" title="Prepare a message" meta="Nothing leaves the demo" /><label>Channel<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}><option value="teams">Teams</option><option value="slack">Slack</option><option value="email">Email</option></select></label><label>Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label><label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="State the decision, impact, owner, and next checkpoint." /></label><button className="button primary" disabled={body.trim().length < 5} onClick={() => void run(async () => { await api.previewMessage({ projectId: project.id, channel, audience, body }); setBody(""); })}>Create delivery preview</button></section></div>;
}

function Activity({ project, portfolio }: { project: Project; portfolio: Portfolio }) {
  const events = portfolio.audit.filter((item) => item.projectId === project.id); return <section className="control-panel"><PanelHeader label="Audit history" title="Recorded project activity" meta={`${events.length} events`} /><ol className="audit-list">{events.map((event, index) => <li key={event.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{event.action.replaceAll(".", " / ")}</strong><p>{event.detail}</p><small>{actorName(portfolio.actors, event.actorId)} / {new Date(event.createdAt).toLocaleString()}</small></div><code>{event.entityType}:{event.entityId.slice(0, 8)}</code></li>)}</ol></section>;
}

function Inbox({ portfolio }: { portfolio: Portfolio; run: Runner }) {
  return <div className="page"><PageHeading eyebrow="Your work" title="Inbox and approvals" description="Mentions, assignments, decisions, and recent team-channel activity for the selected role." /><div className="inbox-layout"><section className="control-panel"><PanelHeader label="Notifications" title="Needs attention" meta={`${portfolio.notifications.length} items`} />{portfolio.notifications.map((item) => <Link className="inbox-row" key={item.id} to={item.projectId ? `/projects/${item.projectId}/overview` : "/"}><span>{item.kind}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></Link>)}</section><section className="control-panel"><PanelHeader label="Channels" title="Recent delivery" meta="Demo channels" />{portfolio.messages.map((item) => <Link to={`/projects/${item.projectId}/comms`} className="inbox-row" key={item.id}><span>{item.channel}</span><div><strong>{item.subject ?? item.audience}</strong><p>{item.body}</p><small>{item.status} / {shortDate(item.createdAt)}</small></div></Link>)}</section></div></div>;
}

function Files({ portfolio }: { portfolio: Portfolio }) {
  const [query, setQuery] = useState(""); const [project, setProject] = useState("all");
  const files = portfolio.files.filter((file) => (project === "all" || file.projectId === project) && `${file.title} ${file.summary} ${file.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page"><PageHeading eyebrow="Program evidence" title="File room" description="Search the current working set, preview source material, or retrieve a copy while away from your desk." /><section className="control-panel file-room"><PanelHeader label="Document register" title="Current files" meta={`${files.length} shown`} /><div className="file-filters"><input aria-label="Search files" placeholder="Search title, tag, or summary" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter files by project" value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All projects</option>{portfolio.projects.map((item) => <option key={item.id} value={item.id}>{item.code} / {item.name}</option>)}</select></div><div className="file-list">{files.map((file) => <article key={file.id}><div className="file-type">{file.filename.split(".").pop()?.toUpperCase()}</div><div><code>{file.projectId ? portfolio.projects.find((item) => item.id === file.projectId)?.code : "PROGRAM"} / v{file.version}</code><h3>{file.title}</h3><p>{file.summary}</p><small>{file.sizeLabel} / updated {shortDate(file.updatedAt)} / {file.tags.join(" · ")}</small></div><div><a className="button quiet" href={file.assetPath} target="_blank" rel="noreferrer">Preview</a><a className="button primary" href={`/api/v1/files/${file.id}/download`}>Download</a></div></article>)}</div></section></div>;
}

function Reports({ portfolio, actor, run }: { portfolio: Portfolio; actor: Actor; run: Runner }) {
  return <div className="page"><PageHeading eyebrow="Governance cycle" title="Program reporting" description="Status briefs remain grounded in the current schedule, budget, risk, and decision evidence." /><section className="control-panel"><PanelHeader label="Report register" title="Weekly briefs" meta={`${portfolio.reports.length} projects`} />{portfolio.reports.map((report) => { const project = portfolio.projects.find((item) => item.id === report.projectId)!; return <article className="report-register-row" key={report.id}><HealthMark health={project.health} /><div><code>{project.code} / {report.period}</code><strong>{report.headline}</strong><small>v{report.version} / {report.status} / updated {shortDate(report.updatedAt)}</small></div><div><Link className="button quiet" to={`/projects/${project.id}/reports`}>Open workspace</Link>{actor.role === "sponsor" && report.status === "review" && <button className="button primary" onClick={() => void run(() => api.reportStatus(report.id, "approved"))}>Approve</button>}</div></article>; })}</section></div>;
}

function Copilot({ portfolio, run }: { portfolio: Portfolio; run: Runner }) {
  const [projectId, setProjectId] = useState(portfolio.projects[0]?.id ?? ""); const [action, setAction] = useState<CopilotAction>("risk_scan"); const [input, setInput] = useState(""); const [proposal, setProposal] = useState<CopilotProposal | null>(null);
  const [auth, setAuth] = useState<AuthSession | null>(null); const [mode, setMode] = useState<"demo" | "live">("demo"); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => { void api.auth().then(setAuth, () => setAuth(null)); }, []);
  const project = portfolio.projects.find((item) => item.id === projectId)!;
  const actions: Array<[CopilotAction, string, string]> = [["risk_scan", "Control scan", "Find unrecorded schedule, risk, and blocker exposure."], ["meeting_extract", "Meeting extraction", "Convert notes into proposed work, decisions, and risks."], ["status_report", "Status brief", "Draft a report from current project evidence."], ["change_impact", "Change impact", "Assess cost, schedule, capacity, and risk effects."], ["resource_scan", "Capacity scan", "Find allocation conflicts and constrained owners."], ["message_draft", "Stakeholder message", "Prepare a channel-specific management update."], ["what_changed", "What changed", "Summarize material movement since the prior update."], ["ask", "Ask the record", "Answer a question with citations to project evidence."]];
  return <div className="page"><PageHeading eyebrow={`Assisted review · ${mode === "live" ? "Owner provider" : "Public workspace"}`} title="Project analysis" description="Review cited findings and proposed record changes before deciding what belongs in the plan." /><div className="copilot-layout"><section className="copilot-menu"><label>Project<select value={projectId} onChange={(event) => { setProjectId(event.target.value); setProposal(null); setSelectedIds([]); }}>{portfolio.projects.map((item) => <option key={item.id} value={item.id}>{item.code} / {item.name}</option>)}</select></label>{actions.map(([id, label, detail]) => <button key={id} className={action === id ? "active" : ""} onClick={() => { setAction(id); setProposal(null); setSelectedIds([]); }}><strong>{label}</strong><span>{detail}</span></button>)}</section><section className="control-panel copilot-work"><PanelHeader label="Review before apply" title={actions.find((item) => item[0] === action)?.[1] ?? "Copilot"} meta={project.code} /><div className="provider-control"><div><strong>{mode === "live" ? "Live owner provider" : "Deterministic public provider"}</strong><small>{mode === "live" ? `${auth?.login ?? "Owner"} / ${auth?.usage.runs ?? 0} of ${auth?.usage.limit ?? 20} runs used today` : "No model request or token cost"}</small></div>{auth?.liveAvailable ? <select aria-label="Copilot provider" value={mode} onChange={(event) => setMode(event.target.value as "demo" | "live")}><option value="demo">Public demo rules</option><option value="live">Live OpenAI</option></select> : auth?.configured ? <a className="button quiet" href="/auth/github/start">Owner sign in</a> : <span className="status-label">Owner mode not configured</span>}</div><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={action === "meeting_extract" ? "Paste synthetic meeting notes or use the project record as context…" : action === "ask" ? "Ask about current delivery evidence…" : "Optional context for this analysis…"} /><button className="button primary" onClick={() => void run(async () => { const value = await api.copilot(project.id, action, input, mode); setProposal(value); setSelectedIds(value.changes.map((change) => change.entityId)); if (mode === "live") setAuth(await api.auth()); }, false)}>Run evidence review</button>{proposal && <article className="proposal"><header><div><code>{proposal.provider}{proposal.model ? ` / ${proposal.model}` : ""} / {Math.round(proposal.confidence * 100)}% confidence</code><h2>{proposal.title}</h2></div><span className={`status-label status-${proposal.status}`}>{proposal.status}</span></header><p>{proposal.summary}</p>{proposal.changes.length > 0 && <div className="proposal-changes"><h3>Proposed changes</h3>{proposal.changes.map((change) => <label className="proposal-choice" key={change.entityId}><input type="checkbox" checked={selectedIds.includes(change.entityId)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, change.entityId] : current.filter((id) => id !== change.entityId))} /><code>{change.operation} {change.entityType}</code><span>{change.preview}</span></label>)}</div>}<div className="proposal-citations"><h3>Evidence</h3>{proposal.citations.map((citation) => <code key={`${citation.entityType}-${citation.entityId}`}>{citation.label}</code>)}</div>{proposal.warnings.map((warning) => <p className="proposal-warning" key={warning}>{warning}</p>)}{proposal.status === "proposed" && <footer><button className="button quiet" onClick={() => void run(async () => { const value = await api.rejectCopilot(proposal.id); setProposal(value); }, false)}>Reject</button>{proposal.changes.length > 0 && <button className="button primary" disabled={selectedIds.length === 0} onClick={() => void run(async () => { const value = await api.applyCopilot(proposal.id, project.id, project.version, selectedIds); setProposal(value.proposal); })}>Apply selected changes</button>}</footer>}</article>}</section></div></div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>; }
function PanelHeader({ label, title, meta, action }: { label: string; title: string; meta: string; action?: React.ReactNode }) { return <header className="panel-header"><div><p>{label}</p><h2>{title}</h2></div><small>{meta}</small>{action}</header>; }
function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) { return <div className={tone ? `metric metric-${tone}` : "metric"}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
function ItemList({ items }: { items: string[] }) { return <ul>{items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>None recorded.</li>}</ul>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><button onClick={onClose} aria-label="Close dialog">×</button></header>{children}</section></div>; }

function useMedia(query: string) { const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches); useEffect(() => { const media = window.matchMedia(query); const update = () => setMatches(media.matches); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, [query]); return matches; }
function message(cause: unknown) { return cause instanceof Error ? cause.message : "Something went wrong."; }
function mergeProjects(projects: Project[]): Project { const first = projects[0]; return { ...first, raid: projects.flatMap((item) => item.raid) }; }

type IconName = "mark" | "program" | "chevron" | "reset" | "portfolio" | "projects" | "inbox" | "files" | "reports" | "copilot" | "shield" | "arrow" | "approval" | "risk" | "today" | "more";
const iconPaths: Record<IconName, React.ReactNode> = {
  mark: <><path d="M5 4h6v6H5zM13 4h6v6h-6zM5 12h6v8H5zM13 12h6v8h-6z" /><path d="M8 7h8M8 16h8" /></>,
  program: <><path d="M4 7h16M7 4v6M17 4v6M5 12h6v7H5zM13 12h6v7h-6z" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  reset: <><path d="M5 8a8 8 0 1 1-1 6" /><path d="M5 3v5H0" /></>,
  portfolio: <><path d="M4 5h16v14H4zM4 10h16M9 10v9" /></>,
  projects: <><path d="M4 6h7l2 2h7v11H4z" /><path d="M8 12h8M8 15h6" /></>,
  inbox: <><path d="M4 5h16v14H4z" /><path d="m4 14 4-4h8l4 4M9 15h6" /></>,
  files: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>,
  reports: <><path d="M5 4h14v16H5z" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  copilot: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="5" /><path d="m10 12 1.4 1.4L15 10" /></>,
  shield: <><path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  approval: <><path d="M5 4h14v16H5z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  risk: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5M12 17h.01" /></>,
  today: <><path d="M5 4h14v16H5zM5 9h14" /><path d="M9 3v3M15 3v3M8 13h3M8 16h6" /></>,
  more: <><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></>,
};
function Icon({ name }: { name: IconName }) { return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>; }
