# Test Strategy

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: test
- Phase ID: validate-optics-regressions
- Phase Directory Key: validate-optics-regressions
- Phase Title: Validate Coverage And Runtime Behavior
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Main-view optics defaults and non-persistence
  - `SkyLensServerless/tests/unit/scope-optics.test.ts`
  - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - `SkyLensServerless/tests/e2e/demo.spec.ts`
  - Covers `1.0x` main default, `0.25x` minimum support, and reload reset of main-view aperture/magnification.
- Magnification-as-FOV-only and aperture-driven emergence
  - `SkyLensServerless/tests/unit/scope-optics.test.ts`
  - `SkyLensServerless/tests/unit/celestial-layer.test.ts`
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers unchanged emergence at fixed aperture across magnification changes, monotonic aperture emergence, and render metadata remaining decoupled from magnification.
- Deterministic center-lock ordering
  - `SkyLensServerless/tests/unit/projection-camera.test.ts`
  - Covers distance, then brightness, then stable id ordering inside the fixed center-lock radius.
- Mode-specific control wiring and persistence split
  - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
  - `SkyLensServerless/tests/e2e/demo.spec.ts`
  - Covers shared quick-control UI rebinding between runtime main optics and persisted scope optics, plus persisted scope-mode values surviving reload.
- Main-view HYG deep-star loading and participation without scope mode
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers full-stage tile selection in main view, center-lock participation, and on-object labels without scope presentation.
- Preserved scope cancellation/invalidation behavior
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers stale tile responses being ignored after scope disable and keeps the existing request lifecycle contract in place.

## Preserved invariants checked
- Scope optics remain the only persisted optics bucket.
- Quick controls keep the same labels and surfaces while switching value source by active mode.
- Deep-star participation remains HYG-only and shares the existing runtime request pipeline.

## Edge cases and failure paths
- Main-view reload while scope mode remains enabled must continue showing persisted scope values until scope mode is turned off.
- Main-view deep-star coverage includes the non-scope path so regressions cannot silently relock deep stars behind the lens overlay.
- Scope response invalidation is exercised with deferred tile resolution to catch stale-response races.

## Flake-risk controls
- Unit and integration coverage reuses existing deterministic fixtures and synthetic scope datasets.
- Browser validation is limited to a single filtered Playwright test via direct CLI form to avoid accidental whole-file execution during environment-blocked reruns.

## Validation run summary
- `pnpm test -- tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/projection-camera.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/settings-sheet.test.tsx`
  - Passed: `37` files, `356` tests.
- `pnpm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Passed: `37` files, `358` tests.
- `pnpm exec playwright test tests/e2e/demo.spec.ts -g "main-view optics reset on reload while scope optics stay persisted"`
  - Selected exactly `1` test, but Chromium launch is blocked in this runner by missing `libatk-1.0.so.0`.

## Known gaps
- Browser assertions remain unexecuted until the runner has the missing Chromium system library set.
