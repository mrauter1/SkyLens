# SkyLens Serverless Migration Plan

## Objective
Create `/workspace/SkyLens/SkyLensServerless` as a standalone, full-featured SkyLens fork that preserves current UI/UX and user-visible behavior while removing app-owned server runtime dependencies from the fork.

## Hard Constraints
- Do not edit the existing root SkyLens app outside task/autoloop artifacts.
- Place all fork implementation, config, tests, and docs under `SkyLensServerless/`.
- Copy existing app files into the fork when they can be reused as-is.
- Preserve contracts, behavior, and visual parity unless an explicit clarification permits otherwise.

## Current Server-Side Inventory
- `/api/config`: exposes `getPublicConfig()`; contract is simple and can be provided in-process in the fork.
- `/api/tle`: server-side fetches, deduplicates, validates, caches, and serves TLE catalog data with freshness metadata.
- `/api/health`: exposes app status plus TLE cache status for viewer copy.
- `/view` page currently parses `searchParams` as an async server page shape; the fork must remain static-safe.

## Clarified Assumptions
- The fork may use browser-accessible replacement live-data sources or a third-party hosted proxy/service when required to preserve capability and behavior.
- Intentional live-data degradation via static bundled catalogs is not allowed without a new explicit clarification.
- Matching the exact current upstream providers is not required; matching behavior and capability is required.
- Provider/proxy substitutions are not allowed to silently invalidate existing privacy or data-flow promises; if the selected plumbing changes where aircraft or satellite requests go, the fork must update the affected copy, tests, and parity documentation to keep the user-visible contract truthful.

## Target Architecture
- `SkyLensServerless/` is a standalone Next app with its own package/build/test config, copied from the root app as the baseline.
- Keep shared contracts/schemas (`lib/*/contracts.ts`) and UI components equivalent unless a fork-specific change is required for serverless operation.
- Remove `app/api/*` from the fork and replace route consumers with in-process browser services that keep the same payload shapes:
  - Config: direct `getPublicConfig()` usage or an equivalent browser-safe build constant.
  - Satellites: browser-side catalog loader returning the existing `TleApiResponse` contract.
  - Health: browser-side cache health derivation returning the existing `HealthApiResponse` contract.
- Preserve freshness semantics for satellite data: 6-hour refresh window, 24-hour stale fallback window, same `fresh|stale|expired|empty` states, and same viewer status copy.
- Treat privacy/data-flow messaging as part of parity: either preserve browser-direct provider behavior where the copy is provider-specific, or update the landing/viewer reassurance copy and its tests when a hosted proxy or different provider changes the request path.
- Make `/view` static-safe by moving route-state parsing to a client-safe path while preserving existing query param semantics.
- Preserve the live AR permissions policy contract in the fork through fork-local hosting/config artifacts rather than root app configuration.

## Implementation Milestones
### 1. Standalone Fork Bootstrap
- Copy the current app, public assets, tests, and config needed for an independent build into `SkyLensServerless/`.
- Keep the copied baseline behaviorally identical before serverless substitutions.
- Establish fork-local scripts for build, unit tests, and e2e tests.

### 2. Serverless Data and Runtime Migration
- Replace `app/api/config` usage with in-process config bootstrap in the fork.
- Replace `/api/tle` with a browser-side satellite catalog service that:
  - fetches live data from approved browser-safe replacement plumbing,
  - validates and deduplicates with existing schemas,
  - stores freshness metadata locally,
  - preserves stale fallback behavior.
- Replace `/api/health` polling with local health derivation from the same cache metadata so the viewer status labels remain equivalent.
- Explicitly validate the chosen live-data plumbing against the current privacy/data-flow promises before implementation closes:
  - if aircraft requests still go directly from the browser to OpenSky, retain the current reassurance copy;
  - otherwise, update the affected copy and parity docs so the fork does not ship false assurances.
- Remove remaining fork-local server assumptions from `/view`, metadata, and embed/header handling.

### 3. Parity Verification and Documentation
- Adapt or add tests inside `SkyLensServerless/` for:
  - config contract parity,
  - satellite catalog contract and stale/fresh behavior,
  - viewer integration for local health status,
  - static-safe route parsing,
  - embed/header expectations for the fork,
  - build and run success for the standalone fork.
- Add a parity document mapping each original server-side feature to its serverless replacement and validation method.

## Interface Definitions
- `SkyLensServerless/lib/config.ts` (or equivalent): must continue exporting `getPublicConfig()` and `EnabledLayer`-compatible types so existing consumers need minimal change.
- `SkyLensServerless/lib/satellites/contracts.ts`: keep `TleApiResponseSchema` and `TleSatelliteSchema` unchanged unless an implementation detail forces additive-only metadata.
- `SkyLensServerless/lib/satellites/client.ts`: should remain the viewer-facing entry point; it may stop calling `/api/tle`, but it must still return `TleApiResponse`.
- `SkyLensServerless/lib/health/contracts.ts`: keep `HealthApiResponseSchema` and cache status vocabulary unchanged so viewer status copy and tests stay aligned.
- `SkyLensServerless/components/viewer/viewer-shell.tsx`: continue reading aircraft/satellite/config/health through stable local helpers, not route handlers.
- `SkyLensServerless/lib/config.ts` and landing/viewer copy exports: treat privacy reassurance copy as a compatibility surface that must stay truthful to the selected provider/proxy path.

## Compatibility / Migration Notes
- Local storage/cache keys in the fork should be namespaced separately from the root app to avoid accidental cross-app state coupling.
- Any build-version injection used by the fork must be browser-safe and deterministic in production/test.
- If deployment headers are needed for embed/live-permission parity, keep the config inside `SkyLensServerless/` and document the expected host behavior.
- The fork must not depend on root-level imports at runtime; copied files should resolve within `SkyLensServerless/`.
- If the selected live-data plumbing changes request destinations or intermediaries, update provider-specific privacy/data-flow copy and cover it with fork-local tests; do not leave OpenSky-specific copy in place if a proxy or alternate provider is introduced.

## Regression Prevention
- Reuse existing schemas, motion logic, UI components, and fixtures wherever possible to avoid behavioral drift.
- Keep viewer-facing payload shapes unchanged even if the transport/source changes.
- Verify stale-cache transitions with deterministic clock-controlled tests.
- Verify `/view` query-state parity with direct route tests and e2e navigation.
- Verify no fork tests import root-app route handlers after the migration.
- Verify landing/viewer reassurance copy remains truthful for the chosen data path and that provider/proxy substitutions do not introduce silent privacy-contract drift.

## Validation Plan
- Unit: config contract, satellite provider normalization/deduping, cache health derivation, static route parsing, viewer health/status integration, and provider/proxy-dependent reassurance copy.
- E2E: landing, demo, permissions fallbacks, embed validation, serverless live-view startup shell, and privacy/data-flow copy visibility.
- Build/run: `SkyLensServerless` installs, builds, and starts independently.
- Documentation: parity matrix completed for each original server-side feature, its replacement, and any provider/proxy-driven copy changes.

## Risk Register
- Live data source risk: replacement browser-safe provider/proxy may differ subtly from current upstream payloads.
  - Control: preserve current contracts and normalization layer; fixture-test edge cases and stale/fresh behavior.
- Privacy-contract risk: a hosted proxy or alternate provider can make existing OpenSky-specific reassurance copy false.
  - Control: treat reassurance copy as a compatibility surface, require explicit provider/path review, and test/document any copy changes.
- Static/export risk: App Router route parsing or metadata may still assume server rendering.
  - Control: explicitly test `/view` query handling and standalone build output.
- Header parity risk: permissions-policy behavior can regress if fork-local hosting config is omitted.
  - Control: keep fork-local header config and cover it with unit/e2e checks.
- State-coupling risk: shared browser storage keys between root and fork can cause confusing settings/caches.
  - Control: fork-local storage key namespace and migration tests.

## Rollback
- Keep the fork isolated so any failed serverless migration can be reverted by removing or replacing files inside `SkyLensServerless/` only.
- Preserve copied baseline tests/fixtures so implementers can compare against the root app during rollback or rework.
