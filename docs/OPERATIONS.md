# Operations

## Cloudflare resources

- Worker: `control-room-pmo`
- D1: dedicated `control-room-db`
- Static Assets: Vite client and synthetic evidence files
- Cron: expired-workspace cleanup at 03:17 UTC

## First deployment

1. Create a D1 database with `wrangler d1 create control-room-db`.
2. Copy its ID into `wrangler.jsonc`.
3. Apply migrations with `npm run db:remote`.
4. Set required secrets with `wrangler secret put`.
5. Run `npm run deploy`.
6. Configure the deployed OAuth callback and verify owner sign-in.
7. Run the critical browser workflows against the HTTPS URL.

## Rollback

Use Cloudflare Worker version rollback for application code. D1 migrations are forward-only; a corrective numbered migration is preferred over destructive rollback. Synthetic sessions are disposable and can expire naturally.

## Free-tier controls

Workspaces expire after 24 hours, resets affect one workspace, cleanup runs daily, public assistance is deterministic, owner AI is allowlisted, and the daily run quota is enforced atomically in D1.
