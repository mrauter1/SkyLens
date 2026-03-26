# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: demo-polish-and-verification
- Phase Directory Key: demo-polish-and-verification
- Phase Title: Demo mode, polish, and verification
- Scope: phase-local producer artifact

## Files changed

- `lib/demo/scenarios.ts`
- `lib/permissions/coordinator.ts`
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `lib/health/contracts.ts`
- `app/api/health/route.ts`
- `lib/aircraft/opensky.ts`
- `lib/satellites/tle.ts`
- `lib/satellites/client.ts`
- `lib/vendor/satellite.ts`
- `tests/fixtures/demo/tokyo_iss.json`
- `tests/unit/demo-scenarios.test.ts`
- `tests/unit/health-route.test.ts`
- `tests/unit/permission-coordinator.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/e2e/demo.spec.ts`
- `next-env.d.ts` (Next-generated typing refresh after build)

## Symbols touched

- `DEMO_SCENARIOS`, `getDemoScenario`, `listDemoScenarios`
- `ViewerRouteState.demoScenarioId`, `createDemoViewerState`, `createDemoViewerRoute`, `buildViewerHref`, `parseViewerRouteState`
- `ViewerShell`
- `SettingsSheet`
- `getAircraftCacheHealth`
- `getTleCacheHealth`
- `HealthApiResponseSchema`
- `/api/health GET`

## Checklist mapping

- M7 demo scenarios / offline-safe seeded data: completed via `lib/demo/scenarios.ts` and `tests/fixtures/demo/tokyo_iss.json`
- M7 trails / reduced motion / double-tap / desktop fallback polish: completed in `components/viewer/viewer-shell.tsx`
- M7 keyboard accessibility / settings focus trap: completed in `components/settings/settings-sheet.tsx` and viewer keyboard pan handling
- M7 cache health endpoint / status surfacing: completed in `app/api/health/route.ts`, `lib/aircraft/opensky.ts`, `lib/satellites/tle.ts`, viewer/settings surfacing
- M7 full verification coverage: completed with new unit + Playwright coverage and successful required script runs

## Assumptions

- Demo-scenario selection can live on the existing `/view` route as a query-backed viewer state extension without violating v1 scope.
- The bottom dock remains the center-lock surface, while label taps may also open the separate selected-object card for the same object.

## Preserved invariants

- Demo mode still uses the shared normalization, projection, ranking, and detail-card pipeline.
- Aircraft degraded behavior remains HTTP 200 with `availability: degraded`.
- TLE stale serving semantics remain 6h fresh + up to 24h stale.
- Manual pan still uses the normalized `CameraPose` contract and double-tap recenter behavior.

## Intended behavior changes

- Demo mode now has deterministic San Francisco, New York, and Tokyo scenarios with seeded bundled data and a route-addressable selector.
- `/api/health` now reports app health plus aircraft/TLE cache freshness, and the viewer surfaces subtle cache-state messaging.
- Settings now behave like an accessible trapped-focus dialog on desktop and expose demo-scenario switching.
- Viewer overlays now keep chrome interactive without blocking label taps, and focused object trails respect reduced-motion preferences.

## Known non-changes

- Live data polling cadence, ranking budgets, detail-card fields, and layer visibility thresholds were not broadened beyond the approved PRD.
- Satellite rendering still hides the layer gracefully when no live/stale catalog exists; it does not escalate to the critical astronomy fallback.

## Expected side effects

- `next build` refreshed `next-env.d.ts`.
- Demo mode advances deterministically from the bundled scenario timestamp at 1 Hz, enabling stable trails without using wall-clock time as the seed.

## Validation performed

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

## Deduplication / centralization

- Centralized demo scenario data and route parsing in `lib/demo/scenarios.ts` + permission coordinator rather than adding a separate demo-only viewer path.
- Centralized `satellite.js` JS-only imports behind `lib/vendor/satellite.ts` to keep build-specific package workarounds out of feature code.
