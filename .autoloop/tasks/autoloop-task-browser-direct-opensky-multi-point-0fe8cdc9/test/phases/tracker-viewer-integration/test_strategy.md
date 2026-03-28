# Test Strategy

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: test
- Phase ID: tracker-viewer-integration
- Phase Directory Key: tracker-viewer-integration
- Phase Title: Tracker and Viewer Integration
- Scope: phase-local producer artifact

## Behavior-to-Coverage Map

- Tracker prediction and decay
  - `tests/unit/aircraft-tracker.test.ts`
  - Covers straight prediction, observed-kinematics fallback, stale fade/prune, missed-poll decay, curved trails, sustained turn enter/exit, and the non-latching single-sharp-turn case.

- Aircraft motion adapter
  - `tests/unit/viewer-motion.test.ts`
  - Covers tracker-driven aircraft resolution plus preserved satellite propagation behavior and shared moving-object assembly.

- ViewerShell polling and tracker integration
  - `tests/unit/viewer-shell.test.ts`
  - Covers tracker ingest on successive live polls, failure retention without tracker clear, high-quality stale-bucket cadence fallback, tracker-provided focused aircraft trail rendering, privacy copy, and existing selected-object/stale metadata presentation.

- Browser-direct aircraft fetch contract
  - `tests/unit/aircraft-client.test.ts`
  - Preserved from the prior phase and kept in the focused validation slice to guard the live polling input contract used by `ViewerShell`.

## Preserved Invariants Checked

- Satellite motion code remains deterministic and tracker-independent.
- Missed aircraft polls degrade availability without ingesting empty snapshots.
- Demo/live viewer rendering still tolerates mocked tracker outputs through existing UI tests.

## Failure Paths / Edge Cases

- Failed high-quality poll after a stale `snapshotTimeS` does not trigger rapid retries.
- Tracker does not incorrectly latch turn mode after only one sharp interval.
- Tracks fade before prune instead of disappearing immediately on a missed update.

## Stabilization Notes

- ViewerShell trail rendering is tested by mocking `AircraftTracker.getTrail()` directly rather than relying on incidental screen-space affordance sampling.
- Timer-sensitive polling assertions use fake timers and explicit motion-quality settings to keep cadence deterministic.

## Known Gaps

- Full-suite legacy `aircraft-layer` coverage still targets the old `/api/aircraft` and snapshot-interpolation path; that remains for the later cleanup phase outside this phase scope.
