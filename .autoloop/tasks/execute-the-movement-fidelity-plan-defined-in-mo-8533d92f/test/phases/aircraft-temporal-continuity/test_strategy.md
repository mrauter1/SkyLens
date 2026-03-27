# Test Strategy

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: test
- Phase ID: aircraft-temporal-continuity
- Phase Directory Key: aircraft-temporal-continuity
- Phase Title: Smooth aircraft motion between snapshots
- Scope: phase-local producer artifact

## Behavior → coverage map

- Smooth interpolation across retained snapshots:
  - `tests/unit/aircraft-layer.test.ts`
    - shared-id midpoint interpolation across previous/current snapshots
  - `tests/unit/viewer-shell.test.ts`
    - viewer-shell retains `previousSnapshot` and `currentSnapshot` across live polls

- Bounded dead reckoning when interpolation is unavailable:
  - `tests/unit/aircraft-layer.test.ts`
    - current-only aircraft with heading/velocity uses short-horizon extrapolation
    - fresh current-only aircraft without motion fields stays live during entry fade

- Stale handling and fade behavior:
  - `tests/unit/aircraft-layer.test.ts`
    - stale aircraft enters downgraded `motionState: 'stale'` window before suppression
    - stale aircraft suppresses fully after the bounded fallback window
    - previous-only aircraft remains briefly visible during fade-out
  - `tests/unit/viewer-shell.test.ts`
    - failed live refresh keeps last successful snapshot active instead of dropping aircraft immediately
    - stale aircraft `motionState` / `motionOpacity` metadata is surfaced through viewer marker label text and inline opacity
    - estimated aircraft disclosures are surfaced through marker sublabels and selected-detail badges

## Preserved invariants checked

- Aircraft ids remain stable through interpolation/dead-reckoning normalization.
- Demo/static callers remain compatible because temporal params stay optional.
- Live viewer wiring continues to pass scene time and retained snapshot state into aircraft normalization.

## Edge cases / failure paths

- Missing motion fields on a newly entering aircraft.
- Refresh failure after at least one successful aircraft poll.
- Stale-data path at both intermediate downgrade and terminal suppression points.

## Flake controls

- Use pure normalization tests for time-sensitive motion math.
- Use fake timers in viewer-shell tests to stabilize live poll timing and retained-snapshot assertions.
