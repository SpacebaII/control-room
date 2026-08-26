# ADR 002: Versioned project aggregates

Status: accepted

Store project controls as a JSON aggregate with a server-managed version while keeping messages, reports, files, usage, and audits in separate tables.

Project health depends on milestones, work, risk, budget, and capacity at once. An aggregate makes those recalculations atomic and keeps the first release understandable. Optimistic concurrency prevents silent overwrites. The tradeoff is less efficient cross-project SQL analytics; future reporting tables can be derived without changing the application contract.
