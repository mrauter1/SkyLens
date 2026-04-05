# Test Strategy

- Task ID: skylensserverless-review-applicability-and-fixes
- Pair: test
- Phase ID: review-applicability-and-scope-radius-fix
- Phase Directory Key: review-applicability-and-scope-radius-fix
- Phase Title: Evaluate Review Items And Correct Scope Radius Selection
- Scope: phase-local producer artifact

## Behavior To Test Coverage Map
- Accepted behavior: scope tile selection uses the square lens viewport in `ViewerShell`.
  Covered by `tests/unit/viewer-shell-scope-runtime.test.tsx` with a portrait-stage fixture that verifies the edge tile fetch follows the square scope lens viewport rather than the full stage viewport.
- Regression guard: portrait layouts should not underfetch scope edge tiles.
  Covered by `tests/unit/scope-runtime.test.ts` via a deterministic selection-radius comparison where the full-stage portrait radius misses `lens-edge.bin` and the square-lens radius includes it.
- Regression guard: wide layouts should not overfetch tiles outside the lens-visible envelope.
  Covered by `tests/unit/scope-runtime.test.ts` via a deterministic comparison where the wide-stage radius includes `wide-only.bin` but the square-lens radius does not.
- Preserved behavior: rejected `scopeProjectionProfile` memoization remains artifact-only and should not gain brittle identity tests.
  Covered by task artifacts only; no automated test was added because there is no observable identity contract to lock.

## Preserved Invariants Checked
- Scope band selection remains unchanged; tests target only tile-radius and tile-fetch consequences.
- Scope session caching remains production behavior; runtime tests reset the cache between synthetic datasets so fixture isolation is deterministic.

## Edge Cases
- Non-square portrait stage with smaller full-stage aspect ratio than the square lens viewport.
- Non-square wide stage with larger full-stage aspect ratio than the square lens viewport.

## Failure Paths
- Cache leakage between runtime fixtures is stabilized by resetting the scope catalog session cache before and after `ViewerShell` runtime tests.

## Reliability / Flake Controls
- Tests use synthetic scope manifests, indexes, and tile responses instead of live network data.
- Runtime viewport sizing is pinned through a deterministic `getBoundingClientRect` stub.
- The focused validation command is `npm exec -- vitest run tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`.

## Known Gaps
- No direct test was added for the rejected memoization suggestion because object identity has no current observable contract.
