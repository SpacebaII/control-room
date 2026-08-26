# Security model

## Tenant isolation

Demo sessions use a random workspace ID inside an HMAC-signed, HTTP-only, SameSite cookie. Queries and mutations bind every record access to that workspace. Browser tests create two independent contexts and prove that mutations do not cross the boundary.

## Mutation controls

- Zod validation at every JSON boundary
- 64 KB request-body limit
- origin checks on state-changing requests
- simulated role authorization in the application layer
- optimistic record versions with `409` conflicts
- immutable audit events
- `Cache-Control: no-store` on API and authentication responses

## Owner authentication

GitHub OAuth uses authorization code flow, random state, PKCE S256, a ten-minute state record, exact callback URLs, and post-token identity revalidation. Only `GITHUB_ALLOWED_LOGIN` receives an eight-hour signed owner cookie. GitHub tokens are not persisted.

## Live AI

- OpenAI key stored only as a Worker secret
- owner-only access and 20-run UTC quota
- bounded synthetic evidence and output size
- structured JSON schema
- provider response storage disabled
- no automatic project mutation
- selected proposal changes require explicit acceptance
- provider, model, citations, proposal, usage, and disposition retained in the workspace audit record

## Browser policy

The Worker sets CSP, frame denial, MIME sniffing protection, restrictive permissions policy, and strict-origin referrer policy. Synthetic downloads are resolved only from database-backed file records to known Static Asset paths.

## Out of scope for v1

Real users, external delivery adapters, file uploads, billing, and sensitive production records are intentionally absent. These require a separate threat model before implementation.
