# Implementation Notes

- Task ID: task-fix-mobile-alignment-flow-so-options-overla-fe09330c
- Pair: implement
- Phase ID: mobile-alignment-focus-decoupling
- Phase Directory Key: mobile-alignment-focus-decoupling
- Phase Title: Decouple mobile alignment options from active crosshair focus
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`

## Symbols touched
- `ViewerShell`
- `openAlignmentExperience`
- `startAlignmentFocus`
- `closeAlignmentExperience`
- `mobileAlignmentPanelProps`
- `AlignmentInstructionsPanel`

## Checklist mapping
- Milestone 1: completed by separating mobile panel-open from focus activation in `ViewerShell`.
- Validation plan: completed with focused viewer-shell tests, full test suite, lint, and type-check command execution.

## Assumptions
- The mobile quick-action `Align` control is the entry point into the align view and should stay usable even before the first live motion sample arrives.

## Preserved invariants
- Calibration is still applied only from the center crosshair button.
- Desktop/shared alignment panel behavior stays unchanged unless the compact mobile panel explicitly opts into the new CTA.
- Cancel/close still exits alignment without mutating calibration.

## Intended behavior changes
- Opening mobile alignment now shows the instructions/options panel first and does not enter crosshair focus immediately.
- Both mobile alignment panel render paths now render the same `Start alignment` CTA whenever the panel is open, including when the viewer overlay is reopened mid-alignment.
- Active mobile focus hides the alignment panel so the center crosshair remains unobstructed.

## Known non-changes
- No calibration math, route state, persisted settings, or desktop layout changes.
- Existing reset and fine-adjust controls remain in the alignment panel.

## Expected side effects
- The mobile `Align` quick action no longer appears disabled before the first live sample; the disabled affordance moved to the panel-level `Start alignment` CTA.
- Alignment state cleanup effects now defer internal state resets with `queueMicrotask` to satisfy the current React hooks lint rule without changing the visible flow.

## Validation performed
- `npx vitest run tests/unit/viewer-shell.test.ts` ✅ (`46` tests)
- `npm test` ✅ (`186` tests)
- `npm run lint` ✅ with existing warnings only (`settings-sheet.tsx`, `viewer-shell.tsx`, `alignment-tutorial.ts`)
- `npx tsc --noEmit` ⚠️ fails outside this task in `tests/unit/settings-sheet.test.tsx:119` because a `SettingsSheetProps` fixture is missing `motionQuality` and `onMotionQualityChange`

## Deduplication / centralization decisions
- Reused the existing `AlignmentInstructionsPanel` with opt-in `Start alignment` props instead of adding a separate mobile-only panel component.
- Centralized the shared mobile alignment panel props so the compact quick-action panel and both overlay panel render paths cannot drift on CTA visibility or gating.
