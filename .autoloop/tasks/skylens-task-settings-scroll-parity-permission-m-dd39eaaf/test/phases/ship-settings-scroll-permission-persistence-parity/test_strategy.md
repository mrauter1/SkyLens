# Test Strategy

- Task ID: skylens-task-settings-scroll-parity-permission-m-dd39eaaf
- Pair: test
- Phase ID: ship-settings-scroll-permission-persistence-parity
- Phase Directory Key: ship-settings-scroll-permission-persistence-parity
- Phase Title: Ship settings scroll parity, permission recovery copy, and full durable persistence
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Settings scroll ownership:
  `tests/unit/settings-sheet.test.tsx` asserts the sheet opens inside a fixed viewport shell, applies safe-area padding/max-height, and exposes an internal `overflow-y-auto` scroll region while document scroll is locked.
- Permission CTA permutations:
  `tests/unit/viewer-shell.test.ts` covers `Enable camera and motion`, `Enable camera`, and `Enable motion` labels plus click behavior for combined, camera-only success, camera-only failure, and motion-only retry paths.
- Motion-disabled warning:
  `tests/unit/viewer-shell.test.ts` asserts the live fallback overlay renders the polished yellow warning copy when motion is unavailable.
- Durable calibration persistence:
  `tests/unit/viewer-settings.test.tsx` covers backward-compatible defaulting when the new field is absent and restore when `alignmentTargetPreference` is persisted.
  `tests/unit/viewer-shell-celestial.test.ts` verifies the persisted manual alignment target override is restored into the live viewer model after reload.

## Preserved invariants checked
- Blocked startup still uses the existing `Start AR` flow; recovery CTA tests only target known post-start permission states.
- Camera-only recovery must not re-request motion or location when those are already available.
- Older localStorage payloads without the new calibration preference still normalize cleanly.

## Edge cases and failure paths
- Camera-only retry failure keeps the route state at `camera: denied` without touching motion/location mocks.
- Motion retry denial keeps the warning/recovery surface visible and syncs the denied route state.
- Manual alignment-target override persists even when the chosen target is unavailable and the runtime falls back to the visible target.

## Stabilization notes
- Tests stay deterministic by using existing hoisted mocks, explicit route fixtures, and localStorage seeding instead of browser/device APIs.
- Validation execution remains blocked in this workspace because `node_modules` is absent and `vitest` cannot be resolved from `pnpm test`.

## Known gaps
- No executable test run was possible in the current workspace; the added assertions are reviewed structurally only until dependencies are installed.
