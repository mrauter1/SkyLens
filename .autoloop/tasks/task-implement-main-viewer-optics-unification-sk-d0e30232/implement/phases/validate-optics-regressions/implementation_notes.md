# Implementation Notes

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: implement
- Phase ID: validate-optics-regressions
- Phase Directory Key: validate-optics-regressions
- Phase Title: Validate Coverage And Runtime Behavior
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/e2e/demo.spec.ts`
- `.autoloop/tasks/task-implement-main-viewer-optics-unification-sk-d0e30232/decisions.txt`

## Symbols touched
- `it('rebinds the shared quick controls between runtime main optics and persisted scope optics')`
- `it('lets main-view deep stars participate in center-lock and on-object labels without scope mode')`
- `test('main-view optics reset on reload while scope optics stay persisted')`

## Checklist mapping
- Milestone 3 / AC-1: Added direct assertions for main-view defaults vs persisted scope values, mode-specific quick-control wiring, and main-view deep-star center-lock plus labels.
- Milestone 3 / AC-2: Reused existing viewer-shell and scope-runtime fixtures instead of adding parallel harnesses.
- Milestone 3 / AC-3: Ran targeted Vitest and Playwright commands; recorded outcomes below.
- Milestone 3 / AC-4: Extended runtime coverage to prove HYG deep stars participate in main view without scope mode while existing stale-response scope invalidation coverage remains in place.

## Assumptions
- Quick optics controls intentionally remain visually identical across modes and expose whichever optics bucket is active.

## Preserved invariants
- Scope-mode persistence remains owned by `viewerSettings.scopeOptics`.
- Main-view optics remain runtime-only and are validated through viewer-shell behavior rather than storage schema changes.
- Existing scope request cancellation/invalidation test coverage stays unchanged.

## Intended behavior changes
- None in runtime code; this phase only tightens automated coverage and corrects the e2e expectation for mode-bound slider values after reload.

## Known non-changes
- No production code paths were edited.
- No new Playwright infrastructure or browser-launch workarounds were added.

## Expected side effects
- The corrected e2e reload test now fails fast if scope-mode slider values ever incorrectly reset to main defaults while scope mode is still active.

## Validation performed
- `pnpm test -- tests/unit/scope-optics.test.ts tests/unit/viewer-settings.test.tsx tests/unit/projection-camera.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/settings-sheet.test.tsx`
  - Passed: `37` files, `356` tests.
- `pnpm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Passed: `37` files, `358` tests.
- `pnpm test:e2e -- tests/e2e/demo.spec.ts -g "main-view optics reset on reload while scope optics stay persisted"`
  - Browser launch blocked in this runner: Chromium headless shell fails to start because `libatk-1.0.so.0` is missing. Playwright attempted the full `tests/e2e/demo.spec.ts` file before failing at launch.

## Deduplication / centralization decisions
- Extended existing viewer-shell and scope-runtime suites so the new assertions exercise the shared runtime paths already introduced by optics unification.
