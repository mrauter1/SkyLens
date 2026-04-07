# Test Strategy

- Task ID: desktop-ui-prd-ard-implementation
- Pair: test
- Phase ID: desktop-quick-actions
- Phase Directory Key: desktop-quick-actions
- Phase Title: Simplify desktop quick actions and unify Enable AR
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 desktop quick-row composition:
  - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies the desktop row label order is exactly `Open Viewer`, `Align`, `Enable AR`, `Scope`.
  - Verifies legacy split row buttons (`desktop-camera-action`, `desktop-motion-action`) are absent.
  - Verifies `Open Viewer` still opens the desktop viewer panel and keeps relocated content reachable.
- AC-2 desktop permission recovery routing:
  - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies the desktop `Enable AR` row button is enabled for motion-only recovery and routes to the motion retry path without touching camera recovery.
  - `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`
  - Verifies `getPermissionRecoveryAction` returns `camera-only`, `motion-only`, `camera-and-motion`, and `none` for the expected route states.
  - Verifies `getPermissionRecoveryHandlerId` maps those recovery kinds to the existing end handlers (`retry-camera`, `retry-motion`, `retry-all`, `none`).

## Preserved invariants checked
- Desktop quick-row cleanup does not change mobile permission copy assertions.
- Permission recovery still fans into the pre-existing shared handlers rather than a desktop-only branch.

## Edge cases / failure paths
- Ready state maps to no recovery handler.
- Combined recovery continues to map to the full startup retry path even though the desktop row now shows a unified `Enable AR` label.

## Stabilization / flake control
- Coverage uses deterministic unit tests only; no network or real permission APIs are exercised.
- Desktop viewer-shell validation is run via a targeted `-t "desktop|PermissionRecovery"` slice to keep scope tight around this phase.
- Canvas `getContext()` warnings from jsdom are tolerated because these assertions do not depend on canvas rendering output.

## Known gaps
- Full viewer-shell suite execution remains outside this phase-local test pass; this turn validates the targeted desktop quick-action and permission-routing slice.
