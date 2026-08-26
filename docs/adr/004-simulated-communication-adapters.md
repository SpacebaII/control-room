# ADR 004: Simulated communication adapters

Status: accepted

Slack, Teams, and email are implemented as in-product simulations behind one delivery workflow. Every message requires preview and approval, updates a transcript, creates notifications, and records an audit event.

This proves the workflow without contacting third parties or requiring paid integrations. Future adapters can replace delivery infrastructure without changing application use cases. The UI always states that no external transmission occurred.
