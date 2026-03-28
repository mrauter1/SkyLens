# Fix settings scroll lock and motion retry review issues

## Scope
- Coordinate viewer-level scroll locking between `components/viewer/viewer-shell.tsx` and `components/settings/settings-sheet.tsx`.
- Restore motion denial messaging for the combined camera+motion recovery CTA in `components/viewer/viewer-shell.tsx`.
- Update unit coverage in `tests/unit/viewer-shell.test.ts` and `tests/unit/settings-sheet.test.tsx`, plus any directly affected settings/viewer integration tests.

## Implementation plan
### Milestone 1: Make `ViewerShell` the single owner of document/body scroll lock
- Remove direct `document.documentElement` / `document.body` overflow mutations from `SettingsSheet`; keep the sheet’s fixed shell and internal scroll region unchanged.
- Lift settings-open state into `ViewerShell` for the rendered sheet instances and fold that state into `shouldLockViewerScroll` so the viewer keeps background scroll locked while settings is open, including overlap with existing live-camera and alignment locks.
- Keep sheet-local responsibilities limited to trigger/render/focus management; if needed, add a minimal controlled-open interface (`isOpen`, `onOpenChange`) without introducing a new shared lock helper.

### Milestone 2: Preserve motion retry errors in combined recovery
- Refactor the permission recovery handler path so the combined camera+motion CTA reuses the same motion denial/error handling as the motion-only retry path.
- Preserve existing camera retry order and route-state updates: request motion first, then camera, then location/startup reconciliation; do not regress the camera-only recovery branch.
- Continue surfacing the existing `motionRetryError` copy in the motion recovery panel when orientation retry resolves to `denied` or throws.

### Milestone 3: Regression coverage and verification
- Update `tests/unit/settings-sheet.test.tsx` to stop asserting direct global scroll-style mutations and instead verify the sheet still renders as a fixed shell with an internal scroll region, plus any new controlled-open behavior if introduced.
- Extend `tests/unit/viewer-shell.test.ts` to cover:
  - viewer-owned scroll lock staying active across settings open/close transitions when another viewer lock is already active;
  - settings-open state contributing to viewer scroll locking when no other lock is active;
  - combined camera+motion recovery preserving the motion denial alert while keeping camera retry behavior intact.
- Run the focused viewer/settings unit test commands and fix any regressions they expose.

## Interfaces and invariants
- `ViewerShell` remains the only component that writes document/body scroll lock styles.
- `SettingsSheet` may gain a minimal controlled-open prop surface, but its visual structure, copy, and focus-trap behavior should remain unchanged.
- `shouldLockViewerScroll` must stay true whenever any viewer-controlled blocking surface that should freeze page scroll is active, including settings when lifted.
- Combined recovery must continue to update route state consistently for camera/orientation outcomes and must not suppress `motionRetryError` on denied motion retries.

## Compatibility notes
- No public routes, persisted settings payloads, or UX copy should change.
- The change is internal to component coordination and test expectations.

## Regression risks
- Double-mounted desktop/mobile sheet instances can drift if only one receives the lifted open state callbacks.
- Replacing sheet-local open state can break focus restoration or Escape handling if the trigger/dialog relationship is not preserved.
- Reusing the wrong retry helper can accidentally skip camera retry or change route-state synchronization order.

## Validation
- Focused unit tests:
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/settings-sheet.test.tsx`
  - `tests/unit/viewer-settings.test.tsx` if the real sheet control contract changes
- Confirm the denial message path still renders:
  - `Motion access is still denied. Check iOS Settings → Safari → Motion & Orientation Access, then retry.`
- Confirm background scroll stays locked while settings is open and is restored only when all viewer-owned lock conditions clear.

## Rollback
- Revert the lifted settings-open wiring and restore the prior `SettingsSheet` open contract if focus or lock coordination regresses.
- Revert the shared/centralized motion retry path if camera retry sequencing changes unexpectedly, while preserving any new test coverage that documents the intended behavior.

## Risk register
- R1: Scroll lock cleanup order restores stale overflow styles when settings closes during another active viewer lock.
  Mitigation: keep one effect in `ViewerShell` keyed from a consolidated lock condition and test overlapping transitions.
- R2: Controlled settings state breaks existing tests or integration paths that rely on local `SettingsSheet` toggling.
  Mitigation: prefer an optional controlled API or a narrowly scoped state lift only where `ViewerShell` renders the sheet.
- R3: Combined recovery still updates route state but drops the visible motion alert on denied retries.
  Mitigation: assert both route sync and rendered alert text in the same unit test.
