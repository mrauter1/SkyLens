# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: test
- Phase ID: scope-settings-controls
- Phase Directory Key: scope-settings-controls
- Phase Title: Scope Settings And Controls
- Scope: phase-local producer artifact
- Behaviors covered:
  - AC-1 persistence normalization:
    `tests/unit/viewer-settings.test.tsx` covers legacy payloads with no `scope`, partially missing nested scope fields, and out-of-range scope FOV values so they normalize to `enabled=false` / `10` degrees or clamp into `3..20`.
  - AC-2 synchronized scope controls:
    `tests/unit/viewer-settings.test.tsx` and `tests/unit/viewer-shell.test.ts` cover settings-sheet callbacks, persisted writes, desktop quick actions, and mobile quick actions all flowing through the same `viewerSettings.scope` state.
  - AC-3 availability gating:
    `tests/unit/settings-sheet.test.tsx` and `tests/unit/viewer-shell.test.ts` cover hidden scope controls when the viewer has not activated yet, when startup is blocked, and when live AR is blocked by an unsupported secure context.
- Preserved invariants checked:
  - Existing viewer settings continue to load with backward-compatible defaults.
  - The settings sheet remains presentation-only and delegates scope changes through callbacks.
  - Quick-action toggles update persisted state without introducing separate scope state stores.
- Edge cases:
  - Nested `scope` objects missing either `enabled` or `verticalFovDeg`.
  - Secure-context blocker state after live entry deep-link render.
  - Decimal scope FOV values using the `0.5`-step control path.
- Failure-path coverage:
  - Hidden control surfaces for blocked and unsupported states prevent dead toggles from rendering.
- Flake risk / stabilization:
  - Tests stay unit-level, mock the settings-sheet boundary where state synchronization is the target, and use explicit `act`/effect flush helpers to avoid timing drift.
  - `tests/unit/viewer-shell.test.ts` keeps the orientation-ready route regression on a local `10_000` ms timeout because the full `ViewerShell` file can exceed Vitest's default `5_000` ms budget even when behavior is correct; the timeout is intentionally local so broader suite timing does not drift.
- Validation run:
  - `npm test -- --run tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts`
- Known gaps:
  - No Playwright additions in this phase; scope rendering, dataset loading, and lens behavior remain deferred to later phases.
