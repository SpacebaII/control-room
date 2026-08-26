# Building Control Room: a PMO demo that behaves like an operating system

Most portfolio project-management apps demonstrate CRUD around a board. I wanted to build the harder layer: the operating controls that connect a slipped milestone to risk, cost, capacity, decisions, communication, reporting, and evidence.

Control Room is a fictional but complete Mountain West regional rollout. Four projects share approximately $2.4 million of baseline work, seven simulated roles, vendors, dependencies, risks, changes, reports, and files.

## Start with the control loop

The first vertical slice was deliberately narrow: update a milestone, recalculate health, reject stale versions, write an audit event, and refresh the portfolio. That path established the architecture before I added more screens.

Project health never exists as an unexplained color. Each result carries machine-readable reasons. A critical slip over 14 days is red. Forecast pressure over 10 percent is red. Smaller slips, 3-10 percent forecast pressure, stale reporting, overloaded allocations, and stale high-risk actions are amber.

## Keep the public demonstration isolated and free

Every visitor receives a random 24-hour workspace in Cloudflare D1. The workspace ID is stored in an HMAC-signed, HTTP-only cookie, and every repository query includes that ID. A browser test opens two independent contexts, mutates one, and verifies the other did not change.

Public copilot workflows use deterministic rules and templates. They respond to the current record but make no model request. The owner-only provider uses GitHub OAuth, an exact username allowlist, a 20-run UTC quota, bounded synthetic evidence, structured JSON, and disabled response storage.

Both providers return the same thing: a proposal with citations, confidence, warnings, and proposed records. Neither provider can mutate the project directly.

## Design mobile around the job, not the desktop layout

Desktop is the full control plane. Mobile opens to Today, Inbox, Files, and More. The first screen focuses on assignments, blockers, approvals, and pulse signals. Dense financial tables and timelines still exist, but they do not lead the mobile experience.

## Render the evidence

The application includes synthetic PDFs and Excel workbooks. Rendering them mattered. The first spreadsheet preview showed that a global font pass had removed header contrast and that a merged title had distorted column widths. Those were corrected before the files became application assets.

The same principle applied to the UI. Axe found small-label contrast failures that looked acceptable at a glance. Shared palette tokens were adjusted until the desktop and mobile surfaces passed serious and critical checks.

## The architecture

The stack is intentionally small: React 19, TypeScript, Vite, one Cloudflare Worker, D1, Static Assets, Zod, Vitest, and Playwright. There is no component library, chart framework, external font service, state-management framework, production AI SDK, or charting dependency.

The main tradeoff is project aggregates. Schedule, work, RAID, budget, capacity, and changes live in one versioned project record. That makes health recalculation atomic and understandable. Messages, reports, files, usage, and audits use separate tables because they have independent lifecycles.

## What the case study demonstrates

The product is useful as a PMO simulation, but the portfolio value is in the connected decisions:

- product scope that avoids fake integrations
- architecture that preserves future team ownership
- deterministic fallbacks that keep demos free
- explicit approval authority
- concurrency rather than last-write-wins
- evidence that survives into reports and audits
- accessibility and responsive behavior tested in the browser

Repository: [GITHUB_URL]

Live application: [DEPLOYMENT_URL]
