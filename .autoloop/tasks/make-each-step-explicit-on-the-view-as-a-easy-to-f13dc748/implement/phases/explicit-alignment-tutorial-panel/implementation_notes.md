# Implementation Notes

- Task ID: make-each-step-explicit-on-the-view-as-a-easy-to-f13dc748
- Pair: implement
- Phase ID: explicit-alignment-tutorial-panel
- Phase Directory Key: explicit-alignment-tutorial-panel
- Phase Title: Explicit alignment tutorial and blockers
- Scope: phase-local producer artifact

## Files Changed
- `lib/viewer/alignment-tutorial.ts`
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Symbols Touched
- `buildAlignmentTutorialModel`
- `ALIGNMENT_FINE_ADJUST_CONTROLS`
- `ViewerShell`
- `AlignmentInstructionsPanel`
- `SettingsSheet`

## Checklist Mapping
- Milestone 1: completed via shared tutorial/notices/CTA derivation in `alignment-tutorial.ts`.
- Milestone 2: completed via live-panel notices, align/reset actions, and mapped fine-adjust nudges in `viewer-shell.tsx`.
- Milestone 3: completed via settings-sheet parity wiring and regression updates in unit tests.

## Assumptions
- `manual` in the request means the existing fine-adjust/reset step, not a third selectable target.
- The existing fine-adjust deltas remain the intended manual nudge increments.

## Preserved Invariants
- Alignment target preference remains `sun | moon`.
- Calibration persistence and reset still flow through the existing pose-calibration update path.
- Fallback target resolution order is unchanged.
- Mobile quick-action Align visibility is unchanged.

## Intended Behavior Changes
- Alignment steps now stay target-aware and blocker-aware across the live panel and settings sheet.
- The live panel now exposes the existing manual fine-adjust nudges and reset affordance inline with the tutorial.
- Disabled Align states now show inline messaging and a CTA label that explains the blocker.

## Known Non-Changes
- No persisted calibration schema changes.
- No new manual alignment target value.
- No layout rework outside alignment-related surfaces.

## Expected Side Effects
- Tests that pinned the older generic step copy now expect resolved-target wording.
- Settings-sheet standalone usage now derives default notices and CTA labels from the shared tutorial model when explicit props are omitted.

## Validation Performed
- `pnpm test -- tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`

## Deduplication / Centralization
- Centralized alignment notices, steps, CTA label, and fine-adjust button definitions in `lib/viewer/alignment-tutorial.ts` to prevent viewer/settings drift.
