# Test Strategy

- Task ID: skylens-task-alignment-settings-parity-with-open-e4c7e805
- Pair: test
- Phase ID: mobile-overlay-parity
- Phase Directory Key: mobile-overlay-parity
- Phase Title: Unify compact mobile panel shell and align overlay behavior
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 overlay placement:
  - `tests/unit/viewer-shell.test.ts`
  - Verifies compact Align renders under `mobile-alignment-overlay-shell` / `mobile-alignment-overlay-panel`.
  - Verifies `alignment-instructions-panel` is no longer found inside `mobile-viewer-quick-actions`.
- AC-2 shared compact shell contract:
  - `tests/unit/viewer-shell.test.ts`
  - Verifies compact Open viewer keeps the fixed shell + internal scroll region contract.
  - Verifies compact Align panel max height matches compact Open viewer and uses `mobile-alignment-overlay-scroll-region`.
  - `tests/unit/settings-sheet.test.tsx`
  - Verifies Settings uses the fixed shell, shared compact max-height string, and internal scroll region.
- AC-3 preserved alignment flow:
  - `tests/unit/viewer-shell.test.ts`
  - Verifies Align still opens from the mobile action, Start alignment still transitions into alignment focus, explicit close restores the mobile Align action, and reopening Open viewer while Align is open keeps the Start action available.
- AC-4 short-viewport reachability:
  - `tests/e2e/permissions.spec.ts`
  - Verifies the compact alignment overlay remains visible on a short mobile viewport, its internal scroll region overflows, and the lowest nudge control is reachable after scrolling.

## Preserved invariants checked
- Open viewer keeps backdrop-dismiss behavior.
- Settings keeps dialog semantics and internal scrolling.
- Alignment focus still hides overlay chrome and removes the alignment panel.

## Edge cases covered
- Reopening compact Open viewer while Align is already open.
- Compact alignment with live motion unavailable still keeps Start alignment visible but disabled.
- Short viewport where lower alignment controls would be clipped without internal scrolling.

## Failure paths / stabilization
- Short-viewport coverage is isolated to a single Playwright mobile viewport test and scrolls the overlay scroll-region directly to avoid flake from gesture simulation.
- Unit coverage uses stable `data-testid` hooks for overlay shells, panels, and scroll regions instead of visual-order heuristics.

## Known gaps
- No additional desktop-specific tests were added because desktop layout is explicitly out of scope for this phase.
- The broader full-suite regression pass is not part of this phase artifact; validation remains scoped to the changed viewer/settings surfaces and the mobile short-viewport e2e.
