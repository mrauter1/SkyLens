# Implementation Notes

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: implement
- Phase ID: tracker-viewer-integration
- Phase Directory Key: tracker-viewer-integration
- Phase Title: Tracker and Viewer Integration
- Scope: phase-local producer artifact

## Files Changed
- `lib/aircraft/tracker.ts`
- `lib/viewer/motion.ts`
- `components/viewer/viewer-shell.tsx`
- `lib/demo/scenarios.ts`
- `lib/config.ts`
- `lib/aircraft/client.ts`
- `lib/aircraft/contracts.ts`
- `lib/aircraft/opensky-browser.ts`
- `tests/unit/aircraft-tracker.test.ts`
- `tests/unit/viewer-motion.test.ts`
- `tests/unit/viewer-shell.test.ts`

## Symbols Touched
- `createAircraftTracker`, `AircraftTracker`, `ResolvedTrackedAircraft`, `AircraftTrailPoint`
- `resolveAircraftMotionObjects`, `resolveMovingSkyObjects`
- `ViewerShell`, `buildSceneSnapshot`, `getAircraftPollDelayMs`
- `getDemoAircraftSnapshotAtTime`
- `POLL_INTERVAL_MS_BY_QUALITY`, `PRIVACY_REASSURANCE_COPY`, `DEFAULT_AIRCRAFT_RADIUS_KM`, `MIN_AIRCRAFT_ELEVATION_DEG`

## Checklist Mapping
- Plan milestone 2 / tracker: implemented `lib/aircraft/tracker.ts` with bounded history, weighted estimation, hysteresis, prediction, stale fade/drop, and trail sampling.
- Plan milestone 2 / motion: rewired aircraft motion adapters to resolve from `AircraftTracker`; satellite propagation path preserved.
- Plan milestone 2 / viewer: removed live aircraft temporal snapshot state, added tracker ref/revision/availability/latest snapshot tracking, abortable polling, visibility gating, quality-based cadence, and focused aircraft trail rendering.
- Plan milestone 2 / demo-config: added deterministic demo snapshot projection and public aircraft cadence/privacy constants.
- Phase-local test coverage: added tracker tests and rewrote motion/viewer tests for tracker-driven behavior.

## Assumptions
- High-quality live polling should align to the next OpenSky 10-second bucket with a small post-boundary offset instead of polling immediately on every state update.
- Demo scenarios can remain single seed snapshots as long as the viewer synthesizes deterministic follow-up snapshots from that seed for tracker ingest.

## Preserved Invariants
- Satellite catalog fetch/render logic remains unchanged apart from aircraft-adjacent type fallout.
- Failed live aircraft fetches degrade availability without clearing tracker state or ingesting empty placeholder snapshots.
- Motion-affordance overlays remain separate from the new aircraft trail overlay.

## Intended Behavior Changes
- Aircraft motion now comes exclusively from tracker resolution rather than previous/current snapshot interpolation.
- Focused aircraft render projected tracker trails; sustained turns can curve visually.
- Privacy copy now states browser-direct OpenSky queries and no camera-frame uploads.
- High-quality live polling now falls back to the normal 10-second delay when the most recent successful OpenSky bucket is already stale, preventing retry bursts after delayed or failed responses.

## Known Non-Changes
- Server aircraft route, OpenSky compatibility shim removal, health cleanup, and repo-wide stale-reference cleanup were intentionally left for later phases per phase scope.
- Existing repo-wide hook dependency warnings in `viewer-shell.tsx` were not broadened in this phase.

## Expected Side Effects
- Demo aircraft stay alive and continue moving via deterministic synthetic tracker ingests instead of fading out after 30 seconds.
- Motion quality now changes aircraft poll cadence in live mode.

## Validation Performed
- `npx vitest run tests/unit/aircraft-client.test.ts tests/unit/aircraft-tracker.test.ts tests/unit/viewer-motion.test.ts tests/unit/viewer-shell.test.ts`
- `npm run build`
- `npm test` currently fails only in legacy aircraft-layer coverage that still expects `/api/aircraft`, auth/cache fallback behavior, and pre-tracker snapshot interpolation; that cleanup remains for later scoped phases.

## Deduplication / Centralization
- Aircraft prediction, stale fade/drop, and trail generation are centralized in `lib/aircraft/tracker.ts`; `viewer-shell` and `motion` only orchestrate polling/rendering around the tracker contract.
