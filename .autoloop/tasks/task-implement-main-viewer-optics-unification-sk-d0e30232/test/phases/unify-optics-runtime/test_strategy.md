# Test Strategy

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: test
- Phase ID: unify-optics-runtime
- Phase Directory Key: unify-optics-runtime
- Phase Title: Unify Active Optics Runtime
- Scope: phase-local producer artifact

## Behavior-to-coverage map

- AC-1 main-view optics defaults, minimums, and non-persistence:
  - `tests/unit/scope-optics.test.ts`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/viewer-settings.test.tsx`
  - `tests/e2e/demo.spec.ts`
- AC-2 scope-mode persistence and independent control wiring:
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/viewer-settings.test.tsx`
  - `tests/e2e/demo.spec.ts`
- AC-3 magnification = projection/FOV only; aperture = emergence only; HYG-only deep stars:
  - `tests/unit/scope-optics.test.ts`
  - `tests/unit/celestial-layer.test.ts`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
- AC-4 unified center-lock ordering across visible objects and deep stars:
  - `tests/unit/projection-camera.test.ts`
  - `tests/unit/viewer-shell-celestial.test.ts`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
- AC-5 deep-star requests and tile selection outside scope mode using mode-specific viewport/FOV inputs:
  - `tests/unit/scope-runtime.test.ts`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`

## Preserved invariants checked

- Scope overlay remains presentation-only and can be disabled without accepting stale deep-star responses.
- Daylight suppression still gates deep-star fetches.
- Scope lens viewport stays square and viewport-safe in scope mode.
- Main view keeps optics active even when scope mode is off.

## Edge cases and failure paths

- Magnification clamps to the `0.25x` main-view minimum and maps `1.0x` to the base viewer FOV.
- Deep stars below the horizon or outside the emergence threshold are excluded.
- Exact center-lock ordering falls back from distance to brightness to stable id ordering.
- Runtime request tests use synthetic catalogs and mocked fetches to avoid nondeterministic network/data timing.

## Known gaps

- `tests/e2e/demo.spec.ts` exists for reload/persistence/control behavior, but Playwright execution is currently blocked in this runner by missing system library `libatk-1.0.so.0`.
