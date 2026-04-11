# Implementation Notes

- Task ID: ar-free-navigation-mode
- Pair: implement
- Phase ID: explicit-ar-and-free-navigation-mode
- Phase Directory Key: explicit-ar-and-free-navigation-mode
- Phase Title: Explicit free-navigation default and AR toggle flow
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/permission-coordinator.test.ts`
- `SkyLensServerless/tests/e2e/permissions.spec.ts`
- `.autoloop/tasks/ar-free-navigation-mode/decisions.txt`

## Symbols touched
- `ViewerShell`
- `describeRuntimeExperience`
- `getMotionBadgeValue`
- `resolveInitialInteractionMode`
- `handleRetryPermissions`
- `handleRetryMotionPermission`
- `handleRetryCameraPermission`
- `handleRetryLocation`
- `handleDesktopArToggleAction`
- `renderViewer` test helper
- `enableArMode` test helper

## Checklist mapping
- Milestone 1: Added explicit `interactionMode` state in `viewer-shell`; free-navigation is the default for fresh live loads, including routes whose permission facts are already granted; manual drag/keyboard mode now keys from explicit free-navigation intent.
- Milestone 2: Reused existing retry/start flows for Enable AR; added explicit Disable AR teardown for camera/orientation/timers; explicit retry actions re-enter AR without an extra enable click.
- Milestone 3: Kept AR toggle controls always visible in desktop action chrome and mobile quick actions, with `Enable AR`/`Disable AR` labels driven by interaction mode.
- Milestone 4: Updated unit and e2e coverage for no-prompt-before-click, always-visible toggles, explicit Enable AR setup for AR-dependent regression fixtures, disable-to-free-navigation behavior, and permission-contract separation.

## Assumptions
- Sticky disable is session-local only; no route or persisted storage contract was added for interaction mode.

## Preserved invariants
- Permission coordinator route state remains permission/result-only and keeps motion -> camera -> location ordering unchanged.
- Manual observer, scope controls, alignment flow, diagnostics, and recovery banners remain in `viewer-shell`.
- Explicit retry actions still use the existing recovery handlers instead of a new parallel startup path.

## Intended behavior changes
- Bare `/view` now renders interactive free-navigation without prompting for motion, camera, or location until `Enable AR` is pressed.
- Fresh live routes with already-granted permission facts also stay in free-navigation until the user explicitly enables AR or presses a retry action.
- `Disable AR` stops AR-only resources and returns the viewer to free-navigation while leaving observer continuity and manual navigation available.
- Mobile and desktop surfaces always expose an AR toggle control in live mode.

## Known non-changes
- No changes outside `SkyLensServerless/`.
- No route params or persisted interaction-mode storage were added.
- Demo mode behavior remains intact aside from regression coverage.

## Expected side effects
- When AR is disabled after permissions were previously granted, status copy reports camera as off and motion as AR off rather than treating granted permissions as active resources.
- Direct live deep links with granted camera/orientation facts now require an explicit Enable AR click before camera/orientation/alignment runtime behavior starts.

## Deduplication / centralization
- Centralized AR teardown into `stopArResources()` instead of duplicating camera/orientation/timer cleanup across disable and stale async startup paths.
- Centralized fresh-load free-navigation initialization in `resolveInitialInteractionMode()`.
- Centralized AR setup in tests with shared `enableArMode()` / `renderViewer(..., { autoEnableAr: false })` helpers so AR-specific coverage stays explicit without duplicating click boilerplate.

## Validation performed
- `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/permission-coordinator.test.ts tests/unit/viewer-shell.test.ts --reporter=dot`
- `pnpm --dir /workspace/SkyLens/SkyLensServerless exec playwright test tests/e2e/permissions.spec.ts --reporter=line`
