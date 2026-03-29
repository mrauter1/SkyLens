# Test Strategy

- Task ID: improve-orientation-motion-review-fixes
- Pair: test
- Phase ID: orientation-motion-review-fixes
- Phase Directory Key: orientation-motion-review-fixes
- Phase Title: Fix orientation safety and reset duplication
- Scope: phase-local producer artifact

## Behavior To Coverage Map
- Safari compass validation safety:
  Covered by `tests/unit/orientation.test.ts` via `validates Safari compass-backed events before upgrading and downgrades after sustained failure`.
  Checks initial relative samples, first absolute upgrade, immediate fallback to relative on a failing validated sample, preserved temporary re-promotion on later valid samples while still validated, sustained invalid reset, and re-upgrade only after fresh consecutive valid samples.
- Viewer retry reset behavior:
  Covered by `tests/unit/viewer-shell.test.ts` via `keeps motion-only retries pending until a usable sample arrives`.
  Checks retry action wiring, route transition to `orientation: unknown`, cleared sensor status while awaiting a new sample, and recovery after fresh absolute samples.
- Viewer startup/manual-demo reset behavior:
  Covered by `tests/unit/viewer-shell.test.ts` via `clears stale live sensor state when switching into demo mode`.
  Checks stale live absolute sensor status is cleared on mode reset, orientation controller stop is invoked, and the non-live sensor status is restored.

## Preserved Invariants Checked
- Safari absolute upgrade still requires the existing consecutive-valid path before the first promotion.
- Safari validated state is not cleared on the first failing tick; only the emitted sample changes to relative immediately.
- Viewer reset extraction remains local behaviorally: retry and startup/manual-demo flows still produce their expected baseline sensor states.

## Edge Cases And Failure Paths
- Failing validated Safari sample after upgrade.
- Sustained invalid Safari streak leading to validation reset.
- Motion retry path with no usable sample yet, ensuring the UI stays pending instead of reusing stale state.
- Live-to-demo transition after a stale absolute sample, ensuring stale diagnostics do not leak.

## Stabilization Notes
- Orientation coverage uses `vi.useFakeTimers()` and fixed compass fixtures for deterministic upgrade/downgrade sequencing.
- Viewer coverage uses mocked orientation subscriptions and explicit `flushEffects()` calls to stabilize React async updates and route-state assertions.

## Validation Run
- Passed: `cd SkyLensServerless && timeout 120s npx vitest run tests/unit/orientation.test.ts tests/unit/viewer-shell.test.ts -t "(validates Safari compass-backed events before upgrading and downgrades after sustained failure|keeps motion-only retries pending until a usable sample arrives|clears stale live sensor state when switching into demo mode)"`

## Known Gaps
- The full `tests/unit/viewer-shell.test.ts` file remains slower than the focused acceptance command, so this phase uses the explicit touched-flow command above rather than the whole suite as its stability baseline.
