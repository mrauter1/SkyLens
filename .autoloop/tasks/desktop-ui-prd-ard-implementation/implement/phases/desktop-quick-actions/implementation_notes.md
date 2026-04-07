# Implementation Notes

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: desktop-quick-actions
- Phase Directory Key: desktop-quick-actions
- Phase Title: Simplify desktop quick actions and unify Enable AR
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts`

## Symbols touched
- `ViewerShell`
- `getPermissionRecoveryAction`
- `getPermissionRecoveryHandlerId`
- desktop quick-row action rendering
- desktop primary action fallback selection

## Checklist mapping
- Pair 1 / AC-1: desktop quick row now renders only `Open Viewer`, `Align`, `Enable AR`, `Scope` in fixed order.
- Pair 1 / AC-2: desktop `Enable AR` now delegates to existing `handlePermissionRecoveryAction`, preserving `camera-only`, `motion-only`, `camera-and-motion`, and `none` routing.

## Assumptions
- Scope remains in the desktop quick row for this phase even when disabled; secondary scope sliders remain unchanged until later phases.

## Preserved invariants
- `getPermissionRecoveryAction` still owns permission-state classification.
- Mobile permission button copy and routing remain unchanged.
- Existing permission retry handlers (`handleRetryPermissions`, `handleRetryCameraPermission`, `handleRetryMotionPermission`) remain the execution path.

## Intended behavior changes
- Desktop quick-row labels/order are normalized to the approved four-button set.
- Desktop permission recovery entrypoint is unified under `Enable AR` rather than separate camera and motion buttons.

## Known non-changes
- Warning rail, overlay dismiss behavior, and settings presentation are untouched in this phase.
- Desktop scope quick sliders still render below the row when scope mode is enabled.

## Expected side effects
- Desktop next-action card now uses `Enable AR` language for non-banner permission-recovery fallback states.
- Desktop open-viewer row button keeps a stable test/focus target even when the next-action card also points to viewer details.

## Validation performed
- `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/viewer-shell-resolvers.test.ts`
- `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/viewer-shell.test.ts -t "desktop"`

## Deduplication / centralization
- Reused `getPermissionRecoveryAction` and `handlePermissionRecoveryAction`, and centralized handler selection in `getPermissionRecoveryHandlerId`, instead of adding a second desktop-only permission resolver or duplicating recovery-kind switches in tests.
