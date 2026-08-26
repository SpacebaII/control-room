# Case study: building an evidence-first PMO suite

## The problem

Project-management portfolios often demonstrate task creation but avoid the harder work of operational governance. The challenge was to create a credible product that could explain why a program was red, show the cost and capacity consequences, route the necessary decision, publish a report, and preserve the evidence.

## The approach

Control Room was designed around one fictional regional rollout with four interdependent projects and approximately $2.4 million of baseline work. The seed data was intentionally imperfect: a critical platform defect, a carrier delay, overallocated leads, cost pressure, stale updates, incomplete vendor evidence, and a pending sponsor change.

The delivery sequence started with a thin but complete control loop:

1. Change a milestone.
2. Recalculate project health with attributed reasons.
3. Reject stale record versions.
4. Record the actor and event.
5. Refresh the management view.

Financial controls, resources, changes, reports, communication, files, and assistance were added only after that loop worked in the browser.

## Important engineering decisions

### Versioned project aggregates

Keeping project controls together makes health recalculation and baseline implementation atomic. It also makes the first release readable for an intermediate engineer. The cost is less convenient portfolio-wide SQL analysis, which can be addressed later with derived reporting tables.

### Deterministic public assistance

The product needed a complete public AI demonstration without visitor-driven cost. A deterministic provider adapts to the current record, returns citations and proposals, and shares a contract with the private OpenAI provider. This made the safety workflow testable and honest.

### A different mobile product

The desktop experience is a control surface. The mobile experience is an action surface: assignments, approvals, messages, files, and pulse signals. Dense registers remain reachable but do not dominate the first screen.

### A design reset after the first release

The first visual system avoided familiar AI-dashboard tropes, but it overcorrected into an editorial control-room aesthetic. Numbered navigation, oversized serif titles, repeated bordered panels, and perfectly systematic labels still felt generated. The second pass started with daily decisions instead of visual style: what changed, what needs approval, what is worsening, and what should the current role do next. That produced a compact product shell, attention-first portfolio, project position strip, quieter registers, and a mobile interface that feels related without copying desktop.

## Development issues and resolutions

| Issue | Evidence | Resolution |
|---|---|---|
| Workbook headers lost contrast | Rendered PNG showed black labels on cobalt | Applied base font before semantic header styles |
| Merged titles distorted widths | Readiness register columns expanded unexpectedly | Replaced autofit with deliberate operational widths |
| Small UI labels failed AA | Axe reported exact foreground/background ratios | Darkened muted and amber tokens; fixed header hover state |
| Copilot test navigated too soon | Proposed data was not reliably observable after click | Wait for `applied` before navigation |
| Public demo could become shared state | Two visitors would otherwise mutate one seed | HMAC-signed workspace cookie plus `workspace_id` on every query |
| First production load intermittently missed seeded actors | D1 could expose a new workspace before the full aggregate was observable | Request-scoped primary session plus a bounded post-seed visibility barrier |
| First UI looked like a polished concept rather than daily software | Visual audit found presentation-scale headings, artificial numbering, and uniform panel treatment | Rebuilt information hierarchy around attention, movement, and role-specific action |
| Live assistance could bypass accountability | Direct model mutation would be difficult to audit | Proposal-only provider contract and selected-change acceptance |

## Result

Control Room now demonstrates schedule, RAID, decisions, budgets, capacity, change control, reporting, simulated communication, evidence files, audit history, responsive workflows, and bounded assistance in one deployed architecture.

The strongest portfolio lesson is that credibility comes from connected constraints. A red label matters only when a reviewer can trace it to a milestone, blocker, risk, forecast, owner, decision, and recorded response.

## Next phase

The architecture is prepared for real team authentication, R2 uploads, configurable policies, external adapters, and cross-program capacity planning. Those capabilities remain intentionally outside the public v1 threat model.
