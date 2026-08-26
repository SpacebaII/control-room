# Data dictionary

| Record | Purpose | Ownership and concurrency |
|---|---|---|
| Workspace | Isolated 24-hour visitor tenant | Signed cookie; expiry cleanup |
| Actor / role | Simulated team identity and permission source | Workspace-scoped |
| Project | Versioned control aggregate | `workspace_id`, manager, sponsor, record version |
| Milestone | Baseline and forecast gate | Owned by actor; project version |
| Work item | Executable package or task | Owner, status, due date, blocker |
| Dependency | Milestone relationship | Source and target milestone IDs |
| RAID item | Risk, assumption, issue, or dependency | Owner, exposure, response, age, evidence |
| Decision | Alternatives, rationale, approver, and effect | Sponsor decision transition |
| Budget line | Baseline, actual, committed, and forecast | Vendor/category; project version |
| Allocation | Actor capacity by workstream | Percentage; project version |
| Change request | Controlled baseline exception | Requester, owner, impacts, approval status |
| Update | Dated project evidence | Actor and kind |
| Message | Slack, Teams, or email simulation | Preview before simulated delivery |
| Notification | Persona-specific attention item | Actor and optional project |
| Report | Evidence-backed weekly status | Draft, review, approved, published |
| File record | Versioned synthetic evidence metadata | Static asset boundary and project relation |
| Copilot run | Provider proposal and acceptance state | Actor, citations, model, usage metadata |
| Audit event | Immutable activity evidence | Actor, correlation context, entity, detail |
| AI usage | Owner daily quota and token counts | GitHub login and UTC date |

## Health calculations

- Risk exposure: probability `1-5` multiplied by impact `1-5`.
- Low `1-7`, medium `8-14`, high `15-25`.
- Red: overdue critical blocker, critical slip over 14 days, forecast over baseline by more than 10%, or overdue unmitigated high risk.
- Amber: slip of 1-14 days, forecast variance of 3-10%, stale update, allocation over 100%, or stale high-risk action.
- Green: no red or amber rule applies.

An active manager override replaces calculated health only until its expiration and always requires a recorded reason.
