import { budgetTotals } from "../domain/health";
import type { Actor, Health, Project } from "../domain/model";
import { currency } from "./format";

export function HealthMark({ health, label = true }: { health: Health; label?: boolean }) {
  return <span className={`health-mark health-${health}`}><span aria-hidden="true">{health === "green" ? "●" : health === "amber" ? "▲" : "■"}</span>{label && <span>{health}</span>}</span>;
}

export function RiskMatrix({ project }: { project: Project }) {
  const risks = project.raid.filter((item) => item.type === "risk" && item.status !== "closed");
  return <div className="risk-matrix" aria-label="Risk probability and impact matrix">
    <div className="matrix-axis matrix-y">Probability</div>
    <div className="matrix-grid">
      {Array.from({ length: 25 }, (_, index) => {
        const probability = 5 - Math.floor(index / 5);
        const impact = (index % 5) + 1;
        const exposure = probability * impact;
        const count = risks.filter((risk) => risk.probability === probability && risk.impact === impact).length;
        return <div key={index} className={`matrix-cell exposure-${exposure >= 15 ? "high" : exposure >= 8 ? "medium" : "low"}`} title={`Probability ${probability}, impact ${impact}, ${count} risk(s)`}>{count || ""}</div>;
      })}
    </div>
    <div className="matrix-axis matrix-x">Impact →</div>
  </div>;
}

export function DependencyMap({ projects }: { projects: Project[] }) {
  const links = [
    { from: 0, to: 3, label: "facility access" }, { from: 1, to: 3, label: "training build" }, { from: 2, to: 0, label: "vendor readiness" }, { from: 1, to: 0, label: "dispatch release" },
  ];
  const points = [{ x: 80, y: 55 }, { x: 325, y: 55 }, { x: 80, y: 185 }, { x: 325, y: 185 }];
  return <svg className="dependency-map" viewBox="0 0 430 245" role="img" aria-label="Cross-project dependency map">
    <defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" /></marker></defs>
    {links.map((link) => { const from = points[link.from]; const to = points[link.to]; return <g key={link.label}><line x1={from.x} y1={from.y + 18} x2={to.x} y2={to.y - 18} markerEnd="url(#arrow)" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}>{link.label}</text></g>; })}
    {projects.slice(0, 4).map((project, index) => <g key={project.id} transform={`translate(${points[index].x - 62} ${points[index].y - 22})`}><rect width="124" height="44" className={`node-${project.health}`} /><text x="10" y="18" className="node-code">{project.code}</text><text x="10" y="33">{project.name.split(" ").slice(0, 3).join(" ")}</text></g>)}
  </svg>;
}

export function BudgetWaterfall({ projects }: { projects: Project[] }) {
  const totals = projects.map((project) => ({ project, ...budgetTotals(project) }));
  const maximum = Math.max(...totals.map((item) => item.forecast));
  return <div className="budget-waterfall" aria-label="Budget baseline and forecast by project">
    {totals.map(({ project, baseline, forecast }) => <div className="waterfall-row" key={project.id}>
      <span>{project.code}</span><div className="waterfall-track"><span className="baseline-bar" style={{ width: `${(baseline / maximum) * 100}%` }} /><span className={`forecast-tick ${forecast > baseline ? "over" : ""}`} style={{ left: `${(forecast / maximum) * 100}%` }} /></div><strong>{currency(forecast)}</strong>
    </div>)}
  </div>;
}

export function ResourceHeatmap({ project, actors }: { project: Project; actors: Actor[] }) {
  return <div className="resource-heatmap">
    {project.allocations.map((allocation) => { const actor = actors.find((item) => item.id === allocation.actorId); return <div className="resource-row" key={`${allocation.actorId}-${allocation.workstream}`}><div><strong>{actor?.name ?? allocation.actorId}</strong><small>{allocation.workstream}</small></div><div className="allocation-track"><span className={allocation.percent > 100 ? "over" : ""} style={{ width: `${Math.min(allocation.percent, 130) / 1.3}%` }} /></div><b>{allocation.percent}%</b></div>; })}
  </div>;
}

export function MilestoneLane({ project }: { project: Project }) {
  const dates = project.milestones.flatMap((item) => [Date.parse(item.baselineDate), Date.parse(item.forecastDate)]);
  const min = Math.min(...dates); const max = Math.max(...dates); const span = max - min || 1;
  return <div className="milestone-lane">
    {project.milestones.map((item) => { const baseline = ((Date.parse(item.baselineDate) - min) / span) * 100; const forecast = ((Date.parse(item.forecastDate) - min) / span) * 100; return <div className="milestone-row" key={item.id}><div><strong>{item.name}</strong><small>{item.phase} / {item.status.replaceAll("_", " ")}</small></div><div className="date-track"><span className="baseline-point" style={{ left: `${baseline}%` }} title="Baseline" /><span className={`forecast-point ${forecast > baseline ? "late" : ""}`} style={{ left: `${forecast}%` }} title="Forecast" /><span className="date-connector" style={{ left: `${Math.min(baseline, forecast)}%`, width: `${Math.abs(forecast - baseline)}%` }} /></div><time>{new Date(item.forecastDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div>; })}
  </div>;
}
