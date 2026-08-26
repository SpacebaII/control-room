import { evaluateHealth } from "../domain/health";
import type { Actor, AuditEvent, FileRecord, Message, Notification, Project, Report } from "../domain/model";

export interface SeedData {
  actors: Actor[];
  projects: Project[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
  files: FileRecord[];
  audit: AuditEvent[];
}

function dateFrom(now: Date, days: number, hour = 15) {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

function withHealth(project: Project, now: Date): Project {
  const result = evaluateHealth(project, now);
  return { ...project, health: result.health, healthReasons: result.reasons };
}

export function createSeed(now = new Date()): SeedData {
  const at = (days: number, hour?: number) => dateFrom(now, days, hour);
  const actors: Actor[] = [
    { id: "alex", name: "Alex Morgan", role: "program_director", title: "Program Director", function: "Transformation Office", initials: "AM", availability: 100 },
    { id: "dana", name: "Dana Brooks", role: "sponsor", title: "VP, Regional Operations", function: "Executive Office", initials: "DB", availability: 35 },
    { id: "marcus", name: "Marcus Bell", role: "lead", title: "Operations Lead", function: "Service Operations", initials: "MB", availability: 100 },
    { id: "priya", name: "Priya Shah", role: "lead", title: "Technology Lead", function: "Enterprise Systems", initials: "PS", availability: 100 },
    { id: "elena", name: "Elena Ruiz", role: "lead", title: "Finance Partner", function: "FP&A", initials: "ER", availability: 80 },
    { id: "jonah", name: "Jonah Price", role: "contributor", title: "Vendor Manager", function: "Procurement", initials: "JP", availability: 100 },
    { id: "simone", name: "Simone Reed", role: "contributor", title: "Regional Trainer", function: "People Operations", initials: "SR", availability: 100 },
  ];

  const hub: Project = {
    id: "hub", code: "MW-01", name: "Denver service hub opening",
    objective: "Open a staffed Mountain West service hub capable of supporting 1,800 monthly field appointments.",
    outcome: "Operational readiness by October 20 with permits, equipment, staffing, and launch controls complete.",
    stage: "Execution", sponsorId: "dana", managerId: "marcus", startDate: at(-88), targetDate: at(38), health: "amber", healthReasons: [], version: 4, updatedAt: at(-1), lastStatusAt: at(-2),
    milestones: [
      { id: "hub-m1", name: "Facility lease and permits", phase: "Mobilize", ownerId: "jonah", baselineDate: at(-35), forecastDate: at(-35), status: "complete", critical: true },
      { id: "hub-m2", name: "Network and equipment ready", phase: "Build", ownerId: "priya", baselineDate: at(12), forecastDate: at(19), status: "in_progress", critical: true },
      { id: "hub-m3", name: "Operational readiness review", phase: "Launch", ownerId: "marcus", baselineDate: at(31), forecastDate: at(31), status: "not_started", critical: true },
    ],
    workItems: [
      { id: "hub-w1", title: "Complete low-voltage cabling", ownerId: "priya", milestoneId: "hub-m2", status: "in_progress", dueDate: at(8), priority: "high" },
      { id: "hub-w2", title: "Confirm generator inspection", ownerId: "marcus", milestoneId: "hub-m2", status: "blocked", dueDate: at(5), priority: "high", blocker: "City inspection slot not confirmed." },
      { id: "hub-w3", title: "Publish launch-day staffing roster", ownerId: "simone", milestoneId: "hub-m3", status: "ready", dueDate: at(20), priority: "medium" },
      { id: "hub-w4", title: "Close facility punch list", ownerId: "jonah", milestoneId: "hub-m3", status: "backlog", dueDate: at(27), priority: "high" },
    ],
    dependencies: [{ id: "hub-d1", fromMilestoneId: "hub-m2", toMilestoneId: "hub-m3", kind: "finish_to_start", note: "Equipment validation is required before the readiness review." }],
    raid: [
      { id: "hub-r1", type: "risk", title: "Network circuit delivery may miss commissioning window", ownerId: "priya", probability: 3, impact: 4, status: "responding", dueDate: at(4), response: "Maintain cellular failover and daily carrier checkpoint.", lastActionAt: at(-2), source: "Technology readiness meeting" },
      { id: "hub-i1", type: "issue", title: "Generator inspection slot is unconfirmed", ownerId: "marcus", probability: 4, impact: 3, status: "responding", dueDate: at(5), response: "Escalated to city liaison; request alternate inspector.", lastActionAt: at(-1), source: "Facility stand-up" },
      { id: "hub-a1", type: "assumption", title: "Initial volume remains below 1,800 appointments", ownerId: "alex", probability: 2, impact: 3, status: "monitoring", dueDate: at(30), response: "Validate against weekly commercial forecast.", lastActionAt: at(-3), source: "Approved charter" },
    ],
    decisions: [
      { id: "hub-dec1", title: "Use cellular failover for launch", status: "approved", ownerId: "priya", approverId: "dana", rationale: "Protect the launch date while the primary circuit remains at risk.", alternatives: ["Delay opening", "Use shared guest network"], decidedAt: at(-3), impact: "$18,000 contingency commitment; no schedule change." },
    ],
    budget: [
      { id: "hub-b1", category: "Facility", vendor: "Mile High Commercial", baseline: 620000, actual: 438000, committed: 144000, forecast: 620000 },
      { id: "hub-b2", category: "Technology", vendor: "Summit Network Group", baseline: 210000, actual: 92000, committed: 126000, forecast: 226000 },
      { id: "hub-b3", category: "Launch operations", vendor: "Internal", baseline: 120000, actual: 43000, committed: 51000, forecast: 121000 },
    ],
    allocations: [
      { actorId: "marcus", percent: 85, workstream: "Facility readiness" }, { actorId: "priya", percent: 70, workstream: "Technology readiness" }, { actorId: "jonah", percent: 45, workstream: "Vendors" }, { actorId: "simone", percent: 30, workstream: "Launch staffing" },
    ],
    changes: [{ id: "hub-c1", title: "Add cellular failover package", status: "approved", requestedBy: "priya", ownerId: "alex", submittedAt: at(-5), scheduleImpactDays: 0, budgetImpact: 18000, riskImpact: "Reduces connectivity continuity exposure from high to low.", rationale: "Primary circuit delivery is not guaranteed before commissioning.", decisionNote: "Approved from program contingency by Dana Brooks." }],
    updates: [{ id: "hub-u1", actorId: "marcus", createdAt: at(-2), text: "Construction is tracking to the revised punch-list sequence. Network commissioning is the remaining critical path.", kind: "weekly" }],
  };

  const platform: Project = {
    id: "platform", code: "MW-02", name: "Field scheduling platform rollout",
    objective: "Deploy a single dispatch and scheduling workflow for the new region and two existing branches.",
    outcome: "Ninety percent dispatcher adoption with stable mobile synchronization and measured appointment-cycle improvement.",
    stage: "Pilot", sponsorId: "dana", managerId: "priya", startDate: at(-96), targetDate: at(28), health: "red", healthReasons: [], version: 7, updatedAt: at(-1), lastStatusAt: at(-9),
    milestones: [
      { id: "plt-m1", name: "Configuration baseline", phase: "Configure", ownerId: "priya", baselineDate: at(-28), forecastDate: at(-28), status: "complete", critical: true },
      { id: "plt-m2", name: "Dispatcher pilot exit", phase: "Pilot", ownerId: "marcus", baselineDate: at(-8), forecastDate: at(10), status: "in_progress", critical: true },
      { id: "plt-m3", name: "Regional production release", phase: "Rollout", ownerId: "priya", baselineDate: at(20), forecastDate: at(38), status: "not_started", critical: true },
    ],
    workItems: [
      { id: "plt-w1", title: "Resolve offline mobile synchronization defect", ownerId: "priya", milestoneId: "plt-m2", status: "blocked", dueDate: at(-3), priority: "critical", blocker: "Vendor patch failed regression testing." },
      { id: "plt-w2", title: "Reconcile dispatcher permission matrix", ownerId: "marcus", milestoneId: "plt-m2", status: "in_progress", dueDate: at(2), priority: "high" },
      { id: "plt-w3", title: "Approve production cutover runbook", ownerId: "alex", milestoneId: "plt-m3", status: "ready", dueDate: at(12), priority: "high" },
      { id: "plt-w4", title: "Measure pilot appointment cycle time", ownerId: "marcus", milestoneId: "plt-m2", status: "in_progress", dueDate: at(4), priority: "medium" },
    ],
    dependencies: [{ id: "plt-d1", fromMilestoneId: "plt-m2", toMilestoneId: "plt-m3", kind: "finish_to_start", note: "Pilot exit criteria must be met before production release." }],
    raid: [
      { id: "plt-r1", type: "risk", title: "Vendor patch may not stabilize offline synchronization", ownerId: "priya", probability: 4, impact: 5, status: "responding", dueDate: at(-2), response: "Daily defect triage and rollback design; executive escalation open.", lastActionAt: at(-9), source: "Pilot defect review" },
      { id: "plt-i1", type: "issue", title: "Pilot exit criteria failed in two branches", ownerId: "marcus", probability: 5, impact: 4, status: "assessed", dueDate: at(1), response: "Re-baseline pilot and run a focused dispatcher validation cycle.", lastActionAt: at(-2), source: "Pilot scorecard" },
      { id: "plt-dp1", type: "dependency", title: "Training environment depends on stable configuration", ownerId: "simone", probability: 4, impact: 4, status: "monitoring", dueDate: at(6), response: "Maintain screenshot-based contingency materials.", lastActionAt: at(-4), source: "Training readiness plan" },
    ],
    decisions: [{ id: "plt-dec1", title: "Extend pilot by two weeks", status: "pending", ownerId: "alex", approverId: "dana", rationale: "Current defect profile makes production release unsafe.", alternatives: ["Release with known defect", "Limit release to one branch"], impact: "18-day schedule movement and $64,000 forecast increase." }],
    budget: [
      { id: "plt-b1", category: "Software", vendor: "RouteWorks", baseline: 410000, actual: 302000, committed: 186000, forecast: 486000 },
      { id: "plt-b2", category: "Integration", vendor: "North Peak Digital", baseline: 235000, actual: 182000, committed: 91000, forecast: 276000 },
      { id: "plt-b3", category: "Internal rollout", vendor: "Internal", baseline: 95000, actual: 66000, committed: 43000, forecast: 111000 },
    ],
    allocations: [{ actorId: "priya", percent: 120, workstream: "Platform delivery" }, { actorId: "marcus", percent: 105, workstream: "Pilot operations" }, { actorId: "simone", percent: 45, workstream: "Training preparation" }],
    changes: [{ id: "plt-c1", title: "Extend dispatcher pilot", status: "submitted", requestedBy: "priya", ownerId: "alex", submittedAt: at(-1), scheduleImpactDays: 18, budgetImpact: 64000, riskImpact: "Reduces deployment disruption risk but extends hub/platform dependency.", rationale: "Two branches failed offline synchronization exit criteria." }],
    updates: [{ id: "plt-u1", actorId: "priya", createdAt: at(-9), text: "Pilot stability is below release threshold. The team is waiting for a corrected vendor patch and approval to extend the pilot.", kind: "weekly" }],
  };

  const vendors: Project = {
    id: "vendors", code: "MW-03", name: "Vendor readiness and procurement",
    objective: "Contract and mobilize launch-critical regional vendors with complete controls and service-level ownership.",
    outcome: "All launch vendors contracted, onboarded, insured, and measured before operational readiness review.",
    stage: "Execution", sponsorId: "dana", managerId: "jonah", startDate: at(-74), targetDate: at(24), health: "green", healthReasons: [], version: 3, updatedAt: at(-2), lastStatusAt: at(-3),
    milestones: [
      { id: "ven-m1", name: "Critical vendors contracted", phase: "Source", ownerId: "jonah", baselineDate: at(-18), forecastDate: at(-18), status: "complete", critical: true },
      { id: "ven-m2", name: "Compliance onboarding complete", phase: "Onboard", ownerId: "jonah", baselineDate: at(7), forecastDate: at(7), status: "in_progress", critical: true },
      { id: "ven-m3", name: "Service readiness validation", phase: "Validate", ownerId: "marcus", baselineDate: at(19), forecastDate: at(19), status: "not_started", critical: false },
    ],
    workItems: [
      { id: "ven-w1", title: "Collect final insurance certificates", ownerId: "jonah", milestoneId: "ven-m2", status: "in_progress", dueDate: at(3), priority: "medium" },
      { id: "ven-w2", title: "Approve facilities service matrix", ownerId: "marcus", milestoneId: "ven-m3", status: "ready", dueDate: at(10), priority: "medium" },
      { id: "ven-w3", title: "Complete vendor escalation directory", ownerId: "jonah", milestoneId: "ven-m3", status: "in_progress", dueDate: at(12), priority: "low" },
    ], dependencies: [],
    raid: [
      { id: "ven-r1", type: "risk", title: "Snow-removal response capacity not proven", ownerId: "jonah", probability: 2, impact: 3, status: "monitoring", dueDate: at(15), response: "Conduct tabletop exercise before readiness review.", lastActionAt: at(-2), source: "Vendor readiness checklist" },
      { id: "ven-a1", type: "assumption", title: "Existing national insurance terms cover Denver", ownerId: "elena", probability: 2, impact: 2, status: "monitoring", dueDate: at(6), response: "Legal confirmation requested.", lastActionAt: at(-2), source: "Procurement plan" },
    ],
    decisions: [{ id: "ven-dec1", title: "Use two facilities vendors instead of one", status: "approved", ownerId: "jonah", approverId: "dana", rationale: "Reduces single-supplier continuity exposure.", alternatives: ["Single national vendor"], decidedAt: at(-14), impact: "No baseline impact; adds one service review." }],
    budget: [
      { id: "ven-b1", category: "Facilities services", vendor: "FrontRange Facilities", baseline: 165000, actual: 26000, committed: 139000, forecast: 164000 },
      { id: "ven-b2", category: "Fleet support", vendor: "Apex Fleet Care", baseline: 118000, actual: 18000, committed: 96000, forecast: 116000 },
      { id: "ven-b3", category: "Contingency", vendor: "Unassigned", baseline: 32000, actual: 0, committed: 0, forecast: 28000 },
    ],
    allocations: [{ actorId: "jonah", percent: 80, workstream: "Vendor readiness" }, { actorId: "elena", percent: 20, workstream: "Commercial assurance" }, { actorId: "marcus", percent: 15, workstream: "Service validation" }],
    changes: [], updates: [{ id: "ven-u1", actorId: "jonah", createdAt: at(-3), text: "All critical agreements are executed. Remaining work is evidence collection and operational validation.", kind: "weekly" }],
  };

  const training: Project = {
    id: "training", code: "MW-04", name: "Training and operating model",
    objective: "Prepare regional leaders, dispatchers, and field teams to operate the new hub and scheduling process.",
    outcome: "Ninety-five percent completion and competency validation before launch readiness approval.",
    stage: "Design", sponsorId: "dana", managerId: "simone", startDate: at(-58), targetDate: at(34), health: "amber", healthReasons: [], version: 5, updatedAt: at(-1), lastStatusAt: at(-4),
    milestones: [
      { id: "trn-m1", name: "Operating model approved", phase: "Design", ownerId: "marcus", baselineDate: at(-12), forecastDate: at(-12), status: "complete", critical: true },
      { id: "trn-m2", name: "Training content frozen", phase: "Build", ownerId: "simone", baselineDate: at(8), forecastDate: at(15), status: "in_progress", critical: true },
      { id: "trn-m3", name: "Launch cohort certified", phase: "Deliver", ownerId: "simone", baselineDate: at(28), forecastDate: at(28), status: "not_started", critical: true },
    ],
    workItems: [
      { id: "trn-w1", title: "Update dispatcher lab for revised pilot", ownerId: "simone", milestoneId: "trn-m2", status: "blocked", dueDate: at(4), priority: "high", blocker: "Stable platform build unavailable." },
      { id: "trn-w2", title: "Record facility safety walkthrough", ownerId: "marcus", milestoneId: "trn-m2", status: "ready", dueDate: at(6), priority: "medium" },
      { id: "trn-w3", title: "Confirm cohort attendance", ownerId: "simone", milestoneId: "trn-m3", status: "in_progress", dueDate: at(12), priority: "medium" },
    ],
    dependencies: [{ id: "trn-d1", fromMilestoneId: "plt-m2", toMilestoneId: "trn-m2", kind: "external", note: "Final dispatcher content depends on platform pilot configuration." }],
    raid: [
      { id: "trn-r1", type: "risk", title: "Platform changes may invalidate dispatcher training", ownerId: "simone", probability: 4, impact: 4, status: "responding", dueDate: at(6), response: "Separate stable process content from system screenshots.", lastActionAt: at(-3), source: "Curriculum review" },
      { id: "trn-i1", type: "issue", title: "Four supervisors have scheduling conflicts", ownerId: "simone", probability: 3, impact: 3, status: "responding", dueDate: at(9), response: "Add a second certification session.", lastActionAt: at(-1), source: "Attendance roster" },
    ],
    decisions: [{ id: "trn-dec1", title: "Add second certification cohort", status: "approved", ownerId: "simone", approverId: "alex", rationale: "Protect readiness while maintaining branch coverage.", alternatives: ["Require overtime", "Use self-paced training only"], decidedAt: at(-1), impact: "$9,500 forecast increase; no launch impact." }],
    budget: [
      { id: "trn-b1", category: "Content development", vendor: "Internal", baseline: 68000, actual: 41000, committed: 19000, forecast: 69000 },
      { id: "trn-b2", category: "Delivery", vendor: "Rocky Mountain Learning", baseline: 52000, actual: 12000, committed: 39000, forecast: 60500 },
      { id: "trn-b3", category: "Travel", vendor: "Multiple", baseline: 26000, actual: 9000, committed: 12000, forecast: 25000 },
    ],
    allocations: [{ actorId: "simone", percent: 110, workstream: "Curriculum and delivery" }, { actorId: "marcus", percent: 25, workstream: "Operating model" }, { actorId: "priya", percent: 20, workstream: "System labs" }],
    changes: [{ id: "trn-c1", title: "Add second supervisor cohort", status: "implemented", requestedBy: "simone", ownerId: "alex", submittedAt: at(-3), scheduleImpactDays: 0, budgetImpact: 9500, riskImpact: "Reduces staffing coverage conflict.", rationale: "Four supervisors cannot attend the primary session.", decisionNote: "Approved within training contingency." }],
    updates: [{ id: "trn-u1", actorId: "simone", createdAt: at(-4), text: "Leadership content is stable. Dispatcher modules remain linked to the revised platform pilot schedule.", kind: "weekly" }],
  };

  const projects = [hub, platform, vendors, training].map((project) => withHealth(project, now));
  const messages: Message[] = [
    { id: "msg-1", projectId: "platform", channel: "teams", status: "delivered", audience: "Mountain West leadership", subject: "Pilot exit decision required", body: "The dispatcher pilot has not met offline synchronization criteria. Approval is requested to extend the pilot by 18 days.", authorId: "alex", createdAt: at(-1) },
    { id: "msg-2", projectId: "hub", channel: "slack", status: "delivered", audience: "#denver-launch", body: "Network commissioning moved to next Tuesday. Cellular failover is approved and does not change the readiness review date.", authorId: "priya", createdAt: at(-2) },
    { id: "msg-3", projectId: "training", channel: "email", status: "preview", audience: "Regional supervisors", subject: "Certification cohort options", body: "Please select one of the two supervisor certification sessions by Friday.", authorId: "simone", createdAt: at(-1) },
  ];
  const notifications: Notification[] = [
    { id: "note-1", actorId: "alex", projectId: "platform", kind: "approval", title: "Change CR-014 needs assessment", detail: "Pilot extension requests 18 days and $64,000.", createdAt: at(-1) },
    { id: "note-2", actorId: "alex", projectId: "hub", kind: "mention", title: "Mentioned in facility stand-up", detail: "Marcus requested help securing the generator inspection slot.", createdAt: at(-1, 18) },
    { id: "note-3", actorId: "dana", projectId: "platform", kind: "approval", title: "Executive decision pending", detail: "Choose whether to extend or restrict the scheduling rollout.", createdAt: at(-1, 16) },
    { id: "note-4", actorId: "simone", projectId: "training", kind: "assignment", title: "Training lab update is blocked", detail: "Stable platform configuration is still unavailable.", createdAt: at(-2) },
  ];
  const reports: Report[] = projects.map((project, index) => ({
    id: `report-${project.id}`, projectId: project.id, period: "Week ending Aug 28", status: index === 2 ? "approved" : "draft", version: 1,
    headline: project.health === "red" ? "Decision required to protect regional release" : project.health === "amber" ? "Delivery remains viable with active exceptions" : "Delivery remains within control limits",
    summary: `${project.name} is ${project.health}. ${project.healthReasons[0]?.evidence ?? "No exception recorded."}`,
    accomplishments: project.milestones.filter((item) => item.status === "complete").map((item) => item.name),
    next: project.workItems.filter((item) => item.status !== "done").slice(0, 3).map((item) => item.title),
    decisionsNeeded: project.decisions.filter((item) => item.status === "pending").map((item) => item.title),
    evidence: project.healthReasons.slice(0, 3).map((reason) => ({ label: reason.label, entityType: "project", entityId: project.id })), updatedAt: at(-1), approvedBy: index === 2 ? "alex" : undefined,
  }));
  const files: FileRecord[] = [
    { id: "file-charter", projectId: "hub", filename: "mountain-west-program-charter.pdf", title: "Mountain West program charter", contentType: "application/pdf", assetPath: "/demo-files/mountain-west-program-charter.pdf", sizeLabel: "184 KB", version: "2.1", ownerId: "alex", updatedAt: at(-21), summary: "Approved objectives, governance, funding envelope, and success measures.", tags: ["charter", "governance"] },
    { id: "file-readiness", projectId: "hub", filename: "denver-readiness-checklist.xlsx", title: "Denver readiness checklist", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", assetPath: "/demo-files/denver-readiness-checklist.xlsx", sizeLabel: "6 KB", version: "7", ownerId: "marcus", updatedAt: at(-1), summary: "Facility, technology, staffing, and launch readiness controls.", tags: ["readiness", "facility"] },
    { id: "file-pilot", projectId: "platform", filename: "dispatcher-pilot-review.pdf", title: "Dispatcher pilot review", contentType: "application/pdf", assetPath: "/demo-files/dispatcher-pilot-review.pdf", sizeLabel: "226 KB", version: "1.4", ownerId: "priya", updatedAt: at(-2), summary: "Pilot exit criteria, defects, adoption measures, and release recommendation.", tags: ["pilot", "technology"] },
    { id: "file-budget", filename: "program-budget-forecast.xlsx", title: "Program budget forecast", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", assetPath: "/demo-files/program-budget-forecast.xlsx", sizeLabel: "8 KB", version: "5", ownerId: "elena", updatedAt: at(-1), summary: "Baseline, actual, commitment, and forecast by project and vendor.", tags: ["budget", "forecast"] },
    { id: "file-vendors", projectId: "vendors", filename: "vendor-readiness-pack.pdf", title: "Vendor readiness pack", contentType: "application/pdf", assetPath: "/demo-files/vendor-readiness-pack.pdf", sizeLabel: "142 KB", version: "3", ownerId: "jonah", updatedAt: at(-3), summary: "Contract, insurance, service-level, and escalation evidence.", tags: ["vendor", "procurement"] },
    { id: "file-notes", projectId: "training", filename: "training-design-notes.txt", title: "Training design workshop notes", contentType: "text/plain", assetPath: "/demo-files/training-design-notes.txt", sizeLabel: "6 KB", version: "1", ownerId: "simone", updatedAt: at(-4), summary: "Meeting notes used by the copilot extraction workflow.", tags: ["meeting", "training"] },
  ];
  const audit: AuditEvent[] = [
    { id: "audit-1", actorId: "priya", projectId: "platform", entityType: "risk", entityId: "plt-r1", action: "risk.updated", detail: "Escalated offline synchronization exposure to 20/25.", createdAt: at(-2) },
    { id: "audit-2", actorId: "alex", projectId: "hub", entityType: "change", entityId: "hub-c1", action: "change.approved", detail: "Approved cellular failover from program contingency.", createdAt: at(-3) },
    { id: "audit-3", actorId: "simone", projectId: "training", entityType: "decision", entityId: "trn-dec1", action: "decision.recorded", detail: "Added second supervisor certification cohort.", createdAt: at(-1) },
  ];
  return { actors, projects, messages, notifications, reports, files, audit };
}
