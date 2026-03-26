# Test Strategy

- Task ID: analyze-the-provided-codex-review-comments-for-c-635cab12
- Pair: test
- Phase ID: harden-opensky-and-orientation
- Phase Directory Key: harden-opensky-and-orientation
- Phase Title: Harden OpenSky bbox and orientation readiness
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- OpenSky wrapped bbox near `+180`: `tests/unit/aircraft-layer.test.ts`
  Verifies two bounded upstream requests are issued, no inverted longitude interval is accepted by the mock, and wrapped-region aircraft are still returned.
- OpenSky wrapped bbox near `-180`: `tests/unit/aircraft-layer.test.ts`
  Mirrors the positive antimeridian case to catch sign-dependent regressions in range splitting.
- Orientation permission explicit grant: `tests/unit/orientation-permission-and-subscription.test.ts`
  Confirms `granted` is returned immediately when an explicit orientation permission API grants and that no live-event probe listeners are attached.
- Orientation permission denied precedence: `tests/unit/orientation-permission-and-subscription.test.ts`
  Confirms explicit orientation denial returns `denied`, and motion denial still wins even when orientation permission grants.
- Orientation permission live probe success: `tests/unit/orientation-permission-and-subscription.test.ts`
  Uses fake timers plus a stub runtime to verify no-permission-API environments return `granted` only after a valid sensor event is observed.
- Orientation permission probe timeout: `tests/unit/orientation-permission-and-subscription.test.ts`
  Verifies invalid/no samples resolve to `unavailable` and listeners are cleaned up deterministically.
- Orientation stream fallback when absolute never becomes usable: `tests/unit/orientation-permission-and-subscription.test.ts`
  Verifies relative samples are buffered during the bounded fallback window, then selected once the timeout expires, and later absolute samples are ignored.
- Orientation stream absolute preemption: `tests/unit/orientation-permission-and-subscription.test.ts`
  Verifies a valid absolute sample can preempt a pending relative fallback before lock-in and remain the sole source for later smoothing/history.
- Orientation stream immediate relative-only path: `tests/unit/orientation-permission-and-subscription.test.ts`
  Verifies runtimes without absolute support do not incur the fallback delay and still emit relative samples immediately.

## Preserved invariants checked
- Viewer-facing orientation permission status remains within `granted | denied | unavailable`.
- OpenSky antimeridian hardening does not change aircraft payload shape; it only changes how upstream requests are partitioned.
- Orientation smoothing/history consume a single selected browser event stream after lock-in.

## Edge cases and failure paths
- Invalid absolute samples before relative fallback.
- No valid probe sample before timeout.
- Relative sample arriving before a later usable absolute sample.
- Absolute stream absent from the runtime entirely.

## Flake-risk controls
- Timer-dependent orientation tests use fake timers and a local stub runtime rather than real browser events.
- OpenSky wrapped-range tests use deterministic mocked responses keyed off parsed query params instead of network timing.

## Known gaps
- Runtime execution remains blocked in this workspace because installed JS dependencies are unavailable, so the added coverage is authored and reviewable but not executable here.
