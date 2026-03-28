# Settings Scroll, Permission Messaging, And Persistence Plan

## Scope
- Fix the live viewer settings sheet so opening Settings does not make the stage/background become the scroll owner; only the sheet content should scroll, with safe-area-aware max-height behavior on mobile.
- Align permission recovery copy so camera/motion CTA labels reflect the actual missing permission combination everywhere the live viewer exposes a targeted recovery action.
- Persist the full viewer settings payload plus durable calibration-related user state in `localStorage`, and restore it compatibly from older payloads.
- Source of truth: the immutable request snapshot and current raw log; there are no later clarifications.

## Current Baseline
- `components/settings/settings-sheet.tsx` renders a single absolutely positioned dialog with no dedicated internal scroll container or sheet-specific document scroll locking.
- `components/viewer/viewer-shell.tsx` already keeps the live camera stage fixed for the compact mobile overlay, but the settings sheet is not using the same “fixed shell + internal scroll owner” contract.
- Permission CTA text is already derived in `getMobilePermissionActionLabel(state)` for the quick action row, but the inline motion recovery panel hardcodes `Enable motion` and always retries motion-only, which can drift when camera is also missing.
- `lib/viewer/settings.ts` already persists layers, label mode, motion quality, pose calibration, FOV adjustment, selected camera, manual observer, and onboarding state, but it does not yet persist the explicit alignment target override that the viewer owns outside the settings schema.

## Milestone
### Ship one focused viewer/settings slice
- Update the settings-sheet layout so the sheet owns its own scroll region and max-height instead of relying on page/overlay scrolling.
- Reuse a single permission-action label/handler derivation for viewer recovery CTAs so button text and behavior stay in sync across missing-permission permutations.
- Extend the persisted viewer settings shape with the remaining durable calibration preference, while keeping older stored payloads readable without migration failures.
- Add or adjust unit coverage for scroll ownership, permission label permutations, motion-disabled warning copy, and persisted calibration restore.

## Planned Changes
### 1. Settings sheet scroll parity
- Keep `SettingsSheet` as the owner of its modal presentation rather than pushing new “sheet open” state into `ViewerShell`.
- Convert the open sheet to a fixed/safe-area-aware shell with an inner `overflow-y-auto` content region so the stage/background stays visually fixed while the settings body scrolls.
- Preserve the existing focus trap, Escape close behavior, trigger focus restore, and mobile max-height constraints; only the scroll owner changes.

### 2. Permission recovery copy and warning consistency
- Centralize the missing-permission CTA derivation in one viewer-shell helper that returns both label and retry behavior for:
  - both camera and motion missing
  - camera only missing
  - motion only missing
- Reuse that helper for the mobile quick action row and the inline recovery card instead of leaving the recovery panel hardcoded to motion-only copy.
- Replace the current motion-disabled fallback copy with a polished yellow warning message that preserves the required meaning: motion is not enabled, and object placement will be inaccurate until it is enabled.
- Render that warning consistently in the live overlay states that already surface non-blocking fallback banners when motion is unavailable.

### 3. Persist full settings and durable calibration state
- Extend `ViewerSettings`/storage normalization with the remaining durable calibration preference: the explicit alignment target override (`sun` / `moon`) when the user chooses one.
- Keep transient session/UI state out of storage, including banners, open/closed overlay state, temporary draft inputs, and last-applied status messaging.
- Preserve backward compatibility by making new persisted fields optional on read and normalizing absent values back to current defaults.
- Retain tolerance for existing legacy payload fields already accepted by the schema.

## Interfaces And Boundaries
- No route, API, or permissions coordinator contract changes are planned.
- Expected runtime files:
  - `components/settings/settings-sheet.tsx`
  - `components/viewer/viewer-shell.tsx`
  - `lib/viewer/settings.ts`
- Expected tests to update:
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/viewer-settings.test.tsx`
  - `tests/unit/viewer-shell-celestial.test.ts`
- Storage interface change:
  - extend the persisted viewer settings payload with an optional alignment target preference field
  - keep reads compatible with existing payloads that lack the new field

## Validation
- Add settings-sheet unit coverage that asserts the opened sheet uses an internal scroll container/max-height contract instead of making the page the scroll owner.
- Add viewer-shell tests for permission CTA permutations and confirm the shared recovery surface shows:
  - `Enable camera and motion`
  - `Enable camera`
  - `Enable motion`
- Add viewer-shell assertions for the yellow motion-disabled warning copy in the live overlay states where motion is unavailable.
- Add persistence tests that verify reload restores the new calibration preference alongside existing persisted settings and pose calibration, while older payloads still normalize successfully.

## Compatibility Notes
- The blocked startup flow keeps its existing `Start AR` action and copy; permission-specific recovery labels apply only after the viewer is in a state with known missing permissions.
- Storage remains on `skylens.viewer-settings.v1`; compatibility is handled by optional-field reads and normalization rather than by introducing a new storage key for this slice.
- Any new alignment-target field must default cleanly to the existing automatic target-resolution behavior when absent.

## Regression Prevention
- Prefer one shared permission recovery helper over duplicated button labels/handlers so quick actions and inline recovery panels cannot diverge again.
- Keep the settings-sheet change local to its modal shell/content structure; do not refactor unrelated viewer overlay layout while fixing scroll ownership.
- Do not persist ephemeral UI flags, because restoring stale banners or open panels after reload would be a behavior regression.
- Preserve existing focus-management and backdrop-dismiss semantics while changing the settings sheet layout.

## Risk Register
- R1: Changing the settings-sheet container could break focus trapping or close affordances.
  - Control: keep the current dialog/focus logic and add targeted sheet tests for open/close behavior plus the new scroll owner.
- R2: Reusing permission CTA logic too broadly could accidentally replace the blocked-state `Start AR` contract.
  - Control: scope the shared helper to known missing-permission recovery states only.
- R3: Over-persisting calibration state could reload stale session-only UI.
  - Control: limit persistence to durable user-owned calibration data and keep banners/panel visibility transient.
- R4: Adding a new optional storage field could regress older payload restore.
  - Control: read via optional schema fields and normalize missing values back to the current automatic behavior.

## Rollback
- Revert the settings-sheet layout changes if they regress focus handling or safe-area sizing, without touching viewer startup logic.
- Revert the shared permission recovery helper if it changes the blocked-state startup UX unexpectedly.
- Revert the storage-field addition separately if restore compatibility fails, leaving existing persisted settings behavior intact.
