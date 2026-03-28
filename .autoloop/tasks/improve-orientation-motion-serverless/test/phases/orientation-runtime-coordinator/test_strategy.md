# Test Strategy

- Task ID: improve-orientation-motion-serverless
- Pair: test
- Phase ID: orientation-runtime-coordinator
- Phase Directory Key: orientation-runtime-coordinator
- Phase Title: Refactor Orientation Runtime And Provider Arbitration
- Scope: phase-local producer artifact

## Behavior Map

- AC-1 capability and permission-surface coverage:
  `orientation.test.ts` checks runtime capability reporting, prompt-only permission behavior, event sample classification, and relative-sensor startup.
- AC-2 provider ladder and restart coverage:
  `orientation.test.ts` covers startup arbitration, `deviceorientationabsolute` precedence over plain absolute events, late absolute upgrades, delayed permission-hint startup, lifecycle suspend/resume, and provider-stall restarts.
- AC-3 Safari compass validation coverage:
  `orientation.test.ts` now anchors the Safari aligned fixture to the quaternion-derived heading before asserting the required relative -> absolute -> relative sequence, so a red test indicates coordinator behavior drift rather than bad test data.
- AC-4 rotation/screen-angle coverage:
  `orientation.test.ts` asserts that `orientationchange` reprocesses the latest event-backed sample with the new screen angle while screen-frame sensor samples do not emit duplicate poses.

## Preserved Invariants

- Public source labels stay coarse; tests assert the existing `deviceorientation-absolute` / `deviceorientation-relative` labels rather than any compass-specific public source.
- Screen-frame sensor providers remain exempt from extra screen-angle correction.
- Calibration-sensitive relative samples remain marked as needing calibration until an absolute or calibrated path is selected.

## Edge Cases / Failure Paths

- Unsupported explicit permission APIs return `unavailable` without installing listeners.
- Slow permission-hint queries do not block higher-priority absolute sensor startup.
- Lifecycle suspend/resume and stall recovery restart arbitration.
- Sustained bad Safari compass samples are expected to downgrade the previously validated compass path back to relative.

## Known Gaps

- The full `SkyLensServerless/tests/unit/orientation.test.ts` suite is intentionally left red on the Safari validated-compass upgrade/downgrade assertion until the coordinator satisfies AC-3; the new aligned-fixture precondition test narrows that failure to runtime behavior instead of fixture validity.
