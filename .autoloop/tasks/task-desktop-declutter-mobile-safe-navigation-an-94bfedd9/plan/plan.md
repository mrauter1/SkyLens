# Desktop Declutter + Mobile-Safe Navigation Plan

## Intent
- Reduce desktop viewer chrome so it follows the simpler mobile mental model instead of rendering multiple always-open panels.
- Preserve mobile as the reference experience, fix current mobile navigation/overlay issues, and add tests that lock in both behaviors.

## Current implementation summary
- [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) renders two different shells: desktop keeps a persistent header, badges, warning stack, summary panel, bottom dock, selected-object panel, and privacy panel; mobile hides most of that behind bottom quick actions and a viewer overlay.
- The same warning and summary content is duplicated across desktop and mobile branches, which increases drift risk.
- Marker interaction is click/tap based; center-lock uses `pickCenterLockedCandidate(...)`, but desktop has no pointer-driven reticle/focus equivalent.
- Mobile navigation already depends on `isMobileOverlayOpen`, `isMobileAlignmentFocusActive`, `CompactMobilePanelShell`, and scroll locking, so desktop changes must not disturb those state transitions.

## Implementation strategy

### Milestone 1: Unify the shell around the mobile interaction model
- Rework the desktop chrome in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) so desktop keeps the stage visible, a compact top warning rail, and a streamlined action strip modeled after mobile.
- Move verbose desktop-only panels (persistent badges, bottom dock, privacy panel, large summary blocks) behind the same viewer overlay/content model used on mobile, but do not delete the information they currently expose.
- Keep `SettingsSheet` as the place for secondary controls; do not add a new generic layout layer unless shared overlay markup clearly becomes cleaner as a small local render helper inside `viewer-shell.tsx`.
- Desktop primary action contract must be explicit and testable:
  - `Open Viewer` is always visible and opens the desktop version of the shared viewer overlay.
  - `Enable Camera` is visible whenever camera access or camera attachment is not ready; it uses the existing camera retry path when that path is valid, and may delegate to the existing startup controller before verified state exists so permission ordering does not change.
  - `Motion` is visible whenever orientation or motion is not ready; it uses the existing motion retry path when available, and may delegate to the existing startup controller before verified state exists so permission ordering does not change.
  - `Align` remains visible when alignment is relevant; it may be disabled when alignment cannot start yet, but it stays in the same primary desktop strip instead of hiding inside settings.
  - If a settings entry remains visible on desktop, keep it secondary to these four requested primary actions rather than the dominant control.
- Preserve the following existing information surfaces by relocating them rather than removing them:
  - active object summary and selected-object details
  - critical warnings and recovery content
  - manual observer and location recovery content
  - privacy reassurance copy

### Milestone 2: Make desktop pointer behavior match mobile reticle semantics
- Add a desktop-only pointer reticle/focus path in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) instead of inventing a separate hover detail model.
- Best-fit implementation:
  - Track pointer position/activity for fine pointers only.
  - Derive a hovered/focused object from projected markers using the same ranking rules as center-lock, but relative to the pointer reticle instead of the screen center.
  - Use that focused object for the same summary/detail surfaces that mobile gets from the center crosshair.
  - Preserve click/tap selection as an explicit pin/inspect action.
- Keep mobile center-lock unchanged; pointer reticle logic must be disabled on coarse/touch interaction paths.

### Milestone 3: Compact and relocate warnings
- Replace the large stacked warning cards in the desktop branch with a compact top-of-screen warning rail in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx).
- Motion warnings, calibration notices, and fallback alerts should render in the top rail first, with tighter copy density and smaller card height.
- Preserve criticality ordering:
  - hard fallback/error first
  - motion/alignment recovery next
  - informational calibration state last
- Mobile can reuse the same compact warning presentation where it improves readability, but the change must not reduce tap targets or safe-area spacing.

### Milestone 4: Harden mobile navigation and regression coverage
- Keep the current mobile quick-action flow (`Open viewer`, permission recovery, `Align`) as the baseline and fix navigation failures in place rather than replacing it.
- In [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx), verify and preserve these invariants:
  - overlay trigger opens reliably from closed state
  - backdrop closes overlay, inner panel clicks do not
  - entering alignment focus closes viewer overlay and hides conflicting quick actions
  - leaving alignment focus restores the quick actions/trigger
  - scroll locking does not strand the user on short viewports
  - safe-area padding remains intact through overlay and settings-sheet states
- Extend tests before or alongside UI changes:
  - unit: desktop hover/pointer reticle updates the active object info without breaking click selection
  - unit: compact top warning rail renders and motion warning appears there
  - unit: mobile overlay/alignment state transitions still restore navigation affordances
  - e2e: mobile overlay open/close/backdrop/short-viewport reachability stay working
  - e2e or unit: desktop simplified actions are present and open the viewer information surface

## Interfaces and change boundaries
- Primary edit surface:
  - [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx)
- Supporting components likely touched:
  - [`components/ui/compact-mobile-panel-shell.tsx`](/workspace/SkyLens/components/ui/compact-mobile-panel-shell.tsx) only if safe-area or scroll behavior needs a small shell-level adjustment
  - [`components/settings/settings-sheet.tsx`](/workspace/SkyLens/components/settings/settings-sheet.tsx) only if button labeling/entry points need to align with the simplified control stack
- Existing route/storage contracts must remain unchanged:
  - [`lib/permissions/coordinator.ts`](/workspace/SkyLens/lib/permissions/coordinator.ts)
  - [`lib/viewer/settings.ts`](/workspace/SkyLens/lib/viewer/settings.ts)
- Preferred internal interfaces:
  - add local viewer-shell state for desktop pointer reticle activity/position or hovered object id
  - add a local helper for “active focus object” resolution so center-lock and pointer-reticle logic share ranking rules
  - add explicit `data-testid` hooks for compact top warnings and the desktop primary action row / viewer-overlay trigger needed by tests
  - keep action dispatch wired to existing startup and retry handlers instead of inventing a new permission flow

## Compatibility and non-goals
- No URL/query parameter changes.
- No local storage schema change.
- No changes to permission ordering or live startup sequencing.
- No redesign of the settings sheet contents beyond what is needed to support the simplified shell.
- No mobile-first behavior regressions in alignment focus, manual-pan controls, or short-viewport overlay reachability.

## Regression prevention
- Keep desktop and mobile on the same overlay content source to reduce duplicated warnings and summary markup.
- Preserve existing information access when decluttering desktop: moving content behind `Open Viewer` or compact surfaces is allowed, silently dropping detail, recovery, or privacy content is not.
- Gate pointer-reticle behavior behind fine-pointer/desktop conditions so touch devices keep current behavior.
- Preserve existing selection semantics:
  - hover/pointer focus is transient
  - click/tap selection remains explicit and dismissible
  - mobile center-lock remains available even with no explicit selection
- Reuse existing permission recovery actions and alignment handlers instead of adding new flows.
- Validate both compact and full mobile overlay paths, because `shouldUseCompactNonScrollingOverlay` changes behavior when live camera is active.

## Validation plan
- Run targeted unit suites:
  - [`tests/unit/viewer-shell.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell.test.ts)
  - [`tests/unit/viewer-shell-celestial.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts)
  - [`tests/unit/settings-sheet.test.tsx`](/workspace/SkyLens/tests/unit/settings-sheet.test.tsx) if shell/control entry points change
- Run mobile-focused Playwright coverage:
  - [`tests/e2e/demo.spec.ts`](/workspace/SkyLens/tests/e2e/demo.spec.ts)
  - [`tests/e2e/permissions.spec.ts`](/workspace/SkyLens/tests/e2e/permissions.spec.ts)
  - [`tests/e2e/landing.spec.ts`](/workspace/SkyLens/tests/e2e/landing.spec.ts) if the desktop/mobile entry affordances change
- Add any missing assertions for:
  - desktop fine-pointer hover/reticle behavior at a desktop breakpoint
  - desktop primary action row contents and state-specific camera/motion affordances
  - compact top warning placement
  - preserved access to object detail and recovery content after desktop decluttering

## Risk register
- Desktop declutter removes too much state visibility and hides recovery actions.
  - Mitigation: keep a single always-visible desktop action row plus compact warning rail; push only secondary detail into overlay/settings.
- Pointer hover competes with click selection or manual drag behavior.
  - Mitigation: make hover transient, leave click selection authoritative, and keep manual drag path untouched for manual mode.
- Mobile navigation regresses because overlay/alignment/settings states already interact through scroll locking.
  - Mitigation: test open/close/alignment transitions explicitly and avoid changing route/state ownership.
- Warning compaction obscures critical fallback states.
  - Mitigation: preserve severity ordering and keep critical fallback copy visible without requiring opening settings.

## Rollback
- If the desktop shell simplification regresses usability, revert only the desktop overlay/action layout while preserving any shared warning extraction and tests.
- If pointer-reticle hover proves unstable, disable the fine-pointer hover path and fall back to current click selection while keeping desktop decluttering changes.
- If mobile overlay navigation regresses, restore current mobile overlay structure first and retain only test-safe warning/action changes.
