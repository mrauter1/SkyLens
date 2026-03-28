# Implementation Notes

- Task ID: skylens-task-settings-scroll-parity-permission-m-dd39eaaf
- Pair: implement
- Phase ID: ship-settings-scroll-permission-persistence-parity
- Phase Directory Key: ship-settings-scroll-permission-persistence-parity
- Phase Title: Ship settings scroll parity, permission recovery copy, and full durable persistence
- Scope: phase-local producer artifact

## Files changed
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/viewer/settings.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched
- `SettingsSheet`
- `ViewerShell`
- `getPermissionRecoveryAction`
- `ViewerSettings`
- `readViewerSettings`
- `normalizeViewerSettings`

## Checklist mapping
- Settings-sheet internal scroll owner: done in `SettingsSheet` fixed shell + internal scroll region.
- Permission CTA parity: done via shared `getPermissionRecoveryAction` plus dedicated camera-only, motion-only, and combined recovery dispatch in `ViewerShell`.
- Motion-disabled warning copy: done via shared `motionDisabledWarning` banner in live fallback overlays.
- Durable calibration persistence: done by persisting `alignmentTargetPreference` in viewer settings and restoring it into `ViewerShell`.
- Unit coverage: added/updated targeted tests for sheet scroll shell, permission permutations, motion warning copy, and persisted alignment-target restore.

## Assumptions
- The remaining durable calibration preference called out by plan/review is the manual alignment target override (`sun` / `moon`).
- Backdrop click-to-dismiss remains intentionally unsupported for settings; only scroll ownership changed.

## Preserved invariants
- Blocked startup still uses the existing `Start AR` / `Retry startup` contract.
- Viewer settings storage key remains `skylens.viewer-settings.v1`.
- Transient overlay state, banners, and draft inputs remain unpersisted.

## Intended behavior changes
- Opening Settings now uses a fixed viewport shell, locks document scroll while open, and scrolls only inside the sheet content area.
- Missing-permission recovery buttons now stay label/behavior aligned across live recovery surfaces, including a camera-only retry path that preserves existing motion/location state.
- Live fallback overlays now show a yellow motion-disabled warning stating that sky elements will not align correctly until motion is enabled.
- Reload restores a saved manual alignment target preference when present.

## Known non-changes
- No startup-flow redesign beyond recovery CTA parity.
- No persistence added for overlay visibility or other session-only UI state.

## Expected side effects
- While Settings is open, root/body scrolling is locked even outside the live camera-stage path.
- When both camera and motion are missing, the motion recovery panel now retries the full permission flow instead of motion-only; when only camera is missing, recovery now retries camera attach without re-requesting motion/location.

## Validation performed
- Manual diff review of touched runtime/test files.
- `git diff --check` passed.
- Attempted targeted unit runs for the four touched suites, but execution is blocked because `node_modules` is absent and the workspace cannot resolve `vitest`.

## Deduplication / centralization
- Centralized recovery CTA derivation and dispatch in `getPermissionRecoveryAction` plus `handlePermissionRecoveryAction` so quick actions and motion recovery cannot drift independently.
