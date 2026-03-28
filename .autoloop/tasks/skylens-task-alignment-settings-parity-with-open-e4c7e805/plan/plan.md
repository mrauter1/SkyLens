# Mobile Overlay Parity Plan

## Scope
- Mobile live viewer only.
- Files expected to change: `components/viewer/viewer-shell.tsx`, `components/settings/settings-sheet.tsx`, one small shared mobile panel shell helper/component if needed, and related unit/e2e tests.
- Out of scope: desktop viewer layout, alignment tutorial logic, persistence format, permissions flow semantics, and unrelated viewer styling.

## Current State
- Compact Open viewer already uses a fixed safe-area shell, a non-scrolling panel, and an internal scroll region with max height `calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))`.
- `SettingsSheet` duplicates the same compact shell/panel/scroll pattern and max-height contract.
- Compact alignment currently renders inline inside `mobile-viewer-quick-actions` and scrolls the full panel with a different max-height (`calc(100dvh - (6.5rem + env(safe-area-inset-bottom)))`), so it competes with the bottom action rail for space.

## Milestones
1. Introduce one shared compact mobile panel shell primitive used by Open viewer, Settings, and compact Align where it reduces duplicated shell behavior.
2. Move compact alignment from the quick-action stack into its own top-layer mobile overlay above the stage and quick-action buttons while preserving the current alignment open/close and focus transition flow.
3. Update tests so overlay placement, shared max-height contract, internal scroll behavior, and non-regressed alignment interactions are covered.

## Implementation Contract

### Shared mobile shell
- Keep the abstraction narrow and local to viewer/settings surfaces.
- Centralize only the repeated compact-mobile shell contract:
  - fixed safe-area shell padding,
  - non-scrolling panel container with `overflow-hidden`,
  - internal `overflow-y-auto overscroll-contain` scroll region,
  - shared compact max-height token matching the existing Open viewer compact overlay.
- Preserve existing per-surface content composition and dismissal semantics rather than building a generic modal system.

### ViewerShell changes
- Render compact alignment in a dedicated fixed overlay sibling with a higher stacking order than `mobile-viewer-quick-actions`; do not keep it inline inside that quick-action container.
- Keep the camera stage/background visible behind the alignment overlay.
- Preserve explicit close controls and the current state flow:
  - opening Align still closes the Open viewer sheet if needed,
  - Start alignment still transitions into alignment focus,
  - alignment focus still hides mobile overlay chrome.
- Do not add new backdrop-dismiss behavior for Align; Open viewer and Settings retain their current backdrop/dismiss behavior.
- Refactor compact alignment layout to match Open viewer structure: non-scrolling shell + internal scroll region using the shared compact max-height token.

### Settings changes
- Reuse the shared compact mobile shell contract in `SettingsSheet` without changing:
  - dialog semantics,
  - `onOpenChange`,
  - escape handling,
  - focus return,
  - safe-area padding,
  - current backdrop behavior.
- Ensure only settings content scrolls in compact mobile mode; the stage/background remains fixed.

## Interface / Test Hooks
- Preserve existing test IDs used by current tests:
  - `mobile-viewer-overlay-shell`
  - `mobile-viewer-overlay`
  - `mobile-viewer-overlay-compact-content`
  - `settings-sheet-shell`
  - `settings-sheet-panel`
  - `settings-sheet-scroll-region`
  - `alignment-instructions-panel`
- Add dedicated alignment overlay wrapper IDs only if needed for stable assertions, preferably:
  - `mobile-alignment-overlay-shell`
  - `mobile-alignment-overlay-panel`
  - `mobile-alignment-overlay-scroll-region`
- Keep `alignment-instructions-panel` on the visible alignment panel content so existing alignment-flow assertions remain valid.

## Validation
- Update unit tests in `tests/unit/viewer-shell.test.ts` to verify:
  - compact alignment no longer renders inside `mobile-viewer-quick-actions`,
  - the alignment overlay uses a fixed top-layer shell above quick actions,
  - compact alignment max height matches the Open viewer compact max-height contract,
  - compact alignment uses an internal scroll region,
  - existing close, reopen, and Start alignment focus transitions still pass.
- Update unit tests in `tests/unit/settings-sheet.test.tsx` to verify Settings still uses the shared fixed shell/internal scroll model and the same compact max-height contract as Open viewer.
- Update the short-viewport e2e in `tests/e2e/permissions.spec.ts` to assert the new overlay container remains scrollable and lower alignment controls are reachable while the quick-action rail is underneath rather than consuming panel height.

## Compatibility Notes
- No public API, persisted settings, or route behavior changes are planned.
- Desktop layout remains unchanged.
- No intentional behavior break is planned beyond the requested mobile alignment z-order/layout change.

## Regression Risks
- Alignment state regressions if render relocation changes when the panel is mounted/unmounted.
- Overlay stacking or pointer-events bugs that leave quick actions blocked after close.
- Safe-area or short-viewport regressions if the shared shell diverges from the current Open viewer contract.
- Over-abstraction risk if the shared shell absorbs surface-specific behavior instead of just the repeated layout contract.

## Risk Controls / Rollback
- Keep the shared primitive narrowly scoped to shell layout and scroll behavior; leave state ownership in `ViewerShell` and `SettingsSheet`.
- Prefer reusing the existing Open viewer compact max-height token as the single source of truth.
- Re-run existing alignment-flow and overlay tests after refactor, then extend them for z-order/scroll parity.
- Rollback path: revert the shared shell adoption and restore the previous alignment render location; no data migration or persisted compatibility work is required.
