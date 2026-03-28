# Implement ↔ Code Reviewer Feedback

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: implement
- Phase ID: tracker-viewer-integration
- Phase Directory Key: tracker-viewer-integration
- Phase Title: Tracker and Viewer Integration
- Scope: phase-local authoritative verifier artifact

## Findings

- IMP-001 | blocking | [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L1374) / `getAircraftPollDelayMs()`: high-quality polling can collapse into a 250ms retry loop whenever `snapshotTimeS` is already behind the current bucket, and the failure path explicitly reuses the last successful `snapshotTimeS`. In practice, one delayed or failed OpenSky response in `high` mode can cause rapid-fire anonymous browser retries that violate the intended 10-second cadence and materially increase the rate-limit risk this refactor was supposed to manage. Minimal fix: if the bucket derived from `snapshotTimeS` is already in the past, fall back to the standard 10-second delay (or compute the next boundary from `nowMs`) instead of clamping to 250ms.

- IMP-002 | blocking | [lib/aircraft/tracker.ts](/workspace/SkyLens/lib/aircraft/tracker.ts#L606) / `updateTurnState()`: the tracker does not implement the requested “enter after 2 consecutive intervals > 0.8 deg/s, exit after 2 consecutive intervals < 0.3 deg/s” hysteresis. It feeds a weighted average turn rate across the whole estimation window into the enter/exit counters, so one sharp turn followed by straight segments can still keep the average above threshold and incorrectly latch turn mode, while short real turns can be averaged away and missed. This is a direct contract miss for the tracker behavior and will produce incorrect curved-vs-straight prediction decisions. Minimal fix: compute/store per-interval observed turn rates and drive the hysteresis counters from the latest consecutive interval measurements instead of the smoothed window average.

- IMP-003 | non-blocking | Repo validation: `npm test` is still red only in legacy aircraft-layer coverage that intentionally targets the old `/api/aircraft`, auth/cache shim, and snapshot-interpolation behavior. This is consistent with later scoped cleanup, but it should remain explicitly tracked so the next phase removes or rewrites those legacy expectations instead of treating the failures as incidental.

## Follow-up Review

- IMP-004 | non-blocking | Follow-up review: IMP-001 is resolved. `getAircraftPollDelayMs()` now falls back to the normal high-quality 10-second cadence when the last successful bucket is already stale, and the added `viewer-shell` regression test covers the no-250ms-retry case after a failed poll.

- IMP-005 | non-blocking | Follow-up review: IMP-002 is resolved. Tracker hysteresis now uses the newest per-interval observed turn-rate sample for consecutive enter/exit counting, while the smoothed multi-interval turn-rate estimate remains limited to prediction. Added tracker coverage verifies both sustained-turn entry/exit and the “single sharp turn then straight” non-latching case.
