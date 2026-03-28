# Implementation Notes

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: implement
- Phase ID: cleanup-tests-and-validation
- Phase Directory Key: cleanup-tests-and-validation
- Phase Title: Cleanup, Tests, and Validation
- Scope: phase-local producer artifact
- Files changed:
  `app/api/health/route.ts`, `lib/health/contracts.ts`, `tests/unit/health-route.test.ts`, `tests/unit/viewer-settings.test.tsx`, `tests/unit/viewer-shell.test.ts`, `SkyLensPRD.md`
- Files deleted:
  `app/api/aircraft/route.ts`, `lib/aircraft/opensky.ts`, `tests/unit/aircraft-layer.test.ts`
- Symbols touched:
  `GET` health route, `HealthApiResponseSchema`, `/api/health` test fixtures, viewer aircraft snapshot test helper
- Checklist mapping:
  Milestone 3 cleanup/compatibility/validation completed for server aircraft deletion, health cleanup, stale docs removal, test updates, and full validation commands
- Assumptions:
  Existing `tests/unit/aircraft-client.test.ts`, `tests/unit/aircraft-tracker.test.ts`, and `tests/unit/viewer-shell.test.ts` already provide the replacement coverage required for browser-direct aircraft behavior
- Preserved invariants:
  Satellite cache health semantics unchanged; privacy copy remains browser-direct/on-device; no non-aircraft runtime behavior changed
- Intended behavior changes:
  `/api/health` no longer exposes `aircraftCache`; server aircraft route/module are removed; docs no longer describe OpenSky auth or `/api/aircraft`
- Known non-changes:
  Existing lint warnings in settings/alignment/viewer hooks were left unchanged because they predate this phase and do not fail validation
- Expected side effects:
  Tests and docs now treat browser-direct aircraft fetching plus tracker-driven rendering as the only supported architecture
- Validation performed:
  `npm test` ✅
  `npm run lint` ✅ (warnings only)
  `npm run build` ✅
