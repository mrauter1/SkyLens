# Implementation Notes

- Task ID: skylens-alignment-ux-mobile-camera-hardening-tas-ebd05595
- Pair: implement
- Phase ID: viewer-alignment-ux-hardening
- Phase Directory Key: viewer-alignment-ux-hardening
- Phase Title: Harden live alignment flow and mobile viewer interaction
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `lib/viewer/alignment-tutorial.ts`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched
- `ViewerShell`
- `AlignmentInstructionsPanel`
- `buildAlignmentTutorialModel`
- `SettingsSheet`

## Checklist mapping
- Milestone 1: added explicit viewer-owned alignment open/close state, close action, live-stage scroll locking, and a viewport-fitting non-scrolling live mobile overlay shell.
- Milestone 2: replaced fast-align step list with `nextAction`/`focusPrompt`, wired center-crosshair apply, updated copy for direct re-entry, and removed reset-first messaging.
- Milestone 3: updated viewer/settings regression coverage for closed-by-default behavior, explicit open/close, repeated align entry, center-crosshair affordance, and no-scroll live overlay behavior.

## Assumptions
- The settings sheet remains a launcher for alignment, but the detailed calibration controls now belong to the viewer-owned alignment panel.

## Preserved invariants
- Permission, observer, and sensor startup flows remain unchanged.
- Calibration target resolution and quaternion calibration math remain unchanged.
- Blocked and non-camera live states retain the scrollable mobile overlay path.

## Intended behavior changes
- Relative-sensor and drift warnings no longer auto-open the alignment panel.
- Live alignment applies from the centered crosshair in focus mode, with a top-of-screen prompt and translucent green reticle styling.
- Successful alignment closes focus/panel state but leaves Align immediately available for another run.
- The live-camera mobile overlay now shows only compact status/summary content while AR is active so the non-scrolling shell stays reachable on short screens.

## Known non-changes
- No sensor-permission refactor.
- No calibration target selection algorithm changes.
- No unrelated viewer layout redesign outside the requested alignment/overlay surfaces.

## Expected side effects
- `npm ci` was required in this workspace because `node_modules` was absent before validation.

## Validation performed
- `npm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx`
- `npm test`

## Deduplication / centralization
- Fast-align copy/state now flows through the viewer-owned alignment experience and the shared tutorial model instead of duplicating a second settings-sheet calibration panel.
- The full mobile overlay content stack is preserved only on scrollable demo/blocked/non-camera paths; the live-camera path uses a dedicated compact branch to avoid repeating the clipping bug in future edits.
