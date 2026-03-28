# Fix Settings Scroll Lock And Permission Recovery

## Objective
Resolve the review issues with the smallest safe change set: make `ViewerShell` the only owner of document/body scroll locking, and preserve motion denial messaging when the combined camera+motion recovery CTA re-requests permissions.

## Implementation Plan
1. Coordinate settings-open state with viewer-level scroll locking.
   - Remove direct `document.documentElement` / `document.body` overflow mutation from [components/settings/settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx).
   - Keep `SettingsSheet` responsible for its own trigger, dialog rendering, focus restore, focus trap, and existing close-on-action behavior.
   - Add a notification-style interface from `SettingsSheet` to its parent for open/close changes so [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) can include settings visibility in `shouldLockViewerScroll`.
   - Track desktop and mobile settings-sheet visibility separately in `ViewerShell` and aggregate them for scroll locking. Do not drive both mounted `SettingsSheet` instances from one shared `isOpen` boolean unless rendering is also consolidated to a single instance.
2. Preserve motion retry denial handling in the combined recovery path.
   - Refactor the orientation retry post-processing in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) so the motion-only retry and the combined recovery path both surface the existing `motionRetryError` copy when `requestOrientationPermission()` returns non-granted.
   - Keep the combined recovery sequence unchanged for camera/location work: orientation request first, then camera retry, then location recovery/state commit.
   - Preserve current route syncing and generic startup failure behavior for thrown errors; only the denied/unavailable orientation branch should regain the motion-specific alert.
3. Validate the regression surface with targeted tests.
   - Update [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) to cover viewer-level scroll locking when settings open/close overlaps an existing viewer lock and to cover the combined camera+motion recovery path surfacing motion denial copy without regressing camera retry.
   - Update [tests/unit/settings-sheet.test.tsx](/workspace/SkyLens/tests/unit/settings-sheet.test.tsx) to stop asserting document/body overflow ownership in `SettingsSheet` and instead verify the sheet still opens, keeps its internal scroll region, and reports open/close transitions if a callback is added.
   - Run targeted Vitest coverage for the touched components and expand to related viewer tests only if the new `SettingsSheet` interface affects shared mocks.

## Interfaces And File Touchpoints
- [components/settings/settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx)
  Add an optional parent notification such as `onOpenChange(open: boolean)`. Keep the rest of the sheet API and UX copy stable.
- [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx)
  Aggregate settings-open state into `shouldLockViewerScroll` and reuse a shared orientation-retry result handler for motion-only and combined recovery flows.
- [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts)
  Exercise the parent lock aggregation and combined recovery denial behavior through the mocked `SettingsSheet` props and permission mocks.
- [tests/unit/settings-sheet.test.tsx](/workspace/SkyLens/tests/unit/settings-sheet.test.tsx)
  Rebaseline the sheet test around layout/focus/open notifications rather than document scroll side effects.

## Compatibility Notes
- No UX copy change is planned.
- No route shape, persisted settings shape, or permission request order should change.
- `ViewerShell` remains the only code path that mutates document/body scroll styles after this fix.

## Regression Risks And Controls
- `R1`: A single lifted `isOpen` flag would cause both mounted `SettingsSheet` instances to render their dialogs.
  Control: aggregate per-instance open notifications in `ViewerShell` instead of sharing one render-control flag across both mounts.
- `R2`: Reusing the wrong retry path could suppress camera retry when motion remains denied.
  Control: share only the orientation result handling; keep camera retry and observer recovery in the combined flow untouched.
- `R3`: Moving lock ownership can silently break tests that still expect `SettingsSheet` to mutate document overflow.
  Control: split validation between `SettingsSheet` layout/open-state tests and `ViewerShell` document-lock tests.

## Validation
- `npx vitest run tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx`
- Add `tests/unit/viewer-shell-celestial.test.ts` only if the `SettingsSheet` prop contract change requires shared mock updates there.

## Rollback
- Revert the new parent open-state aggregation and shared orientation-result helper if the change introduces overlay-state regressions, but do not reintroduce competing document/body scroll lock owners.
