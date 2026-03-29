# Test Strategy

- Task ID: improve-orientation-motion-serverless
- Pair: test
- Phase ID: viewer-integration-and-verification
- Phase Directory Key: viewer-integration-and-verification
- Phase Title: Wire Viewer Readiness, Diagnostics, And Tests
- Scope: phase-local producer artifact

## Behavior-to-test map

- Viewer prompt-vs-ready split:
  `tests/unit/viewer-shell.test.ts`
  Covers initial startup staying `orientation=unknown` until first sample, motion-only retry staying pending until first sample, and motion-only retry timing back to `denied` when no provider emits.
- Provider startup arbitration and failover:
  `tests/unit/orientation.test.ts`
  Covers absolute-sensor preference, delayed first samples after the initial 500 ms arbitration window, Firefox event-only startup, Chrome/Samsung-style sensor fallback, Safari compass validation upgrade/downgrade, and lifecycle restart behavior.
- Diagnostics and status surfacing:
  `tests/unit/viewer-shell.test.ts`
  Covers selected-provider diagnostics, browser-family recovery copy, relative-vs-absolute motion badges, and calibration/upgrade messaging.
- Permissions-policy/embed contract:
  `tests/unit/next-config.test.ts`, `tests/e2e/embed.spec.ts`
  Covers the sensor-only `Permissions-Policy` header and iframe `allow="accelerometer; gyroscope; magnetometer"` contract.

## Preserved invariants checked

- No prompt success alone marks orientation ready.
- Provider selection remains feature/sample driven rather than UA driven.
- The no-provider timeout still distinguishes `denied` vs `unavailable`.
- Screen-frame sensor startup can still win after a slow first sample instead of being discarded by premature teardown.

## Edge cases and failure paths

- Motion-only retry with prompt success but no sample emission.
- Startup providers that emit only after the initial arbitration window.
- Safari compass-backed events upgrading only after validation and downgrading after sustained failure.
- Event-only browsers that never expose static permission request APIs.

## Flake controls

- Fake timers drive startup and stall timeouts deterministically.
- Orientation/provider tests use mocked runtimes and explicit emitted samples rather than real device APIs.
- Viewer tests capture the mocked orientation callback directly instead of waiting on browser events.

## Validation notes

- Targeted local reruns succeed when invoked from `SkyLensServerless/` with the app-local Vitest binary and `NODE_PATH=/workspace/SkyLens/SkyLensServerless/node_modules`.
- Repo-root invocations still have config/install-layout friction, so phase validation uses the app-local command form for deterministic unit coverage.
