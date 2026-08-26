# Launch report

Status: shipped and production-verified on August 26, 2026

## Product delivered

- Four-project synthetic regional rollout
- Desktop portfolio and complete project-control workspaces
- Mobile-specific Today, Inbox, Files, and More navigation
- Workspace isolation, signed sessions, reset, and scheduled cleanup
- Versioned mutations, role permissions, health reasons, and audit history
- Budget, allocation, decision, change, report, communication, and file workflows
- Deterministic public and owner-only live copilot providers
- Three PDFs, two Excel workbooks, one design-note file, and launch imagery

## Verification evidence

- Domain and provider tests with coverage thresholds
- Application permission and proposal tests
- Multi-context session-isolation test
- Browser workflows for schedule, budget, capacity, change, reports, communication, copilot, files, and mobile
- Serious and critical accessibility checks on desktop and mobile
- Overflow checks at 390, 430, 768, 1024, and 1440 pixels
- Client JavaScript below the 180 KB gzip target
- Three consecutive local browser suites: 42/42 workflows passed
- Production browser suite: 14/14 workflows passed
- Production reset and first-read stress run: 20/20 repetitions passed
- Route-wide console audit: no errors across every primary workspace

## Deployment record

- Application: https://control-room-pmo.spacebaii-portfolio.workers.dev
- GitHub: https://github.com/SpacebaII/control-room
- Worker version: `fec2688c-b371-4ca2-9996-aaa9196c910e`
- D1 database: `control-room-db` (`507927ab-68d7-49db-a9b0-c2aa971c6ae2`)
- Client JavaScript: 86.44 KB gzip
- Security headers verified in the production browser suite
- Public copilot verified to make no OpenAI request
- Owner mode remains safely disabled until GitHub OAuth and OpenAI secrets are configured
