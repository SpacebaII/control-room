# Architecture

## Boundaries

- `src/domain` contains stable record types and pure project-health rules.
- `src/application` coordinates permissions, state transitions, audits, and provider ports.
- `worker` adapts HTTP, D1, signed sessions, GitHub OAuth, OpenAI, and Static Assets.
- `src/components` renders the responsive client and code-native operational visuals.

The application layer does not import D1 or vendor SDKs. Infrastructure implements repository and provider contracts.

## Storage strategy

Projects are stored as versioned aggregates in D1. That makes schedule, RAID, budget, allocation, and change transitions atomic within one optimistic-concurrency boundary. High-volume or independently queried records—messages, notifications, reports, files, copilot runs, usage, and audit events—have dedicated tables.

Every tenant-owned record includes `workspace_id`. Every mutation identifies an actor and records an audit event.

## Request lifecycle

1. The Worker validates or creates a signed 24-hour demo session.
2. Zod validates path-specific input.
3. The application service resolves the simulated actor and enforces role permissions.
4. The repository compares the submitted project version.
5. Domain health is recalculated with machine-readable reasons.
6. D1 persists the new version and an audit event.
7. The response includes `Cache-Control: no-store` and an audit correlation ID.

Stale writes return `409 VERSION_CONFLICT` with the current server record.

## Assistance providers

`CopilotProvider` has deterministic and OpenAI implementations. Both return the same proposal contract: summary, warnings, confidence, evidence citations, and proposed changes. Application code applies only explicitly selected proposal changes.

The live adapter is accessible only through a signed, allowlisted GitHub owner session. The OpenAI key remains a Worker secret. Inputs and outputs are bounded; provider storage is disabled; usage is recorded by UTC date.

## Responsive strategy

Desktop presents the full control plane. Mobile uses a different information hierarchy—Today, Inbox, Files, More—while keeping detailed registers reachable. The client has no separate state-management layer; server state is refreshed after mutations, and optimistic concurrency protects conflicting sessions.
