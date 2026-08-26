# Development journal

## Foundation

The first design decision was to model workspace and actor ownership before building screens. That prevented the public demo from becoming a shared mutable database and kept a future real-team authentication model possible without replacing every table.

Projects use versioned aggregates because health depends on schedule, blockers, risk, forecast, and allocation together. This was simpler and safer for the first release than splitting every control into independently updated tables. Messages, reports, files, usage, and audits remain separate because they have different lifecycles.

## First vertical slice

The initial end-to-end path was milestone movement to health recalculation to audit evidence. Browser testing moved a dispatcher milestone seven days and verified that the project advanced from version 7 to version 8. That proved persistence, optimistic concurrency, and client refresh before financial controls were added.

## Visual system

The application avoided a stock dashboard shell. The visual language uses square geometry, thin rules, report typography, compact operational labels, and asymmetric grids. Charts are code-native SVG and CSS. Generated imagery is confined to one launch cover.

The first accessibility scan failed several small labels. Amber was visually clear but did not meet AA contrast on the warm background, muted table headings were slightly below threshold, and a dark-header reset button inherited a light hover surface. The fix changed shared palette tokens and a specific dark-header hover rule. The same test now passes on desktop and mobile.

The first complete release was functional but still looked like an editorial dashboard concept. The oversized serif heading, numbered navigation, lettered panels, uniform beige surfaces, and constant border treatment made the interface feel designed for a screenshot rather than used throughout a working day. The revamp changed the hierarchy before changing decoration: approvals and risks now lead the portfolio, the global chrome became compact, navigation gained a purpose-built icon set, and project pages gained an immediate schedule, forecast, risk, and milestone position.

The redesign deliberately keeps serif typography inside printable reports. Operational screens use one system sans family, selective surface depth, a dark navigation rail, and one blue interaction color. Rust and amber now appear only when a record carries a real exception. A second Axe pass caught several small muted labels that fell just below 4.5:1 against the cleaner white surfaces; shared label tokens were darkened rather than making individual exceptions.

## Evidence artifacts

The first workbook render caught issues that a file-open check would have missed: a late font pass removed header contrast and a merged title distorted column widths. The builder was corrected to apply base fonts before semantic headers and to use deliberate widths. PDFs were rendered page by page and checked for clipping, hierarchy, footers, and synthetic-data notices.

## Assistance safety

Public workflows use deterministic, project-aware rules. The owner provider uses GitHub OAuth with state and PKCE, exact allowlisting, signed sessions, a UTC quota, bounded evidence, structured output, and disabled provider storage.

The first selective-application browser test appeared to fail after the proposal showed `applied`. The underlying record was present; the assertion included punctuation that the rendered title did not. Inspecting the accessibility snapshot confirmed the persistence path and corrected the overly specific test. The workflow also waits for the applied state before navigation so a route change cannot interrupt an in-flight request.

## Release hardening

The first production browser run exposed a D1 consistency issue that local SQLite could not reproduce reliably. The repository is now created from a request-scoped D1 session anchored to the primary, which guarantees read-after-write consistency throughout each workflow, and workspace creation includes a bounded visibility check before returning.

A 20-repeat production stress run isolated the remaining race to reset rather than creation. Reset deleted the old records in one D1 batch and inserted the seed in a second; a concurrent request could observe the valid workspace between those transactions with no actors or projects. Deletion, expiry update, and reseeding now execute in one atomic batch, followed by the same seed visibility check.

An earlier deployment attempt also reused a generated Wrangler manifest containing the placeholder database ID. The remote schema had applied correctly, but Cloudflare rejected the Worker upload. Rebuilding the Vite Worker output before deployment corrected the binding without putting a broken release online.

## Quality position

The repository maintains domain tests, application workflow tests, two-session isolation, browser acceptance coverage, accessibility checks, responsive overflow checks, security headers, stale-version conflicts, and proof that public copilot runs never contact OpenAI.
