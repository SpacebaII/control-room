# ADR 001: Cloudflare Worker and D1

Status: accepted

Use one Cloudflare Worker to serve the SPA and API, with D1 for relational state and Static Assets for seeded evidence.

This keeps deployment and free-tier operations simple while preserving SQL migrations, transactions, scheduled cleanup, and a clean path to future authentication. The tradeoff is accepting Worker runtime constraints and D1's deployment model instead of a conventional long-running server.
