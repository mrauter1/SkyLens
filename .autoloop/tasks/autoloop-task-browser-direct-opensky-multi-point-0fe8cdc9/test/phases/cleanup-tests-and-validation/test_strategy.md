# Test Strategy

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: test
- Phase ID: cleanup-tests-and-validation
- Phase Directory Key: cleanup-tests-and-validation
- Phase Title: Cleanup, Tests, and Validation
- Scope: phase-local producer artifact

## Coverage Map

- Browser-direct aircraft client:
  `tests/unit/aircraft-client.test.ts` covers anonymous OpenSky fetch success, antimeridian split/merge+dedupe, exact index mapping, `snapshotTimeS`, filtering/sort/limit, and failure handling including 429/network errors.
- Multi-point aircraft tracker:
  `tests/unit/aircraft-tracker.test.ts` covers straight prediction, observed-kinematics fallback, turn hysteresis, curved trails, stale fade/drop, and missed-poll decay.
- Viewer integration:
  `tests/unit/viewer-shell.test.ts` covers privacy copy, tracker-driven ingest, failed live refresh retention, motion-quality cadence, and focused aircraft trails.
- Health cleanup:
  `tests/unit/health-route.test.ts` covers `/api/health` without `aircraftCache`, preserving TLE cache states while asserting the removed aircraft field does not reappear.

## Preserved Invariants Checked

- TLE cache freshness/staleness behavior remains intact after aircraft health removal.
- Privacy messaging still states on-device camera handling and browser-direct OpenSky queries.
- Live aircraft failures degrade in place rather than clearing the tracker immediately.

## Edge Cases / Failure Paths

- Anonymous OpenSky request failures and rate limits.
- Antimeridian split requests with dedupe ordering.
- Tracker decay across missed polls and stale-drop thresholds.
- Health payload parsing with only `app` + `tleCache`.

## Stabilization Notes

- Tests use fixed timestamps, fake timers, deterministic mocked fetches, and local fixtures only.
- Viewer polling assertions rely on explicit timer advancement to avoid flake from real-time scheduling.

## Known Gaps

- No separate UI-only assertion was added for “health parsing without `aircraftCache`” because the real viewer/settings path already consumes the new payload shape, and the health route suite now directly guards against the removed field reappearing.
